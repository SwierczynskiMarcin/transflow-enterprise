package com.transflow.backend.fleet;

import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DriverController {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<DriverDTO> getAllDrivers() {
        return driverRepository.findAll().stream().map(DriverDTO::from).toList();
    }

    @PostMapping
    public ResponseEntity<DriverDTO> addDriver(@RequestBody DriverDTO payload) {
        return processDriverSave(new Driver(), payload);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DriverDTO> updateDriver(@PathVariable Long id, @RequestBody DriverDTO payload) {
        return driverRepository.findById(id)
                .map(existingDriver -> {
                    if ("BUSY".equals(existingDriver.getStatus())) {
                        throw new IllegalArgumentException("Edycja zablokowana - kierowca jest w trasie.");
                    }
                    if (payload.version() != null && !existingDriver.getVersion().equals(payload.version())) {
                        throw new ObjectOptimisticLockingFailureException(Driver.class, existingDriver.getId());
                    }
                    return processDriverSave(existingDriver, payload);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private ResponseEntity<DriverDTO> processDriverSave(Driver driver, DriverDTO payload) {
        driver.setFirstName(payload.firstName());
        driver.setLastName(payload.lastName());
        driver.setPhoneNumber(payload.phoneNumber());

        if (payload.assignedVehicle() != null && payload.assignedVehicle().id() != null) {
            Vehicle vehicle = vehicleRepository.findById(payload.assignedVehicle().id()).orElse(null);
            driver.setAssignedVehicle(vehicle);
            if (!"BUSY".equals(driver.getStatus())) driver.setStatus("AVAILABLE");
        } else {
            driver.setAssignedVehicle(null);
            if (!"BUSY".equals(driver.getStatus())) driver.setStatus("WAITING_FOR_VEHICLE");
        }

        if (driver.getTotalDrivingTime() == null) driver.setTotalDrivingTime(0.0);

        Driver saved = driverRepository.save(driver);
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
        return ResponseEntity.ok(DriverDTO.from(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDriver(@PathVariable Long id) {
        return driverRepository.findById(id).map(driver -> {
            boolean hasActiveOrders = orderRepository.findByDriverId(id).stream()
                    .anyMatch(o -> List.of("APPROACHING", "LOADING", "IN_TRANSIT", "RESCUE_APPROACHING", "HANDOVER", "TOW_APPROACHING", "WAITING_FOR_CARGO_CLEARANCE", "TOWING").contains(o.getStatus()));

            if (hasActiveOrders || "BUSY".equals(driver.getStatus())) {
                throw new IllegalArgumentException("Nie można usunąć kierowcy przypisanego do aktywnego zlecenia.");
            }

            driver.setAssignedVehicle(null);

            List<Order> orders = orderRepository.findByDriverId(id);
            for (Order order : orders) {
                order.setDriver(null);
            }
            orderRepository.saveAll(orders);

            driverRepository.delete(driver);

            messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}