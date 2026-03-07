package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.simulation.PhysicsService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RescueRadarService {

    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final DriverRepository driverRepository;
    private final PhysicsService physicsService;
    private final RoutingService routingService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final double TRUCK_SPEED_KMH = 80.0;

    public List<RescueCandidateDTO> scanForCandidates(Long targetVehicleId) {
        Vehicle targetVehicle = vehicleRepository.findById(targetVehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono pojazdu"));

        Order cargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(targetVehicleId))
                .findFirst().orElse(null);

        double targetLat = targetVehicle.getCurrentLat();
        double targetLng = targetVehicle.getCurrentLng();

        if (cargoOrder != null && "APPROACHING".equals(cargoOrder.getStatus())) {
            targetLat = cargoOrder.getStartLocation().getLatitude();
            targetLng = cargoOrder.getStartLocation().getLongitude();
        }

        List<Vehicle> allVehicles = vehicleRepository.findAll();
        List<Order> activeOrders = orderRepository.findByStatusIn(List.of("IN_TRANSIT", "APPROACHING", "LOADING"));

        List<RescueCandidateDTO> candidates = new ArrayList<>();

        for (Vehicle v : allVehicles) {
            if (Boolean.TRUE.equals(v.getIsServiceUnit())) continue;
            if (v.getId().equals(targetVehicleId) || "BROKEN".equals(v.getStatus()) || "WAITING_FOR_TOW".equals(v.getStatus()) || "BEING_TOWED".equals(v.getStatus())) continue;
            if (v.getTargetRescueId() != null) continue;

            if ("AVAILABLE".equals(v.getStatus())) {
                double distanceKm = physicsService.calculateDistance(v.getCurrentLat(), v.getCurrentLng(), targetLat, targetLng);
                double etaMinutes = (distanceKm / TRUCK_SPEED_KMH) * 60;
                candidates.add(new RescueCandidateDTO(v.getId(), v.getPlateNumber(), v.getBrand(), "A", distanceKm, etaMinutes, "Wolny"));
            } else if ("BUSY".equals(v.getStatus())) {
                Order order = activeOrders.stream()
                        .filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(v.getId()))
                        .findFirst()
                        .orElse(null);

                if (order != null && "IN_TRANSIT".equals(order.getStatus()) && order.getProgress() != null && order.getProgress() > 0.6) {
                    double remainingTripDistKm = 0.0;
                    if (order.getRouteDistanceTransit() != null) {
                        remainingTripDistKm = ((1.0 - order.getProgress()) * order.getRouteDistanceTransit()) / 1000.0;
                    } else {
                        double totalDist = physicsService.calculateDistance(
                                order.getStartLocation().getLatitude(), order.getStartLocation().getLongitude(),
                                order.getEndLocation().getLatitude(), order.getEndLocation().getLongitude()
                        );
                        remainingTripDistKm = (1.0 - order.getProgress()) * totalDist;
                    }

                    double distFromEndToBrokenKm = physicsService.calculateDistance(
                            order.getEndLocation().getLatitude(), order.getEndLocation().getLongitude(),
                            targetLat, targetLng
                    );

                    double totalDistKm = remainingTripDistKm + distFromEndToBrokenKm;
                    double etaMinutes = (totalDistKm / TRUCK_SPEED_KMH) * 60;

                    candidates.add(new RescueCandidateDTO(v.getId(), v.getPlateNumber(), v.getBrand(), "B", totalDistKm, etaMinutes, "W Trasie (" + Math.round(order.getProgress() * 100) + "%)"));
                }
            }
        }

        candidates.sort(Comparator.comparing(RescueCandidateDTO::etaMinutes));
        return candidates;
    }

    @Transactional
    public void autoAssignRescue(Long brokenVehicleId) {
        Vehicle brokenVehicle = vehicleRepository.findById(brokenVehicleId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono pojazdu"));

        Order cargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(brokenVehicle.getId()))
                .findFirst().orElse(null);

        if (cargoOrder == null && brokenVehicle.getTargetRescueId() != null) {
            Long originalWrakId = brokenVehicle.getTargetRescueId();

            brokenVehicle.setStatus("WAITING_FOR_TOW");
            brokenVehicle.setTargetRescueId(null);
            vehicleRepository.save(brokenVehicle);

            orderRepository.findByStatusIn(List.of("RESCUE_APPROACHING"))
                    .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(brokenVehicle.getId()))
                    .findFirst().ifPresent(orderRepository::delete);

            dispatchTowTruck(brokenVehicle);

            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");

            autoAssignRescue(originalWrakId);
            return;
        }

        if (brokenVehicle.getTargetRescueId() != null) {
            Long originalWrakId = brokenVehicle.getTargetRescueId();
            brokenVehicle.setTargetRescueId(null);
            vehicleRepository.save(brokenVehicle);
            autoAssignRescue(originalWrakId);
        }

        List<RescueCandidateDTO> candidates = scanForCandidates(brokenVehicle.getId());
        if (!candidates.isEmpty()) {
            assignRescue(candidates.get(0).vehicleId(), brokenVehicle.getId());
        }

        dispatchTowTruck(brokenVehicle);
    }

    private void dispatchTowTruck(Vehicle brokenVehicle) {
        Vehicle msu = vehicleRepository.findAll().stream()
                .filter(v -> Boolean.TRUE.equals(v.getIsServiceUnit()) && "AVAILABLE".equals(v.getStatus()))
                .min(Comparator.comparingDouble(v -> physicsService.calculateDistance(v.getCurrentLat(), v.getCurrentLng(), brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng())))
                .orElse(null);

        if (msu != null) {
            RoutingService.RouteInfo route = routingService.getRoute(
                    msu.getCurrentLat(), msu.getCurrentLng(),
                    brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng()
            );

            Driver driver = driverRepository.findByAssignedVehicleId(msu.getId()).orElse(null);

            Order towOrder = new Order();
            towOrder.setVehicle(msu);
            towOrder.setDriver(driver);
            towOrder.setStatus("TOW_APPROACHING");
            towOrder.setStartLatApproaching(msu.getCurrentLat());
            towOrder.setStartLngApproaching(msu.getCurrentLng());
            towOrder.setRoutePolylineApproaching(route != null ? route.polyline() : "");
            towOrder.setRouteDistanceApproaching(route != null ? route.distance() : 0.0);
            towOrder.setProgress(0.0);
            towOrder.setGpsDistance(0.0);

            msu.setStatus("TOW_APPROACHING");
            msu.setTargetTowId(brokenVehicle.getId());

            if (driver != null) { driver.setStatus("BUSY"); driverRepository.save(driver); }

            vehicleRepository.save(msu);
            orderRepository.save(towOrder);

            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
        }
    }

    @Transactional
    public void assignRescue(Long rescuerId, Long brokenVehicleId) {
        Vehicle rescuer = vehicleRepository.findById(rescuerId).orElseThrow();
        Vehicle broken = vehicleRepository.findById(brokenVehicleId).orElseThrow();

        Order brokenOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(broken.getId()))
                .findFirst().orElseThrow(() -> new IllegalArgumentException("Uszkodzony pojazd nie ma aktywnego zlecenia."));

        double targetLat = broken.getCurrentLat();
        double targetLng = broken.getCurrentLng();
        if ("APPROACHING".equals(brokenOrder.getStatus())) {
            targetLat = brokenOrder.getStartLocation().getLatitude();
            targetLng = brokenOrder.getStartLocation().getLongitude();
        }

        if ("AVAILABLE".equals(rescuer.getStatus())) {
            Driver driver = driverRepository.findByAssignedVehicleId(rescuer.getId()).orElse(null);

            if ("APPROACHING".equals(brokenOrder.getStatus())) {
                RoutingService.RouteInfo route = routingService.getRoute(
                        rescuer.getCurrentLat(), rescuer.getCurrentLng(),
                        targetLat, targetLng
                );

                brokenOrder.setVehicle(rescuer);
                brokenOrder.setDriver(driver);
                brokenOrder.setRoutePolylineApproaching(route != null ? route.polyline() : "");
                brokenOrder.setRouteDistanceApproaching(route != null ? route.distance() : 0.0);
                brokenOrder.setProgress(0.0);

                rescuer.setStatus("BUSY");
                broken.setStatus("WAITING_FOR_TOW");

                if (driver != null) { driver.setStatus("BUSY"); driverRepository.save(driver); }
                orderRepository.save(brokenOrder);
            } else {
                RoutingService.RouteInfo route = routingService.getRoute(
                        rescuer.getCurrentLat(), rescuer.getCurrentLng(),
                        targetLat, targetLng
                );

                Order technicalOrder = new Order();
                technicalOrder.setVehicle(rescuer);
                technicalOrder.setDriver(driver);
                technicalOrder.setStatus("RESCUE_APPROACHING");
                technicalOrder.setStartLatApproaching(rescuer.getCurrentLat());
                technicalOrder.setStartLngApproaching(rescuer.getCurrentLng());
                technicalOrder.setRoutePolylineApproaching(route != null ? route.polyline() : "");
                technicalOrder.setRouteDistanceApproaching(route != null ? route.distance() : 0.0);
                technicalOrder.setProgress(0.0);
                technicalOrder.setGpsDistance(0.0);

                rescuer.setStatus("RESCUE_MISSION");
                rescuer.setTargetRescueId(broken.getId());

                if (driver != null) { driver.setStatus("BUSY"); driverRepository.save(driver); }
                orderRepository.save(technicalOrder);
            }
            vehicleRepository.save(rescuer);
            vehicleRepository.save(broken);

        } else if ("BUSY".equals(rescuer.getStatus())) {
            rescuer.setTargetRescueId(broken.getId());

            Order currentOrder = orderRepository.findByStatusIn(List.of("IN_TRANSIT", "APPROACHING", "LOADING"))
                    .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(rescuer.getId()))
                    .findFirst().orElseThrow();

            RoutingService.RouteInfo route = routingService.getRoute(
                    currentOrder.getEndLocation().getLatitude(), currentOrder.getEndLocation().getLongitude(),
                    targetLat, targetLng
            );
            rescuer.setRescuePolyline(route != null ? route.polyline() : null);
            rescuer.setRescueDistance(route != null ? route.distance() : 0.0);

            vehicleRepository.save(rescuer);

            if ("APPROACHING".equals(brokenOrder.getStatus())) {
                broken.setStatus("WAITING_FOR_TOW");
                vehicleRepository.save(broken);
            }
        } else {
            throw new IllegalArgumentException("Pojazd w tym statusie nie może przyjąć misji ratunkowej.");
        }

        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
    }
}