package com.transflow.backend.simulation;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
import com.transflow.backend.logistics.LocationRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.logistics.RoutingService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SimulationEngine {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final LocationRepository locationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VirtualClock virtualClock;
    private final PhysicsService physicsService;
    private final RoutingService routingService;

    private final double TRUCK_SPEED_KMH = 80.0;
    private final int TICK_RATE_SECONDS = 2;

    @Getter @Setter
    private boolean isRunning = true;

    @Getter @Setter
    private double timeMultiplier = 60.0;

    @Scheduled(fixedRate = 2000)
    @Transactional
    public void simulateMovement() {
        messagingTemplate.convertAndSend("/topic/simulation",
                new SimulationStateDTO(isRunning, timeMultiplier, virtualClock.getCurrentTime()));

        if (!isRunning) return;

        virtualClock.advanceTime(TICK_RATE_SECONDS, timeMultiplier);

        List<Order> activeOrders = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "RESCUE_APPROACHING", "HANDOVER", "TOW_APPROACHING", "WAITING_FOR_CARGO_CLEARANCE", "TOWING"));

        List<VehicleSimulationDTO> tickUpdates = new ArrayList<>();
        List<Order> ordersToSave = new ArrayList<>();
        Set<Vehicle> vehiclesToSave = new HashSet<>();

        try {
            for (Order order : activeOrders) {
                Vehicle vehicle = order.getVehicle();

                if ("BROKEN".equals(vehicle.getStatus()) || "WAITING_FOR_TOW".equals(vehicle.getStatus()) || "BEING_TOWED".equals(vehicle.getStatus())) {
                    tickUpdates.add(new VehicleSimulationDTO(
                            vehicle.getId(), vehicle.getPlateNumber(), vehicle.getBrand(), vehicle.getModel(),
                            vehicle.getCurrentLat(), vehicle.getCurrentLng(), vehicle.getStatus(), order.getStatus(),
                            order.getProgress(), order.getGpsDistance()
                    ));
                    continue;
                }

                if (order.getProgress() == null) order.setProgress(0.0);
                if (order.getGpsDistance() == null) order.setGpsDistance(0.0);

                if (order.getStartLatApproaching() == null) order.setStartLatApproaching(vehicle.getCurrentLat() != null ? vehicle.getCurrentLat() : 52.0);
                if (order.getStartLngApproaching() == null) order.setStartLngApproaching(vehicle.getCurrentLng() != null ? vehicle.getCurrentLng() : 19.0);

                double hoursPassed = (TICK_RATE_SECONDS * timeMultiplier) / 3600.0;
                double distanceInTickKm = TRUCK_SPEED_KMH * hoursPassed;
                double distanceInTickMeters = distanceInTickKm * 1000.0;

                if ("APPROACHING".equals(order.getStatus())) {
                    if (order.getRoutePolylineApproaching() != null && order.getRouteDistanceApproaching() != null && order.getRouteDistanceApproaching() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceApproaching();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceApproaching();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineApproaching(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        order.setProgress(1.0);
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        order.setStatus("LOADING");
                        order.setProgress(0.0);
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                    }

                } else if ("LOADING".equals(order.getStatus())) {
                    int remaining = order.getLoadingTicksRemaining() != null ? order.getLoadingTicksRemaining() : 0;
                    if (remaining <= 1) {
                        order.setStatus("IN_TRANSIT");
                        order.setProgress(0.0);
                        order.setLoadingTicksRemaining(0);
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                    } else {
                        order.setLoadingTicksRemaining(remaining - 1);
                    }
                } else if ("HANDOVER".equals(order.getStatus())) {
                    int remaining = order.getLoadingTicksRemaining() != null ? order.getLoadingTicksRemaining() : 0;
                    if (remaining <= 1) {
                        RoutingService.RouteInfo route = routingService.getRoute(
                                vehicle.getCurrentLat(), vehicle.getCurrentLng(),
                                order.getEndLocation().getLatitude(), order.getEndLocation().getLongitude()
                        );
                        if (route != null) {
                            order.setRoutePolylineTransit(route.polyline());
                            order.setRouteDistanceTransit(route.distance());
                        }
                        order.setStatus("IN_TRANSIT");
                        order.setProgress(0.0);
                        order.setLoadingTicksRemaining(0);
                        vehicle.setStatus("BUSY");
                        vehicle.setTargetRescueId(null);
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                    } else {
                        order.setLoadingTicksRemaining(remaining - 1);
                    }
                } else if ("IN_TRANSIT".equals(order.getStatus())) {
                    if (order.getRoutePolylineTransit() != null && order.getRouteDistanceTransit() != null && order.getRouteDistanceTransit() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceTransit();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceTransit();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineTransit(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        order.setProgress(1.0);
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        if (vehicle.getTargetRescueId() != null) {
                            order.setStatus("COMPLETED");
                            Vehicle brokenVehicle = vehicleRepository.findById(vehicle.getTargetRescueId()).orElse(null);

                            if (brokenVehicle != null) {
                                Order brokenCargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                                        .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(brokenVehicle.getId()))
                                        .findFirst().orElse(null);

                                if (brokenCargoOrder != null && "APPROACHING".equals(brokenCargoOrder.getStatus())) {
                                    RoutingService.RouteInfo route = routingService.getRoute(
                                            vehicle.getCurrentLat(), vehicle.getCurrentLng(),
                                            brokenCargoOrder.getStartLocation().getLatitude(), brokenCargoOrder.getStartLocation().getLongitude()
                                    );
                                    brokenCargoOrder.setVehicle(vehicle);
                                    brokenCargoOrder.setDriver(order.getDriver());
                                    brokenCargoOrder.setRoutePolylineApproaching(route != null ? route.polyline() : "");
                                    brokenCargoOrder.setRouteDistanceApproaching(route != null ? route.distance() : 0.0);
                                    brokenCargoOrder.setProgress(0.0);
                                    brokenVehicle.setStatus("WAITING_FOR_TOW");
                                    vehicle.setStatus("BUSY");
                                    vehicle.setTargetRescueId(null);

                                    ordersToSave.add(brokenCargoOrder);
                                    vehiclesToSave.add(brokenVehicle);
                                } else if (brokenCargoOrder != null) {
                                    Order technicalOrder = new Order();
                                    technicalOrder.setVehicle(vehicle);
                                    technicalOrder.setDriver(order.getDriver());
                                    technicalOrder.setStatus("RESCUE_APPROACHING");
                                    technicalOrder.setStartLatApproaching(vehicle.getCurrentLat());
                                    technicalOrder.setStartLngApproaching(vehicle.getCurrentLng());

                                    RoutingService.RouteInfo route = routingService.getRoute(
                                            vehicle.getCurrentLat(), vehicle.getCurrentLng(),
                                            brokenVehicle.getCurrentLat(), brokenVehicle.getCurrentLng()
                                    );

                                    technicalOrder.setRoutePolylineApproaching(route != null ? route.polyline() : "");
                                    technicalOrder.setRouteDistanceApproaching(route != null ? route.distance() : 0.0);
                                    technicalOrder.setProgress(0.0);
                                    technicalOrder.setGpsDistance(0.0);

                                    vehicle.setStatus("RESCUE_MISSION");
                                    ordersToSave.add(technicalOrder);
                                } else {
                                    vehicle.setStatus("AVAILABLE");
                                    vehicle.setTargetRescueId(null);
                                }
                            } else {
                                vehicle.setStatus("AVAILABLE");
                                vehicle.setTargetRescueId(null);
                            }
                            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                        } else {
                            order.setStatus("COMPLETED");
                            vehicle.setStatus("AVAILABLE");
                            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                        }
                    }
                } else if ("RESCUE_APPROACHING".equals(order.getStatus())) {
                    if (order.getRoutePolylineApproaching() != null && order.getRouteDistanceApproaching() != null && order.getRouteDistanceApproaching() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceApproaching();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceApproaching();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineApproaching(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        order.setProgress(1.0);
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        order.setStatus("COMPLETED");
                        Vehicle brokenVehicle = vehicleRepository.findById(vehicle.getTargetRescueId()).orElse(null);

                        if (brokenVehicle != null) {
                            Order brokenCargoOrder = orderRepository.findByStatusIn(List.of("IN_TRANSIT", "LOADING", "HANDOVER"))
                                    .stream().filter(o -> o.getVehicle() != null && o.getVehicle().getId().equals(brokenVehicle.getId()))
                                    .findFirst().orElse(null);

                            if (brokenCargoOrder != null) {
                                brokenCargoOrder.setVehicle(vehicle);
                                brokenCargoOrder.setDriver(order.getDriver());
                                brokenCargoOrder.setStatus("HANDOVER");
                                brokenCargoOrder.setLoadingTicksRemaining(5);
                                vehicle.setStatus("HANDOVER");
                                brokenVehicle.setStatus("WAITING_FOR_TOW");

                                ordersToSave.add(brokenCargoOrder);
                                vehiclesToSave.add(brokenVehicle);
                            } else {
                                vehicle.setStatus("AVAILABLE");
                                vehicle.setTargetRescueId(null);
                            }
                        } else {
                            vehicle.setStatus("AVAILABLE");
                            vehicle.setTargetRescueId(null);
                        }
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                    }
                } else if ("TOW_APPROACHING".equals(order.getStatus())) {
                    if (order.getRoutePolylineApproaching() != null && order.getRouteDistanceApproaching() != null && order.getRouteDistanceApproaching() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceApproaching();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceApproaching();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineApproaching(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        order.setProgress(1.0);
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        Vehicle target = vehicleRepository.findById(vehicle.getTargetTowId()).orElse(null);
                        if (target != null) {
                            boolean hasRescuer = vehicleRepository.findAll().stream()
                                    .anyMatch(v -> target.getId().equals(v.getTargetRescueId()));
                            boolean hasCargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                                    .stream().anyMatch(o -> o.getVehicle() != null && o.getVehicle().getId().equals(target.getId()));

                            if (!hasRescuer && !hasCargoOrder) {
                                startTowing(vehicle, target, order);
                            } else {
                                order.setStatus("WAITING_FOR_CARGO_CLEARANCE");
                                vehicle.setStatus("WAITING_FOR_CARGO_CLEARANCE");
                            }
                        } else {
                            order.setStatus("COMPLETED");
                            vehicle.setStatus("AVAILABLE");
                            vehicle.setTargetTowId(null);
                        }
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                    }
                } else if ("WAITING_FOR_CARGO_CLEARANCE".equals(order.getStatus())) {
                    Vehicle target = vehicleRepository.findById(vehicle.getTargetTowId()).orElse(null);
                    if (target != null) {
                        boolean hasRescuer = vehicleRepository.findAll().stream()
                                .anyMatch(v -> target.getId().equals(v.getTargetRescueId()));
                        boolean hasCargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                                .stream().anyMatch(o -> o.getVehicle() != null && o.getVehicle().getId().equals(target.getId()));

                        if (!hasRescuer && !hasCargoOrder) {
                            startTowing(vehicle, target, order);
                            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                        }
                    } else {
                        order.setStatus("COMPLETED");
                        vehicle.setStatus("AVAILABLE");
                        vehicle.setTargetTowId(null);
                    }
                } else if ("TOWING".equals(order.getStatus())) {
                    if (order.getRoutePolylineTransit() != null && order.getRouteDistanceTransit() != null && order.getRouteDistanceTransit() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceTransit();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceTransit();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineTransit(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        order.setProgress(1.0);
                    }

                    Vehicle target = vehicleRepository.findById(vehicle.getTargetTowId()).orElse(null);
                    if (target != null) {
                        target.setCurrentLat(vehicle.getCurrentLat());
                        target.setCurrentLng(vehicle.getCurrentLng());
                        vehiclesToSave.add(target);

                        tickUpdates.add(new VehicleSimulationDTO(
                                target.getId(), target.getPlateNumber(), target.getBrand(), target.getModel(),
                                target.getCurrentLat(), target.getCurrentLng(), target.getStatus(), null,
                                0.0, 0.0
                        ));
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        order.setStatus("COMPLETED");
                        vehicle.setStatus("AVAILABLE");
                        vehicle.setTargetTowId(null);
                        if (target != null) {
                            target.setStatus("AVAILABLE");
                        }
                        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                    }
                }

                vehiclesToSave.add(vehicle);
                ordersToSave.add(order);

                tickUpdates.add(new VehicleSimulationDTO(
                        vehicle.getId(), vehicle.getPlateNumber(), vehicle.getBrand(), vehicle.getModel(),
                        vehicle.getCurrentLat(), vehicle.getCurrentLng(), vehicle.getStatus(), order.getStatus(),
                        order.getProgress(), order.getGpsDistance()
                ));
            }

            if (!vehiclesToSave.isEmpty()) {
                vehicleRepository.saveAll(vehiclesToSave);
            }
            if (!ordersToSave.isEmpty()) {
                orderRepository.saveAll(ordersToSave);
            }

            if (!tickUpdates.isEmpty()) {
                messagingTemplate.convertAndSend("/topic/trucks", tickUpdates);
            }

        } catch (ObjectOptimisticLockingFailureException e) {
            System.err.println("[SimulationEngine] Tick pominięty: Wykryto współbieżną modyfikację danych (Optimistic Lock).");
        }
    }

    private void startTowing(Vehicle towTruck, Vehicle target, Order order) {
        Location nearestBase = locationRepository.findAll().stream()
                .filter(l -> "BASE".equals(l.getType()))
                .min(Comparator.comparingDouble(l -> physicsService.calculateDistance(towTruck.getCurrentLat(), towTruck.getCurrentLng(), l.getLatitude(), l.getLongitude())))
                .orElse(null);

        if (nearestBase != null) {
            RoutingService.RouteInfo route = routingService.getRoute(towTruck.getCurrentLat(), towTruck.getCurrentLng(), nearestBase.getLatitude(), nearestBase.getLongitude());
            if (route != null) {
                order.setRoutePolylineTransit(route.polyline());
                order.setRouteDistanceTransit(route.distance());
                order.setEndLocation(nearestBase);
            }
        }
        order.setStatus("TOWING");
        order.setProgress(0.0);
        towTruck.setStatus("TOWING");
        target.setStatus("BEING_TOWED");
    }
}