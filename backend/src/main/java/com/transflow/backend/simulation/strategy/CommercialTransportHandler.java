package com.transflow.backend.simulation.strategy;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.logistics.RoutingService;
import com.transflow.backend.simulation.PhysicsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class CommercialTransportHandler implements OrderStateHandler {

    private final PhysicsService physicsService;
    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final RoutingService routingService;

    @Override
    public boolean supports(String status) {
        return List.of("APPROACHING", "LOADING", "IN_TRANSIT").contains(status);
    }

    @Override
    public void handle(Order order, double distanceInTickMeters, double distanceInTickKm, SimulationUpdateContext ctx) {
        Vehicle vehicle = order.getVehicle();
        String status = order.getStatus();

        if ("APPROACHING".equals(status)) {
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
                ctx.setBroadcastOrders(true);
            }

        } else if ("LOADING".equals(status)) {
            int remaining = order.getLoadingTicksRemaining() != null ? order.getLoadingTicksRemaining() : 0;
            if (remaining <= 1) {
                order.setStatus("IN_TRANSIT");
                order.setProgress(0.0);
                order.setLoadingTicksRemaining(0);
                ctx.setBroadcastOrders(true);
            } else {
                order.setLoadingTicksRemaining(remaining - 1);
            }

        } else if ("IN_TRANSIT".equals(status)) {
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

                            ctx.addOrder(brokenCargoOrder);
                            ctx.addVehicle(brokenVehicle);
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
                            ctx.addOrder(technicalOrder);
                        } else {
                            vehicle.setStatus("AVAILABLE");
                            vehicle.setTargetRescueId(null);
                        }
                    } else {
                        vehicle.setStatus("AVAILABLE");
                        vehicle.setTargetRescueId(null);
                    }
                    ctx.setBroadcastOrders(true);
                } else {
                    order.setStatus("COMPLETED");
                    vehicle.setStatus("AVAILABLE");
                    ctx.setBroadcastOrders(true);
                    ctx.setBroadcastVehicles(true);
                }
            }
        }
    }
}