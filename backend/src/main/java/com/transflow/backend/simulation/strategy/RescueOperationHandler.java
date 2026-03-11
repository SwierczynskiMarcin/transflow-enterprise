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
public class RescueOperationHandler implements OrderStateHandler {

    private final PhysicsService physicsService;
    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final RoutingService routingService;

    @Override
    public boolean supports(String status) {
        return List.of("RESCUE_APPROACHING", "HANDOVER").contains(status);
    }

    @Override
    public void handle(Order order, double distanceInTickMeters, double distanceInTickKm, SimulationUpdateContext ctx) {
        Vehicle vehicle = order.getVehicle();
        String status = order.getStatus();

        if ("RESCUE_APPROACHING".equals(status)) {
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

                        ctx.addOrder(brokenCargoOrder);
                        ctx.addVehicle(brokenVehicle);
                    } else {
                        vehicle.setStatus("AVAILABLE");
                        vehicle.setTargetRescueId(null);
                    }
                } else {
                    vehicle.setStatus("AVAILABLE");
                    vehicle.setTargetRescueId(null);
                }
                ctx.setBroadcastOrders(true);
                ctx.setBroadcastVehicles(true);
            }

        } else if ("HANDOVER".equals(status)) {
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
                ctx.setBroadcastOrders(true);
                ctx.setBroadcastVehicles(true);
            } else {
                order.setLoadingTicksRemaining(remaining - 1);
            }
        }
    }
}