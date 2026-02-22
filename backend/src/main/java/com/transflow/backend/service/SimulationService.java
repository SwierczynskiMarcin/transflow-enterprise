package com.transflow.backend.service;

import com.transflow.backend.model.Order;
import com.transflow.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SimulationService {

    private final OrderRepository orderRepository;

    // Ustawienia symulacji
    private final double TRUCK_SPEED_KMH = 80.0;
    private final double TIME_MULTIPLIER = 100.0;
    private final int TICK_RATE_SECONDS = 2;

    @Scheduled(fixedRate = TICK_RATE_SECONDS * 1000)
    public void simulateMovement() {
        List<Order> activeOrders = orderRepository.findAll().stream()
                .filter(o -> "IN_PROGRESS".equals(o.getStatus()))
                .toList();

        for (Order order : activeOrders) {
            if (order.getProgress() == null) order.setProgress(0.0);
            if (order.getGpsDistance() == null) order.setGpsDistance(0.0);

            double totalDistance = calculateDistance(
                    order.getStartLocation().getLatitude(), order.getStartLocation().getLongitude(),
                    order.getEndLocation().getLatitude(), order.getEndLocation().getLongitude()
            );

            if (totalDistance <= 0) continue;

            double hoursPassed = (TICK_RATE_SECONDS * TIME_MULTIPLIER) / 3600.0;
            double distanceInTick = TRUCK_SPEED_KMH * hoursPassed;

            double progressIncrement = distanceInTick / totalDistance;
            order.setProgress(Math.min(1.0, order.getProgress() + progressIncrement));

            double newLat = order.getStartLocation().getLatitude() +
                    (order.getEndLocation().getLatitude() - order.getStartLocation().getLatitude()) * order.getProgress();

            double newLng = order.getStartLocation().getLongitude() +
                    (order.getEndLocation().getLongitude() - order.getStartLocation().getLongitude()) * order.getProgress();

            order.setCurrentLat(newLat);
            order.setCurrentLng(newLng);

            order.setGpsDistance(order.getGpsDistance() + distanceInTick);

            if (order.getProgress() >= 1.0) {
                order.setStatus("COMPLETED");
            }

            orderRepository.save(order);
            System.out.printf("Ciężarówka %s: dystans %.2f km, postęp %.2f%%\n",
                    order.getVehicle().getPlateNumber(), totalDistance, order.getProgress() * 100);
        }
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double theta = lon1 - lon2;
        double dist = Math.sin(Math.toRadians(lat1)) * Math.sin(Math.toRadians(lat2)) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.cos(Math.toRadians(theta));
        dist = Math.acos(dist);
        dist = Math.toDegrees(dist);
        return dist * 60 * 1.1515 * 1.609344;
    }
}