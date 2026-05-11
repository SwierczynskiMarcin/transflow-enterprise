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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VehicleControllerTest {

    @InjectMocks
    private VehicleController vehicleController;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should return list of all vehicles mapped to DTOs")
    void shouldGetAllVehicles() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setPlateNumber("WA12345");
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));

        List<VehicleDTO> result = vehicleController.getAllVehicles();

        assertEquals(1, result.size());
        assertEquals("WA12345", result.get(0).plateNumber());
    }

    @Test
    @DisplayName("Should add vehicle and handle null isServiceUnit by defaulting to false")
    void shouldAddVehicleSuccessfully() {
        VehicleDTO dto = new VehicleDTO(null, null, "WA123", "Volvo", "FH", 25.0, 600.0, null, 50.0, 20.0, 0.0, null, null);
        Vehicle savedVehicle = new Vehicle();
        savedVehicle.setId(1L);
        savedVehicle.setStatus("AVAILABLE");

        when(vehicleRepository.save(any(Vehicle.class))).thenReturn(savedVehicle);

        VehicleDTO response = vehicleController.addVehicle(dto);

        assertEquals("AVAILABLE", response.status());
        verify(vehicleRepository).save(argThat(v -> !v.getIsServiceUnit() && "AVAILABLE".equals(v.getStatus()) && v.getCurrentOdometer() == 0.0));
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
    }

    @Test
    @DisplayName("Should update existing vehicle successfully")
    void shouldUpdateVehicleSuccessfully() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setVersion(0L);
        vehicle.setStatus("AVAILABLE");

        VehicleDTO dto = new VehicleDTO(1L, 0L, "WA123", "Volvo", "FH", 25.0, 600.0, "AVAILABLE", 50.0, 20.0, 0.0, false, null);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(any(Vehicle.class))).thenReturn(vehicle);

        ResponseEntity<VehicleDTO> response = vehicleController.updateVehicle(1L, dto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(vehicleRepository).save(vehicle);
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
    }

    @Test
    @DisplayName("Should return 404 Not Found when updating non-existent vehicle")
    void shouldReturnNotFoundWhenUpdatingNonExistentVehicle() {
        VehicleDTO dto = new VehicleDTO(1L, 0L, "WA123", "Volvo", "FH", 25.0, 600.0, "AVAILABLE", 50.0, 20.0, 0.0, false, null);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<VehicleDTO> response = vehicleController.updateVehicle(1L, dto);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to update a non-AVAILABLE vehicle")
    void shouldThrowExceptionWhenUpdatingBusyVehicle() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BUSY");

        VehicleDTO dto = new VehicleDTO(1L, 0L, "WA123", "Volvo", "FH", 25.0, 600.0, "AVAILABLE", 50.0, 20.0, 0.0, false, null);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThrows(IllegalArgumentException.class, () -> vehicleController.updateVehicle(1L, dto));
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw ObjectOptimisticLockingFailureException on version mismatch during update")
    void shouldThrowExceptionOnVersionMismatchDuringVehicleUpdate() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setVersion(1L);
        vehicle.setStatus("AVAILABLE");

        VehicleDTO dto = new VehicleDTO(1L, 0L, "WA123", "Volvo", "FH", 25.0, 600.0, "AVAILABLE", 50.0, 20.0, 0.0, false, null);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> vehicleController.updateVehicle(1L, dto));
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should trigger breakdown and change status to BROKEN")
    void shouldTriggerBreakdownSuccessfully() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BUSY");
        vehicle.setIsServiceUnit(false);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        ResponseEntity<?> response = vehicleController.triggerBreakdown(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("BROKEN", vehicle.getStatus());
        verify(vehicleRepository).save(vehicle);
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should return 404 Not Found when triggering breakdown on non-existent vehicle")
    void shouldReturnNotFoundWhenTriggeringBreakdownNonExistentVehicle() {
        when(vehicleRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = vehicleController.triggerBreakdown(1L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to trigger breakdown on MSU")
    void shouldThrowExceptionWhenTriggeringBreakdownOnMsu() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BUSY");
        vehicle.setIsServiceUnit(true);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThrows(IllegalArgumentException.class, () -> vehicleController.triggerBreakdown(1L));
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should throw exception when vehicle is already broken or being towed")
    void shouldThrowExceptionWhenTriggeringBreakdownOnAlreadyBrokenVehicle() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BEING_TOWED");

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThrows(IllegalArgumentException.class, () -> vehicleController.triggerBreakdown(1L));
        verify(vehicleRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should successfully retry breakdown trigger on OptimisticLockingFailure")
    void shouldRetryTriggerBreakdownOnOptimisticLockingFailure() {
        when(vehicleRepository.findById(1L)).thenAnswer(invocation -> {
            Vehicle v = new Vehicle();
            v.setId(1L);
            v.setStatus("BUSY");
            v.setIsServiceUnit(false);
            return Optional.of(v);
        });

        when(vehicleRepository.save(any(Vehicle.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<?> response = vehicleController.triggerBreakdown(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(vehicleRepository, times(2)).save(any(Vehicle.class));
    }

    @Test
    @DisplayName("Should exhaust retries and throw exception when database is locked continuously")
    void shouldExhaustRetriesAndThrowOnContinuousLocking() {
        when(vehicleRepository.findById(1L)).thenAnswer(invocation -> {
            Vehicle v = new Vehicle();
            v.setId(1L);
            v.setStatus("BUSY");
            v.setIsServiceUnit(false);
            return Optional.of(v);
        });

        when(vehicleRepository.save(any(Vehicle.class)))
                .thenThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L));

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> vehicleController.triggerBreakdown(1L));
        verify(vehicleRepository, times(5)).save(any(Vehicle.class));
    }

    @Test
    @DisplayName("Should delete vehicle and unlink from drivers and orders")
    void shouldDeleteVehicleSuccessfully() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("AVAILABLE");

        Driver driver = new Driver();
        driver.setId(10L);
        driver.setAssignedVehicle(vehicle);

        Order order = new Order();
        order.setId(100L);
        order.setVehicle(vehicle);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(driverRepository.findByAssignedVehicleId(1L)).thenReturn(Optional.of(driver));
        when(orderRepository.findByVehicleId(1L)).thenReturn(List.of(order));

        ResponseEntity<?> response = vehicleController.deleteVehicle(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNull(driver.getAssignedVehicle());
        assertNull(order.getVehicle());

        verify(driverRepository).save(driver);
        verify(orderRepository).saveAll(List.of(order));
        verify(vehicleRepository).delete(vehicle);
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should return 404 Not Found when deleting non-existent vehicle")
    void shouldReturnNotFoundWhenDeletingNonExistentVehicle() {
        when(vehicleRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = vehicleController.deleteVehicle(1L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(vehicleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Should throw exception when attempting to delete a non-AVAILABLE vehicle")
    void shouldThrowExceptionWhenDeletingBusyVehicle() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BUSY");

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThrows(IllegalArgumentException.class, () -> vehicleController.deleteVehicle(1L));
        verify(vehicleRepository, never()).delete(any());
    }
}