package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.simulation.PhysicsService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
    private final LocationRepository locationRepository;
    private final PhysicsService physicsService;
    private final RoutingService routingService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final double TRUCK_SPEED_KMH = 80.0;
    private static final int OLE_MAX_RETRIES = 5;
    private static final long OLE_RETRY_DELAY_MS = 200;

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
    public void releaseRescueTarget(Long vehicleId) {
        Vehicle v = vehicleRepository.findById(vehicleId).orElse(null);
        if (v != null) {
            v.setStatus("WAITING_FOR_TOW");
            v.setTargetRescueId(null);
            vehicleRepository.save(v);
            orderRepository.findByStatusIn(List.of("RESCUE_APPROACHING"))
                    .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(vehicleId))
                    .findFirst().ifPresent(orderRepository::delete);
        }
    }

    public void autoAssignRescue(Long brokenVehicleId) {
        Vehicle brokenVehicle = vehicleRepository.findById(brokenVehicleId).orElse(null);
        if (brokenVehicle == null) return;

        Order cargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(brokenVehicleId))
                .findFirst().orElse(null);

        if (cargoOrder == null && brokenVehicle.getTargetRescueId() != null) {
            Long originalWrakId = brokenVehicle.getTargetRescueId();
            releaseRescueTarget(brokenVehicleId);
            dispatchTowTruck(brokenVehicleId);

            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");

            autoAssignRescue(originalWrakId);
            return;
        }

        if (brokenVehicle.getTargetRescueId() != null) {
            Long originalWrakId = brokenVehicle.getTargetRescueId();
            releaseRescueTarget(brokenVehicleId);
            autoAssignRescue(originalWrakId);
            return;
        }

        List<RescueCandidateDTO> candidates = scanForCandidates(brokenVehicleId);
        if (!candidates.isEmpty()) {
            assignRescue(candidates.get(0).vehicleId(), brokenVehicleId);
        }

        dispatchTowTruck(brokenVehicleId);
    }

    private void dispatchTowTruck(Long brokenVehicleId) {
        Vehicle brokenVehicle = vehicleRepository.findById(brokenVehicleId).orElse(null);
        if (brokenVehicle == null) return;

        boolean alreadyTargeted = vehicleRepository.findAll().stream()
                .anyMatch(v -> Boolean.TRUE.equals(v.getIsServiceUnit()) &&
                        (brokenVehicleId.equals(v.getTargetTowId()) || brokenVehicleId.equals(v.getNextTowTargetId())));
        if (alreadyTargeted) return;

        Vehicle availableMsu = vehicleRepository.findAll().stream()
                .filter(v -> Boolean.TRUE.equals(v.getIsServiceUnit()) && "AVAILABLE".equals(v.getStatus()) && v.getNextTowTargetId() == null)
                .min(Comparator.comparingDouble(v -> physicsService.calculateDistance(v.getCurrentLat(), v.getCurrentLng(), brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng())))
                .orElse(null);

        if (availableMsu != null) {
            RoutingService.RouteInfo route = routingService.getRoute(
                    availableMsu.getCurrentLat(), availableMsu.getCurrentLng(),
                    brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng()
            );
            applyTowDispatch(availableMsu.getId(), brokenVehicleId, route);
        } else {
            queueMsuJob(brokenVehicle);
        }

        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
    }

    @Transactional
    public void applyTowDispatch(Long msuId, Long brokenId, RoutingService.RouteInfo route) {
        Vehicle msu = vehicleRepository.findById(msuId).orElse(null);
        if (msu == null || !"AVAILABLE".equals(msu.getStatus())) return;

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
        msu.setTargetTowId(brokenId);

        if (driver != null) { driver.setStatus("BUSY"); driverRepository.save(driver); }
        vehicleRepository.save(msu);
        orderRepository.save(towOrder);
    }

    private void queueMsuJob(Vehicle brokenVehicle) {
        List<Vehicle> busyMsuList = vehicleRepository.findAll().stream()
                .filter(v -> Boolean.TRUE.equals(v.getIsServiceUnit()) &&
                        ("TOW_APPROACHING".equals(v.getStatus()) || "TOWING".equals(v.getStatus()) || "WAITING_FOR_CARGO_CLEARANCE".equals(v.getStatus())) &&
                        v.getNextTowTargetId() == null)
                .toList();

        if (busyMsuList.isEmpty()) return;

        record MsuCandidate(Vehicle msu, double estimatedTotalDistance, Location projectedEndBase) {}

        List<MsuCandidate> candidates = new ArrayList<>();

        for (Vehicle msu : busyMsuList) {
            double currentTaskRemainingKm = 0.0;
            Location projectedEndBase = null;

            Order activeTowOrder = orderRepository.findByStatusIn(List.of("TOW_APPROACHING", "TOWING", "WAITING_FOR_CARGO_CLEARANCE"))
                    .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(msu.getId()))
                    .findFirst().orElse(null);

            if (activeTowOrder != null) {
                if ("TOWING".equals(activeTowOrder.getStatus()) && activeTowOrder.getEndLocation() != null) {
                    projectedEndBase = activeTowOrder.getEndLocation();
                    double totalDist = activeTowOrder.getRouteDistanceTransit() != null ? activeTowOrder.getRouteDistanceTransit() / 1000.0 : 0.0;
                    currentTaskRemainingKm = totalDist * (1.0 - (activeTowOrder.getProgress() != null ? activeTowOrder.getProgress() : 0));
                } else if ("TOW_APPROACHING".equals(activeTowOrder.getStatus()) || "WAITING_FOR_CARGO_CLEARANCE".equals(activeTowOrder.getStatus())) {
                    Vehicle currentTarget = vehicleRepository.findById(msu.getTargetTowId()).orElse(null);
                    if (currentTarget != null) {
                        projectedEndBase = locationRepository.findAll().stream()
                                .filter(l -> "BASE".equals(l.getType()))
                                .min(Comparator.comparingDouble(l -> physicsService.calculateDistance(currentTarget.getCurrentLat(), currentTarget.getCurrentLng(), l.getLatitude(), l.getLongitude())))
                                .orElse(null);

                        double approachRemaining = 0.0;
                        if ("TOW_APPROACHING".equals(activeTowOrder.getStatus())) {
                            double approachTotal = activeTowOrder.getRouteDistanceApproaching() != null ? activeTowOrder.getRouteDistanceApproaching() / 1000.0 : 0.0;
                            approachRemaining = approachTotal * (1.0 - (activeTowOrder.getProgress() != null ? activeTowOrder.getProgress() : 0));
                        }

                        double towingDist = 0.0;
                        if (projectedEndBase != null) {
                            towingDist = physicsService.calculateDistance(currentTarget.getCurrentLat(), currentTarget.getCurrentLng(), projectedEndBase.getLatitude(), projectedEndBase.getLongitude());
                        }

                        currentTaskRemainingKm = approachRemaining + towingDist;
                    }
                }
            }

            if (projectedEndBase != null) {
                double distToNewBroken = physicsService.calculateDistance(projectedEndBase.getLatitude(), projectedEndBase.getLongitude(), brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng());
                candidates.add(new MsuCandidate(msu, currentTaskRemainingKm + distToNewBroken, projectedEndBase));
            }
        }

        candidates.sort(Comparator.comparingDouble(MsuCandidate::estimatedTotalDistance));
        if (candidates.isEmpty()) return;
        List<MsuCandidate> top3 = candidates.subList(0, Math.min(3, candidates.size()));

        MsuCandidate bestCandidate = null;
        RoutingService.RouteInfo bestRoute = null;
        double minRealDistance = Double.MAX_VALUE;

        for (MsuCandidate cand : top3) {
            RoutingService.RouteInfo route = routingService.getRoute(
                    cand.projectedEndBase().getLatitude(), cand.projectedEndBase().getLongitude(),
                    brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng()
            );

            if (route != null) {
                double realTotal = cand.estimatedTotalDistance() - physicsService.calculateDistance(cand.projectedEndBase().getLatitude(), cand.projectedEndBase().getLongitude(), brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng()) + (route.distance() / 1000.0);
                if (realTotal < minRealDistance) {
                    minRealDistance = realTotal;
                    bestCandidate = cand;
                    bestRoute = route;
                }
            }
        }

        if (bestCandidate != null && bestRoute != null) {
            applyMsuQueueWithRetry(bestCandidate.msu().getId(), brokenVehicle.getId(), bestRoute);
        }
    }

    private void applyMsuQueueWithRetry(Long msuId, Long brokenId, RoutingService.RouteInfo route) {
        for (int attempt = 0; attempt < OLE_MAX_RETRIES; attempt++) {
            try {
                applyMsuQueue(msuId, brokenId, route);
                return;
            } catch (ObjectOptimisticLockingFailureException e) {
                if (attempt == OLE_MAX_RETRIES - 1) throw e;
                try { Thread.sleep(OLE_RETRY_DELAY_MS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
        }
    }

    @Transactional
    public void applyMsuQueue(Long msuId, Long brokenId, RoutingService.RouteInfo route) {
        Vehicle msu = vehicleRepository.findById(msuId).orElse(null);
        if (msu != null && msu.getNextTowTargetId() == null) {
            msu.setNextTowTargetId(brokenId);
            msu.setNextTowPolyline(route.polyline());
            msu.setNextTowDistance(route.distance());
            vehicleRepository.save(msu);
        }
    }

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

        RoutingService.RouteInfo route;
        if ("AVAILABLE".equals(rescuer.getStatus()) || "BUSY".equals(rescuer.getStatus())) {
            double startLat = rescuer.getCurrentLat();
            double startLng = rescuer.getCurrentLng();
            if ("BUSY".equals(rescuer.getStatus())) {
                Order currentOrder = orderRepository.findByStatusIn(List.of("IN_TRANSIT", "APPROACHING", "LOADING"))
                        .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(rescuer.getId()))
                        .findFirst().orElse(null);
                if (currentOrder != null && currentOrder.getEndLocation() != null) {
                    startLat = currentOrder.getEndLocation().getLatitude();
                    startLng = currentOrder.getEndLocation().getLongitude();
                }
            }
            route = routingService.getRoute(startLat, startLng, targetLat, targetLng);
        } else {
            return;
        }

        applyRescueAssignment(rescuer.getId(), broken.getId(), route);

        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
    }

    @Transactional
    public void applyRescueAssignment(Long rescuerId, Long brokenId, RoutingService.RouteInfo route) {
        Vehicle rescuer = vehicleRepository.findById(rescuerId).orElse(null);
        Vehicle broken = vehicleRepository.findById(brokenId).orElse(null);
        if (rescuer == null || broken == null) return;

        Order brokenOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(broken.getId()))
                .findFirst().orElse(null);

        if (brokenOrder == null) return;

        if ("AVAILABLE".equals(rescuer.getStatus())) {
            Driver driver = driverRepository.findByAssignedVehicleId(rescuer.getId()).orElse(null);

            if ("APPROACHING".equals(brokenOrder.getStatus())) {
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
            rescuer.setRescuePolyline(route != null ? route.polyline() : null);
            rescuer.setRescueDistance(route != null ? route.distance() : 0.0);
            vehicleRepository.save(rescuer);

            if ("APPROACHING".equals(brokenOrder.getStatus())) {
                broken.setStatus("WAITING_FOR_TOW");
                vehicleRepository.save(broken);
            }
        }
    }
}