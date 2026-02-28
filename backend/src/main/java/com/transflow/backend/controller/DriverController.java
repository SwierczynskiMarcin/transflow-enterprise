package com.transflow.backend.controller;

import com.transflow.backend.model.Driver;
import com.transflow.backend.model.Vehicle;
import com.transflow.backend.repository.DriverRepository;
import com.transflow.backend.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DriverController {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<Driver> getAllDrivers() {
        return driverRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<Driver> addDriver(@RequestBody Driver driverPayload) {
        return processDriverSave(new Driver(), driverPayload);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Driver> updateDriver(@PathVariable Long id, @RequestBody Driver driverPayload) {
        return driverRepository.findById(id)
                .map(existingDriver -> processDriverSave(existingDriver, driverPayload))
                .orElse(ResponseEntity.notFound().build());
    }

    private ResponseEntity<Driver> processDriverSave(Driver driver, Driver payload) {
        driver.setFirstName(payload.getFirstName());
        driver.setLastName(payload.getLastName());
        driver.setPhoneNumber(payload.getPhoneNumber());

        if (payload.getAssignedVehicle() != null && payload.getAssignedVehicle().getId() != null) {
            Vehicle vehicle = vehicleRepository.findById(payload.getAssignedVehicle().getId()).orElse(null);
            driver.setAssignedVehicle(vehicle);
            if (!"BUSY".equals(driver.getStatus())) driver.setStatus("AVAILABLE");
        } else {
            driver.setAssignedVehicle(null);
            if (!"BUSY".equals(driver.getStatus())) driver.setStatus("WAITING_FOR_VEHICLE");
        }

        if (driver.getTotalDrivingTime() == null) driver.setTotalDrivingTime(0.0);

        Driver saved = driverRepository.save(driver);
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDriver(@PathVariable Long id) {
        return driverRepository.findById(id).map(driver -> {
            if ("BUSY".equals(driver.getStatus())) {
                return ResponseEntity.badRequest().body("Nie można usunąć kierowcy w trasie.");
            }
            driverRepository.delete(driver);
            messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}