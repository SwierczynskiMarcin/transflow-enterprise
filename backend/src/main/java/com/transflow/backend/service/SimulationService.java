package com.transflow.backend.service;

import com.transflow.backend.dto.VehicleSimulationDTO;
import com.transflow.backend.model.Order;
import com.transflow.backend.model.SimulationState;
import com.transflow.backend.model.Vehicle;
import com.transflow.backend.repository.OrderRepository;
import com.transflow.backend.repository.VehicleRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SimulationService {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VirtualClock virtualClock;

    private final double TRUCK_SPEED_KMH = 80.0;
    private final int TICK_RATE_SECONDS = 2;

    @Getter @Setter
    private boolean isRunning = true;

    @Getter @Setter
    private double timeMultiplier = 60.0;

    @Scheduled(fixedRate = TICK_RATE_SECONDS * 1000)
    public void simulateMovement() {
        messagingTemplate.convertAndSend("/topic/simulation",
                new SimulationState(isRunning, timeMultiplier, virtualClock.getCurrentTime()));

        if (!isRunning) return;

        virtualClock.advanceTime(TICK_RATE_SECONDS, timeMultiplier);

        List<Order> activeOrders = orderRepository.findAll().stream()
                .filter(o -> List.of("APPROACHING", "LOADING", "IN_TRANSIT").contains(o.getStatus()))
                .toList();

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

                    List<double[]> polyline = decodePolyline(order.getRoutePolylineApproaching());
                    double targetDistMeters = order.getProgress() * order.getRouteDistanceApproaching();
                    double[] newPos = getPositionAtDistance(polyline, targetDistMeters);

                    vehicle.setCurrentLat(newPos[0]);
                    vehicle.setCurrentLng(newPos[1]);
                } else {
                    double totalDist = calculateDistance(order.getStartLatApproaching(), order.getStartLngApproaching(),
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
                }

            } else if ("LOADING".equals(order.getStatus())) {
                int remaining = order.getLoadingTicksRemaining() != null ? order.getLoadingTicksRemaining() : 0;
                if (remaining <= 1) {
                    order.setStatus("IN_TRANSIT");
                    order.setProgress(0.0);
                    order.setLoadingTicksRemaining(0);
                } else {
                    order.setLoadingTicksRemaining(remaining - 1);
                }
            } else if ("IN_TRANSIT".equals(order.getStatus())) {
                if (order.getRoutePolylineTransit() != null && order.getRouteDistanceTransit() != null && order.getRouteDistanceTransit() > 0) {
                    double addedProgress = distanceInTickMeters / order.getRouteDistanceTransit();
                    order.setProgress(Math.min(1.0, order.getProgress() + addedProgress));

                    List<double[]> polyline = decodePolyline(order.getRoutePolylineTransit());
                    double targetDistMeters = order.getProgress() * order.getRouteDistanceTransit();
                    double[] newPos = getPositionAtDistance(polyline, targetDistMeters);

                    vehicle.setCurrentLat(newPos[0]);
                    vehicle.setCurrentLng(newPos[1]);
                } else {
                    double totalDist = calculateDistance(order.getStartLocation().getLatitude(), order.getStartLocation().getLongitude(),
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
                }
            }

            vehicleRepository.save(vehicle);
            orderRepository.save(order);

            VehicleSimulationDTO dto = new VehicleSimulationDTO();
            dto.setVehicleId(vehicle.getId());
            dto.setPlateNumber(vehicle.getPlateNumber());
            dto.setBrand(vehicle.getBrand());
            dto.setModel(vehicle.getModel());
            dto.setCurrentLat(vehicle.getCurrentLat());
            dto.setCurrentLng(vehicle.getCurrentLng());
            dto.setStatus(vehicle.getStatus());
            dto.setOrderStatus(order.getStatus());
            dto.setProgress(order.getProgress());
            dto.setGpsDistance(order.getGpsDistance());

            messagingTemplate.convertAndSend("/topic/trucks", dto);
        }
    }

    private double[] getPositionAtDistance(List<double[]> polyline, double targetDistance) {
        if (polyline == null || polyline.isEmpty()) return new double[]{0, 0};
        if (polyline.size() == 1 || targetDistance <= 0) return polyline.get(0);

        double currentDist = 0.0;
        for (int i = 0; i < polyline.size() - 1; i++) {
            double[] p1 = polyline.get(i);
            double[] p2 = polyline.get(i + 1);
            double segDist = calculateDistance(p1[0], p1[1], p2[0], p2[1]) * 1000.0;

            if (currentDist + segDist >= targetDistance) {
                double over = targetDistance - currentDist;
                double ratio = over / segDist;
                double lat = p1[0] + (p2[0] - p1[0]) * ratio;
                double lng = p1[1] + (p2[1] - p1[1]) * ratio;
                return new double[]{lat, lng};
            }
            currentDist += segDist;
        }
        return polyline.get(polyline.size() - 1);
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double theta = lon1 - lon2;
        double dist = Math.sin(Math.toRadians(lat1)) * Math.sin(Math.toRadians(lat2)) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.cos(Math.toRadians(theta));
        dist = Math.acos(Math.min(1.0, dist));
        dist = Math.toDegrees(dist);
        return dist * 60 * 1.1515 * 1.609344;
    }

    private List<double[]> decodePolyline(String encoded) {
        List<double[]> poly = new ArrayList<>();
        int index = 0, len = encoded.length();
        int lat = 0, lng = 0;
        while (index < len) {
            int b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            shift = 0; result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            poly.add(new double[]{(((double) lat / 1E5)), (((double) lng / 1E5))});
        }
        return poly;
    }
}