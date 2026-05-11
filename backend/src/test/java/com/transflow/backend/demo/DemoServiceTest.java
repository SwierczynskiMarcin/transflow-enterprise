package com.transflow.backend.demo;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
import com.transflow.backend.logistics.LocationRepository;
import com.transflow.backend.logistics.OrderCreateRequest;
import com.transflow.backend.logistics.OrderService;
import com.transflow.backend.logistics.RoutingService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DemoServiceTest {

    @InjectMocks
    private DemoService demoService;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private RoutingService routingService;

    @Mock
    private OrderService orderService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void shouldSeedLocationsWhenNoneExist() {
        when(locationRepository.existsByName(anyString())).thenReturn(false);

        Map<String, Integer> result = demoService.seedLocations();

        assertEquals(25, result.get("added"));
        assertEquals(0, result.get("skipped"));
        verify(locationRepository, times(25)).save(any(Location.class));
    }

    @Test
    void shouldSkipSeedingLocationsWhenAllExist() {
        when(locationRepository.existsByName(anyString())).thenReturn(true);

        Map<String, Integer> result = demoService.seedLocations();

        assertEquals(0, result.get("added"));
        assertEquals(25, result.get("skipped"));
        verify(locationRepository, never()).save(any(Location.class));
    }

    @Test
    void shouldPartiallySeedLocations() {
        when(locationRepository.existsByName("Warszawa Central Hub")).thenReturn(true);
        when(locationRepository.existsByName("Berlin Central Hub")).thenReturn(true);
        when(locationRepository.existsByName(argThat(s -> !s.equals("Warszawa Central Hub") && !s.equals("Berlin Central Hub")))).thenReturn(false);

        Map<String, Integer> result = demoService.seedLocations();

        assertEquals(23, result.get("added"));
        assertEquals(2, result.get("skipped"));
        verify(locationRepository, times(23)).save(any(Location.class));
    }

    @Test
    void shouldNotSeedFleetWhenCapacityReached() {
        when(vehicleRepository.count()).thenReturn(50L);

        Map<String, Integer> result = demoService.seedFleetAndStaff();

        assertEquals(0, result.get("added"));
        assertEquals(50, result.get("skipped"));
        verify(vehicleRepository, never()).saveAndFlush(any());
    }

    @Test
    void shouldSeedFleetAndHandleDataIntegrityViolations() {
        when(vehicleRepository.count()).thenReturn(48L);
        when(locationRepository.findAll()).thenReturn(List.of(createLocation(1L, "BASE")));
        when(vehicleRepository.existsByPlateNumber(anyString())).thenReturn(false);

        when(vehicleRepository.saveAndFlush(any(Vehicle.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate plate validation check"))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Integer> result = demoService.seedFleetAndStaff();

        assertEquals(2, result.get("added"));
        assertEquals(48, result.get("skipped"));
        verify(vehicleRepository, atLeast(2)).saveAndFlush(any(Vehicle.class));
        verify(driverRepository, times(2)).save(any(Driver.class));
    }

    @Test
    void shouldClearAllDataSuccessfully() {
        Query mockQuery = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(mockQuery);
        when(mockQuery.executeUpdate()).thenReturn(1);

        demoService.clearAllData();

        verify(entityManager).createNativeQuery("TRUNCATE TABLE invoice_audits, fuel_logs, orders, drivers, vehicles, locations RESTART IDENTITY CASCADE");
        verify(mockQuery).executeUpdate();
    }

    @Test
    void shouldNotDispatchWhenNoLocationsAvailable() {
        Vehicle vehicle = createVehicle(1L, "AVAILABLE", false);
        Driver driver = createDriver("AVAILABLE", vehicle);

        when(driverRepository.findAll()).thenReturn(List.of(driver));
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));
        when(locationRepository.findAll()).thenReturn(List.of());

        demoService.autoDispatch(1);

        verify(orderService, never()).createOrder(any());
        verify(routingService, never()).getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void shouldNotDispatchWhenNoVehiclesAvailable() {
        when(driverRepository.findAll()).thenReturn(List.of());
        when(vehicleRepository.findAll()).thenReturn(List.of());

        demoService.autoDispatch(1);

        verify(orderService, never()).createOrder(any());
        verify(routingService, never()).getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void shouldDispatchOrderSuccessfully() {
        Location start = createLocation(1L, "BASE");
        Location end = createLocation(2L, "WAREHOUSE");
        Vehicle vehicle = createVehicle(10L, "AVAILABLE", false);
        Driver driver = createDriver("AVAILABLE", vehicle);

        when(driverRepository.findAll()).thenReturn(List.of(driver));
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));
        when(locationRepository.findAll()).thenReturn(List.of(start, end));
        when(vehicleRepository.findById(10L)).thenReturn(Optional.of(vehicle));

        RoutingService.RouteInfo routeInfo = new RoutingService.RouteInfo("encoded_polyline", 150.0);
        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(routeInfo);

        demoService.autoDispatch(1);

        verify(orderService, times(1)).createOrder(any(OrderCreateRequest.class));
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "ORDERS");
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "DRIVERS");
    }

    @Test
    void shouldContinueDispatchLoopIfOrderServiceThrowsException() {
        Location start = createLocation(1L, "BASE");
        Location end = createLocation(2L, "WAREHOUSE");
        Vehicle vehicle1 = createVehicle(10L, "AVAILABLE", false);
        Vehicle vehicle2 = createVehicle(11L, "AVAILABLE", false);
        Driver driver1 = createDriver("AVAILABLE", vehicle1);
        Driver driver2 = createDriver("AVAILABLE", vehicle2);

        when(driverRepository.findAll()).thenReturn(List.of(driver1, driver2));
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle1, vehicle2));
        when(locationRepository.findAll()).thenReturn(List.of(start, end));
        when(vehicleRepository.findById(10L)).thenReturn(Optional.of(vehicle1));
        when(vehicleRepository.findById(11L)).thenReturn(Optional.of(vehicle2));

        RoutingService.RouteInfo routeInfo = new RoutingService.RouteInfo("encoded_polyline", 150.0);
        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(routeInfo);

        doThrow(new RuntimeException("Simulated order failure")).when(orderService).createOrder(any(OrderCreateRequest.class));

        demoService.autoDispatch(2);

        verify(orderService, times(2)).createOrder(any(OrderCreateRequest.class));
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void shouldSkipDispatchWhenRoutingFails() {
        Location start = createLocation(1L, "BASE");
        Location end = createLocation(2L, "WAREHOUSE");
        Vehicle vehicle = createVehicle(10L, "AVAILABLE", false);
        Driver driver = createDriver("AVAILABLE", vehicle);

        when(driverRepository.findAll()).thenReturn(List.of(driver));
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));
        when(locationRepository.findAll()).thenReturn(List.of(start, end));
        when(vehicleRepository.findById(10L)).thenReturn(Optional.of(vehicle));

        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(null);

        demoService.autoDispatch(1);

        verify(orderService, never()).createOrder(any(OrderCreateRequest.class));
        verifyNoInteractions(messagingTemplate);
    }

    private Location createLocation(Long id, String type) {
        Location location = new Location();
        location.setId(id);
        location.setType(type);
        location.setLatitude(52.0);
        location.setLongitude(21.0);
        return location;
    }

    private Vehicle createVehicle(Long id, String status, boolean isServiceUnit) {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(id);
        vehicle.setStatus(status);
        vehicle.setIsServiceUnit(isServiceUnit);
        vehicle.setCurrentLat(52.0);
        vehicle.setCurrentLng(21.0);
        return vehicle;
    }

    private Driver createDriver(String status, Vehicle assignedVehicle) {
        Driver driver = new Driver();
        driver.setStatus(status);
        driver.setAssignedVehicle(assignedVehicle);
        return driver;
    }
}