package com.transflow.backend.simulation.strategy;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
import com.transflow.backend.logistics.LocationRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.logistics.RoutingService;
import com.transflow.backend.simulation.PhysicsService;
import com.transflow.backend.simulation.VehicleSimulationDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TowingOperationHandler implements OrderStateHandler {

    private final PhysicsService physicsService;
    private final VehicleRepository vehicleRepository;
    private final OrderRepository orderRepository;
    private final LocationRepository locationRepository;
    private final RoutingService routingService;
    private final DriverRepository driverRepository;

    @Override
    public boolean supports(String status) {
        return List.of("TOW_APPROACHING", "WAITING_FOR_CARGO_CLEARANCE", "TOWING").contains(status);
    }

    @Override
    public void handle(Order order, double distanceInTickMeters, double distanceInTickKm, SimulationUpdateContext ctx) {
        Vehicle vehicle = order.getVehicle();
        String status = order.getStatus();

        if ("TOW_APPROACHING".equals(status)) {
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
                    triggerNextMissionOrFinish(vehicle, ctx);
                }
                ctx.setBroadcastOrders(true);
                ctx.setBroadcastVehicles(true);
            }

        } else if ("WAITING_FOR_CARGO_CLEARANCE".equals(status)) {
            Vehicle target = vehicleRepository.findById(vehicle.getTargetTowId()).orElse(null);
            if (target != null) {
                boolean hasRescuer = vehicleRepository.findAll().stream()
                        .anyMatch(v -> target.getId().equals(v.getTargetRescueId()));
                boolean hasCargoOrder = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))
                        .stream().anyMatch(o -> o.getVehicle() != null && o.getVehicle().getId().equals(target.getId()));

                if (!hasRescuer && !hasCargoOrder) {
                    startTowing(vehicle, target, order);
                    ctx.setBroadcastOrders(true);
                    ctx.setBroadcastVehicles(true);
                }
            } else {
                order.setStatus("COMPLETED");
                triggerNextMissionOrFinish(vehicle, ctx);
                ctx.setBroadcastOrders(true);
                ctx.setBroadcastVehicles(true);
            }

        } else if ("TOWING".equals(status)) {
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
                ctx.addVehicle(target);

                ctx.addTickUpdate(new VehicleSimulationDTO(
                        target.getId(), target.getPlateNumber(), target.getBrand(), target.getModel(),
                        target.getCurrentLat(), target.getCurrentLng(), target.getStatus(), null,
                        0.0, 0.0, target.getNextTowTargetId()
                ));
            }

            vehicle.setCurrentOdometer(vehicle.getCurrentOdometer() + distanceInTickKm);
            order.setGpsDistance(order.getGpsDistance() + distanceInTickKm);

            if (order.getProgress() >= 1.0) {
                order.setStatus("COMPLETED");
                if (target != null) {
                    target.setStatus("AVAILABLE");
                }

                triggerNextMissionOrFinish(vehicle, ctx);

                ctx.setBroadcastOrders(true);
                ctx.setBroadcastVehicles(true);
            }
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

    private void triggerNextMissionOrFinish(Vehicle vehicle, SimulationUpdateContext ctx) {
        vehicle.setTargetTowId(null);

        if (vehicle.getNextTowTargetId() != null) {
            Driver driver = driverRepository.findByAssignedVehicleId(vehicle.getId()).orElse(null);

            Order newTowOrder = new Order();
            newTowOrder.setVehicle(vehicle);
            newTowOrder.setDriver(driver);
            newTowOrder.setStatus("TOW_APPROACHING");
            newTowOrder.setStartLatApproaching(vehicle.getCurrentLat());
            newTowOrder.setStartLngApproaching(vehicle.getCurrentLng());
            newTowOrder.setRoutePolylineApproaching(vehicle.getNextTowPolyline() != null ? vehicle.getNextTowPolyline() : "");
            newTowOrder.setRouteDistanceApproaching(vehicle.getNextTowDistance() != null ? vehicle.getNextTowDistance() : 0.0);
            newTowOrder.setProgress(0.0);
            newTowOrder.setGpsDistance(0.0);

            vehicle.setStatus("TOW_APPROACHING");
            vehicle.setTargetTowId(vehicle.getNextTowTargetId());

            vehicle.setNextTowTargetId(null);
            vehicle.setNextTowPolyline(null);
            vehicle.setNextTowDistance(null);

            ctx.addOrder(newTowOrder);
        } else {
            vehicle.setStatus("AVAILABLE");
        }
    }
}