package com.transflow.backend.fleet;

import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DriverControllerTest {

    @InjectMocks
    private DriverController driverController;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should return list of all drivers mapped to DTOs")
    void shouldGetAllDrivers() {
        Driver driver = new Driver();
        driver.setId(1L);
        driver.setFirstName("Jan");
        driver.setLastName("Kowalski");
        when(driverRepository.findAll()).thenReturn(List.of(driver));

        List<DriverDTO> result = driverController.getAllDrivers();

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).id());
        assertEquals("Jan", result.get(0).firstName());
    }

    @Test
    @DisplayName("Should add driver and set status to AVAILABLE when vehicle is assigned")
    void shouldAddDriverWithAssignedVehicleSuccessfully() {
        DriverDTO.AssignedVehicleDTO assignedVehicleDTO = new DriverDTO.AssignedVehicleDTO(10L, "WA123", "Volvo");
        DriverDTO payload = new DriverDTO(null, null, "Adam", "Nowak", "123", null, assignedVehicleDTO);

        Vehicle vehicle = new Vehicle();
        vehicle.setId(10L);

        Driver savedDriver = new Driver();
        savedDriver.setId(1L);
        savedDriver.setFirstName("Adam");
        savedDriver.setStatus("AVAILABLE");

        when(vehicleRepository.findById(10L)).thenReturn(Optional.of(vehicle));
        when(driverRepository.save(any(Driver.class))).thenReturn(savedDriver);

        ResponseEntity<DriverDTO> response = driverController.addDriver(payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("AVAILABLE", Objects.requireNonNull(response.getBody()).status());
        verify(vehicleRepository).findById(10L);
        verify(driverRepository).save(argThat(d -> "AVAILABLE".equals(d.getStatus())));
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
    }

    @Test
    @DisplayName("Should add driver and set status to WAITING_FOR_VEHICLE when no vehicle is assigned")
    void shouldAddDriverWithoutVehicleSuccessfully() {
        DriverDTO payload = new DriverDTO(null, null, "Adam", "Nowak", "123", null, null);
        Driver savedDriver = new Driver();
        savedDriver.setId(1L);
        savedDriver.setFirstName("Adam");
        savedDriver.setStatus("WAITING_FOR_VEHICLE");

        when(driverRepository.save(any(Driver.class))).thenReturn(savedDriver);

        ResponseEntity<DriverDTO> response = driverController.addDriver(payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("WAITING_FOR_VEHICLE", Objects.requireNonNull(response.getBody()).status());
        verify(driverRepository).save(argThat(d -> "WAITING_FOR_VEHICLE".equals(d.getStatus())));
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
    }

    @Test
    @DisplayName("Should update driver successfully")
    void shouldUpdateDriverSuccessfully() {
        Driver existingDriver = new Driver();
        existingDriver.setId(1L);
        existingDriver.setVersion(0L);
        existingDriver.setStatus("AVAILABLE");

        DriverDTO payload = new DriverDTO(1L, 0L, "Adam", "Nowak", "123", "AVAILABLE", null);

        when(driverRepository.findById(1L)).thenReturn(Optional.of(existingDriver));
        when(driverRepository.save(any(Driver.class))).thenReturn(existingDriver);

        ResponseEntity<DriverDTO> response = driverController.updateDriver(1L, payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(driverRepository).save(existingDriver);
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
    }

    @Test
    @DisplayName("Should return 404 Not Found when updating non-existent driver")
    void shouldReturnNotFoundWhenUpdatingNonExistentDriver() {
        DriverDTO payload = new DriverDTO(1L, 0L, "Adam", "Nowak", "123", "AVAILABLE", null);
        when(driverRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<DriverDTO> response = driverController.updateDriver(1L, payload);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(driverRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to update a BUSY driver")
    void shouldThrowExceptionWhenUpdatingBusyDriver() {
        Driver existingDriver = new Driver();
        existingDriver.setId(1L);
        existingDriver.setStatus("BUSY");

        DriverDTO payload = new DriverDTO(1L, 0L, "Adam", "Nowak", "123", "BUSY", null);

        when(driverRepository.findById(1L)).thenReturn(Optional.of(existingDriver));

        assertThrows(IllegalArgumentException.class, () -> driverController.updateDriver(1L, payload));
        verify(driverRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw ObjectOptimisticLockingFailureException on version mismatch during update")
    void shouldThrowExceptionOnVersionMismatchDuringUpdate() {
        Driver existingDriver = new Driver();
        existingDriver.setId(1L);
        existingDriver.setVersion(1L);
        existingDriver.setStatus("AVAILABLE");

        DriverDTO payload = new DriverDTO(1L, 0L, "Adam", "Nowak", "123", "AVAILABLE", null);

        when(driverRepository.findById(1L)).thenReturn(Optional.of(existingDriver));

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> driverController.updateDriver(1L, payload));
        verify(driverRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should delete driver and unlink from active orders successfully")
    void shouldDeleteDriverSuccessfully() {
        Driver driver = new Driver();
        driver.setId(1L);
        driver.setStatus("AVAILABLE");

        Order order = new Order();
        order.setId(10L);
        order.setDriver(driver);
        order.setStatus("COMPLETED");

        when(driverRepository.findById(1L)).thenReturn(Optional.of(driver));
        when(orderRepository.findByDriverId(1L)).thenReturn(List.of(order));

        ResponseEntity<?> response = driverController.deleteDriver(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNull(order.getDriver());

        verify(orderRepository).saveAll(List.of(order));
        verify(driverRepository).delete(driver);
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should return 404 Not Found when deleting non-existent driver")
    void shouldReturnNotFoundWhenDeletingNonExistentDriver() {
        when(driverRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = driverController.deleteDriver(1L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(driverRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to delete a BUSY driver")
    void shouldThrowExceptionWhenDeletingBusyDriver() {
        Driver driver = new Driver();
        driver.setId(1L);
        driver.setStatus("BUSY");

        when(driverRepository.findById(1L)).thenReturn(Optional.of(driver));

        assertThrows(IllegalArgumentException.class, () -> driverController.deleteDriver(1L));
        verify(driverRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to delete driver with active orders")
    void shouldThrowExceptionWhenDeletingDriverWithActiveOrders() {
        Driver driver = new Driver();
        driver.setId(1L);
        driver.setStatus("AVAILABLE");

        Order order = new Order();
        order.setId(10L);
        order.setStatus("IN_TRANSIT");

        when(driverRepository.findById(1L)).thenReturn(Optional.of(driver));
        when(orderRepository.findByDriverId(1L)).thenReturn(List.of(order));

        assertThrows(IllegalArgumentException.class, () -> driverController.deleteDriver(1L));
        verify(driverRepository, never()).delete(any());
    }
}