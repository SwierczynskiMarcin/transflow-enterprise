package com.transflow.backend.fleet;

import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
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
    private final DriverRepository driverRepository;
    private final OrderRepository orderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<VehicleDTO> getAllVehicles() {
        return vehicleRepository.findAll().stream().map(VehicleDTO::from).toList();
    }

    @PostMapping
    public VehicleDTO addVehicle(@RequestBody VehicleDTO dto) {
        Vehicle vehicle = new Vehicle();
        vehicle.setPlateNumber(dto.plateNumber());
        vehicle.setBrand(dto.brand());
        vehicle.setModel(dto.model());
        vehicle.setBaseFuelConsumption(dto.baseFuelConsumption());
        vehicle.setFuelCapacity(dto.fuelCapacity());
        vehicle.setCurrentLat(dto.currentLat());
        vehicle.setCurrentLng(dto.currentLng());
        vehicle.setStatus("AVAILABLE");
        vehicle.setCurrentOdometer(0.0);
        Vehicle saved = vehicleRepository.save(vehicle);
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        return VehicleDTO.from(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<VehicleDTO> updateVehicle(@PathVariable Long id, @RequestBody VehicleDTO dto) {
        return vehicleRepository.findById(id).map(vehicle -> {
            if ("BUSY".equals(vehicle.getStatus())) {
                throw new IllegalArgumentException("Edycja zablokowana - pojazd w trasie.");
            }
            vehicle.setPlateNumber(dto.plateNumber());
            vehicle.setBrand(dto.brand());
            vehicle.setModel(dto.model());
            vehicle.setBaseFuelConsumption(dto.baseFuelConsumption());
            vehicle.setFuelCapacity(dto.fuelCapacity());
            vehicle.setCurrentLat(dto.currentLat());
            vehicle.setCurrentLng(dto.currentLng());

            Vehicle saved = vehicleRepository.save(vehicle);
            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            return ResponseEntity.ok(VehicleDTO.from(saved));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVehicle(@PathVariable Long id) {
        return vehicleRepository.findById(id).map(vehicle -> {
            if ("BUSY".equals(vehicle.getStatus())) {
                throw new IllegalArgumentException("Nie można usunąć pojazdu, który jest w trasie.");
            }

            driverRepository.findByAssignedVehicleId(id).ifPresent(driver -> {
                driver.setAssignedVehicle(null);
                driverRepository.save(driver);
            });

            List<Order> orders = orderRepository.findByVehicleId(id);
            for (Order order : orders) {
                order.setVehicle(null);
            }
            orderRepository.saveAll(orders);

            vehicleRepository.delete(vehicle);

            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}