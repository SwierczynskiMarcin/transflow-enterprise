package com.transflow.backend.simulation;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SimulationEngine {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VirtualClock virtualClock;
    private final PhysicsService physicsService;

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

        List<Order> activeOrders = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT"));

        List<VehicleSimulationDTO> tickUpdates = new ArrayList<>();
        List<Order> ordersToSave = new ArrayList<>();
        Set<Vehicle> vehiclesToSave = new HashSet<>();

        try {
            for (Order order : activeOrders) {
                Vehicle vehicle = order.getVehicle();

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
                        double totalDist = physicsService.calculateDistance(order.getStartLatApproaching(), order.getStartLngApproaching(),
                                order.getStartLocation().getLatitude(), order.getStartLocation().getLongitude());
                        if (totalDist < 0.1) { order.setProgress(1.0); }
                        else {
                            double progressIncrement = distanceInTickKm / totalDist;
                            order.setProgress(Math.min(1.0, order.getProgress() + progressIncrement));
                            vehicle.setCurrentLat(order.getStartLatApproaching() + (order.getStartLocation().getLatitude() - order.getStartLatApproaching()) * order.getProgress());
                            vehicle.setCurrentLng(order.getStartLngApproaching() + (order.getStartLocation().getLongitude() - order.getStartLngApproaching()) * order.getProgress());
                        }
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
                } else if ("IN_TRANSIT".equals(order.getStatus())) {
                    if (order.getRoutePolylineTransit() != null && order.getRouteDistanceTransit() != null && order.getRouteDistanceTransit() > 0) {
                        double addedProgress = distanceInTickMeters / order.getRouteDistanceTransit();
                        order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                        double targetDistMeters = order.getProgress() * order.getRouteDistanceTransit();
                        double[] newPos = physicsService.getPositionAtDistance(order.getRoutePolylineTransit(), targetDistMeters);

                        vehicle.setCurrentLat(newPos[0]);
                        vehicle.setCurrentLng(newPos[1]);
                    } else {
                        double totalDist = physicsService.calculateDistance(order.getStartLocation().getLatitude(), order.getStartLocation().getLongitude(),
                                order.getEndLocation().getLatitude(), order.getEndLocation().getLongitude());
                        if (totalDist < 0.1) { order.setProgress(1.0); }
                        else {
                            double progressIncrement = distanceInTickKm / totalDist;
                            order.setProgress(Math.min(1.0, order.getProgress() + progressIncrement));
                            vehicle.setCurrentLat(order.getStartLocation().getLatitude() + (order.getEndLocation().getLatitude() - order.getStartLocation().getLatitude()) * order.getProgress());
                            vehicle.setCurrentLng(order.getStartLocation().getLongitude() + (order.getEndLocation().getLongitude() - order.getStartLocation().getLongitude()) * order.getProgress());
                        }
                    }

                    vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
                    order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

                    if (order.getProgress() >= 1.0) {
                        order.setStatus("COMPLETED");
                        vehicle.setStatus("AVAILABLE");
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
}