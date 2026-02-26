package com.transflow.backend.service;

import com.transflow.backend.model.Order;
import com.transflow.backend.model.Vehicle;
import com.transflow.backend.model.Location;
import com.transflow.backend.model.Driver;
import com.transflow.backend.repository.OrderRepository;
import com.transflow.backend.repository.VehicleRepository;
import com.transflow.backend.repository.LocationRepository;
import com.transflow.backend.repository.DriverRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final LocationRepository locationRepository;
    private final DriverRepository driverRepository;

    @Transactional
    public Order createOrder(Long vehicleId, Long startLocationId, Long endLocationId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new RuntimeException("Nie znaleziono pojazdu z ID: " + vehicleId));

        Location startLoc = locationRepository.findById(startLocationId)
                .orElseThrow(() -> new RuntimeException("Nie znaleziono lokalizacji początkowej"));

        Location endLoc = locationRepository.findById(endLocationId)
                .orElseThrow(() -> new RuntimeException("Nie znaleziono lokalizacji końcowej"));

        Driver assignedDriver = driverRepository.findAll().stream()
                .filter(d -> d.getAssignedVehicle() != null && d.getAssignedVehicle().getId().equals(vehicleId))
                .findFirst()
                .orElse(null);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStartLocation(startLoc);
        order.setEndLocation(endLoc);
        order.setDriver(assignedDriver);

        order.setStatus("APPROACHING");
        order.setProgress(0.0);
        order.setGpsDistance(0.0);

        vehicle.setStatus("BUSY");
        vehicleRepository.save(vehicle);

        return orderRepository.save(order);
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }
}