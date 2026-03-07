package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
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
    public Order createOrder(OrderCreateRequest request) {
        Vehicle vehicle = vehicleRepository.findById(request.vehicleId())
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono pojazdu"));

        Location startLoc = locationRepository.findById(request.startLocationId())
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono lokalizacji początkowej"));

        Location endLoc = locationRepository.findById(request.endLocationId())
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono lokalizacji końcowej"));

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

        order.setRoutePolylineApproaching(request.routePolylineApproaching());
        order.setRouteDistanceApproaching(request.routeDistanceApproaching());
        order.setRoutePolylineTransit(request.routePolylineTransit());
        order.setRouteDistanceTransit(request.routeDistanceTransit());

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
                .filter(o -> List.of("APPROACHING", "LOADING", "IN_TRANSIT", "RESCUE_APPROACHING").contains(o.getStatus()))
                .map(o -> new ActiveRouteDTO(
                        o.getVehicle().getId(),
                        o.getRoutePolylineApproaching(),
                        o.getRoutePolylineTransit(),
                        o.getStatus()
                ))
                .toList();
    }
}