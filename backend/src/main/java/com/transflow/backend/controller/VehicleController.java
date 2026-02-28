package com.transflow.backend.controller;

import com.transflow.backend.model.Vehicle;
import com.transflow.backend.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vehicles")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class VehicleController {

    private final VehicleRepository vehicleRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<Vehicle> getAllVehicles() {
        return vehicleRepository.findAll();
    }

    @PostMapping
    public Vehicle addVehicle(@RequestBody Vehicle vehicle) {
        if (vehicle.getStatus() == null) vehicle.setStatus("AVAILABLE");
        if (vehicle.getCurrentOdometer() == null) vehicle.setCurrentOdometer(0.0);
        Vehicle saved = vehicleRepository.save(vehicle);
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        return saved;
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vehicle> updateVehicle(@PathVariable Long id, @RequestBody Vehicle updatedDetails) {
        return vehicleRepository.findById(id).map(vehicle -> {
            vehicle.setPlateNumber(updatedDetails.getPlateNumber());
            vehicle.setBrand(updatedDetails.getBrand());
            vehicle.setModel(updatedDetails.getModel());
            vehicle.setBaseFuelConsumption(updatedDetails.getBaseFuelConsumption());
            vehicle.setFuelCapacity(updatedDetails.getFuelCapacity());
            if (!"BUSY".equals(vehicle.getStatus())) {
                vehicle.setCurrentLat(updatedDetails.getCurrentLat());
                vehicle.setCurrentLng(updatedDetails.getCurrentLng());
            }
            Vehicle saved = vehicleRepository.save(vehicle);
            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVehicle(@PathVariable Long id) {
        return vehicleRepository.findById(id).map(vehicle -> {
            if ("BUSY".equals(vehicle.getStatus())) {
                return ResponseEntity.badRequest().body("Nie można usunąć pojazdu, który jest w trasie.");
            }
            vehicleRepository.delete(vehicle);
            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}