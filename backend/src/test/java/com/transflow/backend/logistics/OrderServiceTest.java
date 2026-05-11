package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @InjectMocks
    private OrderService orderService;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private AutomationService automationService;

    @Test
    @DisplayName("Should create order successfully with correct financial calculations")
    void shouldCreateOrderSuccessfully() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 1L, 2L, "poly1", 1000.0, "poly2", 25500.0, 4.5);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("AVAILABLE");
        vehicle.setCurrentLat(52.0);
        vehicle.setCurrentLng(21.0);

        Location startLoc = new Location();
        startLoc.setId(1L);

        Location endLoc = new Location();
        endLoc.setId(2L);

        Driver driver = new Driver();
        driver.setId(1L);
        driver.setStatus("AVAILABLE");
        driver.setAssignedVehicle(vehicle);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(locationRepository.findById(1L)).thenReturn(Optional.of(startLoc));
        when(locationRepository.findById(2L)).thenReturn(Optional.of(endLoc));
        when(driverRepository.findAll()).thenReturn(List.of(driver));

        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order o = invocation.getArgument(0);
            o.setId(100L);
            return o;
        });

        Order result = orderService.createOrder(request);

        assertEquals(100L, result.getId());
        assertEquals("APPROACHING", result.getStatus());
        assertEquals(4.5, result.getPricePerKm());
        assertEquals(114.75, result.getContractedAmount());
        assertEquals("BUSY", vehicle.getStatus());
        assertEquals("BUSY", driver.getStatus());
        assertFalse(result.getRpaEmailSent());

        verify(vehicleRepository).save(vehicle);
        verify(driverRepository).save(driver);
        verify(orderRepository).save(result);
        verify(automationService).triggerBiller();
    }

    @Test
    @DisplayName("Should fallback to default pricePerKm when null is provided")
    void shouldFallbackToDefaultPricePerKm() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 1L, 2L, "poly1", 1000.0, "poly2", 10000.0, null);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        Driver driver = new Driver();
        driver.setAssignedVehicle(vehicle);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(locationRepository.findById(1L)).thenReturn(Optional.of(new Location()));
        when(locationRepository.findById(2L)).thenReturn(Optional.of(new Location()));
        when(driverRepository.findAll()).thenReturn(List.of(driver));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order result = orderService.createOrder(request);

        assertEquals(4.5, result.getPricePerKm());
        assertEquals(45.0, result.getContractedAmount());
    }

    @Test
    @DisplayName("Should throw exception when vehicle is not found")
    void shouldThrowExceptionWhenVehicleNotFound() {
        OrderCreateRequest request = new OrderCreateRequest(99L, 1L, 2L, "poly1", 1000.0, "poly2", 2000.0, 4.5);
        when(vehicleRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(request));

        verify(locationRepository, never()).findById(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when start location is not found")
    void shouldThrowExceptionWhenStartLocationNotFound() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 99L, 2L, "poly1", 1000.0, "poly2", 2000.0, 4.5);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(new Vehicle()));
        when(locationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(request));

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when end location is not found")
    void shouldThrowExceptionWhenEndLocationNotFound() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 1L, 99L, "poly1", 1000.0, "poly2", 2000.0, 4.5);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(new Vehicle()));
        when(locationRepository.findById(1L)).thenReturn(Optional.of(new Location()));
        when(locationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(request));

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when no driver is assigned to the vehicle")
    void shouldThrowExceptionWhenDriverNotAssignedToVehicle() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 1L, 2L, "poly1", 1000.0, "poly2", 2000.0, 4.5);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);

        Driver otherDriver = new Driver();
        otherDriver.setId(2L);
        otherDriver.setAssignedVehicle(null);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(locationRepository.findById(1L)).thenReturn(Optional.of(new Location()));
        when(locationRepository.findById(2L)).thenReturn(Optional.of(new Location()));
        when(driverRepository.findAll()).thenReturn(List.of(otherDriver));

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(request));

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should get all orders")
    void shouldGetAllOrders() {
        Order order = new Order();
        order.setId(1L);
        when(orderRepository.findAll()).thenReturn(List.of(order));

        List<Order> result = orderService.getAllOrders();

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).getId());
    }

    @Test
    @DisplayName("Should correctly filter active routes based on order status")
    void shouldGetActiveRoutes() {
        Vehicle vehicle1 = new Vehicle();
        vehicle1.setId(10L);

        Vehicle vehicle2 = new Vehicle();
        vehicle2.setId(11L);

        Order activeOrder = new Order();
        activeOrder.setId(1L);
        activeOrder.setVehicle(vehicle1);
        activeOrder.setStatus("IN_TRANSIT");
        activeOrder.setRoutePolylineApproaching("poly1");
        activeOrder.setRoutePolylineTransit("poly2");

        Order completedOrder = new Order();
        completedOrder.setId(2L);
        completedOrder.setVehicle(vehicle2);
        completedOrder.setStatus("COMPLETED");

        Order cancelledOrder = new Order();
        cancelledOrder.setId(3L);
        cancelledOrder.setVehicle(vehicle2);
        cancelledOrder.setStatus("CANCELLED");

        when(orderRepository.findAll()).thenReturn(List.of(activeOrder, completedOrder, cancelledOrder));

        List<ActiveRouteDTO> result = orderService.getActiveRoutes();

        assertEquals(1, result.size());
        assertEquals(10L, result.get(0).vehicleId());
        assertEquals("IN_TRANSIT", result.get(0).orderStatus());
        assertEquals("poly1", result.get(0).routePolylineApproaching());
        assertEquals("poly2", result.get(0).routePolylineTransit());
    }
}