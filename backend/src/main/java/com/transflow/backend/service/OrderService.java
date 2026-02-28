package com.transflow.backend.service;

import com.transflow.backend.dto.ActiveRouteDTO;
import com.transflow.backend.dto.OrderCreateRequest;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final LocationRepository locationRepository;
    private final DriverRepository driverRepository;

    @Transactional
    public Order createOrder(OrderCreateRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.getVehicleId())
                .orElseThrow(() -> new RuntimeException("Nie znaleziono pojazdu"));

        Location startLoc = locationRepository.findById(request.getStartLocationId())
                .orElseThrow(() -> new RuntimeException("Nie znaleziono lokalizacji początkowej"));

        Location endLoc = locationRepository.findById(request.getEndLocationId())
                .orElseThrow(() -> new RuntimeException("Nie znaleziono lokalizacji końcowej"));

        Driver assignedDriver = driverRepository.findAll().stream()
                .filter(d -> d.getAssignedVehicle() != null && d.getAssignedVehicle().getId().equals(vehicle.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Pojazd nie posiada przypisanego kierowcy. Przypisz kierowcę przed wysłaniem w trasę."));

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStartLocation(startLoc);
        order.setEndLocation(endLoc);
        order.setDriver(assignedDriver);

        order.setStatus("APPROACHING");
        order.setProgress(0.0);
        order.setGpsDistance(0.0);

        order.setStartLatApproaching(vehicle.getCurrentLat() != null ? vehicle.getCurrentLat() : 52.0);
        order.setStartLngApproaching(vehicle.getCurrentLng() != null ? vehicle.getCurrentLng() : 19.0);
        order.setLoadingTicksRemaining(5);

        order.setRoutePolylineApproaching(request.getRoutePolylineApproaching());
        order.setRouteDistanceApproaching(request.getRouteDistanceApproaching());
        order.setRoutePolylineTransit(request.getRoutePolylineTransit());
        order.setRouteDistanceTransit(request.getRouteDistanceTransit());

        vehicle.setStatus("BUSY");
        assignedDriver.setStatus("BUSY");

        vehicleRepository.save(vehicle);
        driverRepository.save(assignedDriver);

        return orderRepository.save(order);
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public List<ActiveRouteDTO> getActiveRoutes() {
        return orderRepository.findAll().stream()
                .filter(o -> List.of("APPROACHING", "LOADING", "IN_TRANSIT").contains(o.getStatus()))
                .map(o -> new ActiveRouteDTO(
                        o.getVehicle().getId(),
                        o.getRoutePolylineApproaching(),
                        o.getRoutePolylineTransit(),
                        o.getStatus()
                ))
                .collect(Collectors.toList());
    }
}