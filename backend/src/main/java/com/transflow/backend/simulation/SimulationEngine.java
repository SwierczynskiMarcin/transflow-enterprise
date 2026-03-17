package com.transflow.backend.simulation;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.simulation.strategy.OrderStateHandler;
import com.transflow.backend.simulation.strategy.SimulationUpdateContext;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SimulationEngine {

    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final VirtualClock virtualClock;
    private final List<OrderStateHandler> stateHandlers;

    private static final double TRUCK_SPEED_KMH = 80.0;
    private static final int TICK_RATE_SECONDS = 2;

    @Getter @Setter
    private boolean isRunning = true;

    @Getter @Setter
    private double timeMultiplier = 60.0;

    @Scheduled(fixedRate = 2000)
    public void simulateMovement() {
        messagingTemplate.convertAndSend("/topic/simulation",
                new SimulationStateDTO(isRunning, timeMultiplier, virtualClock.getCurrentTime()));

        if (!isRunning) return;

        virtualClock.advanceTime(TICK_RATE_SECONDS, timeMultiplier);

        List<Order> activeOrders = orderRepository.findByStatusIn(List.of(
                "APPROACHING", "LOADING", "IN_TRANSIT", "RESCUE_APPROACHING",
                "HANDOVER", "TOW_APPROACHING", "WAITING_FOR_CARGO_CLEARANCE", "TOWING"));

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        Map<Long, VehicleSimulationDTO> tickUpdatesByVehicleId = new HashMap<>();

        for (Order order : activeOrders) {
            Vehicle vehicle = order.getVehicle();

            if ("BROKEN".equals(vehicle.getStatus()) || "WAITING_FOR_TOW".equals(vehicle.getStatus()) || "BEING_TOWED".equals(vehicle.getStatus())) {
                tickUpdatesByVehicleId.put(vehicle.getId(), new VehicleSimulationDTO(
                        vehicle.getId(), vehicle.getPlateNumber(), vehicle.getBrand(), vehicle.getModel(),
                        vehicle.getCurrentLat(), vehicle.getCurrentLng(), vehicle.getStatus(), order.getStatus(),
                        order.getProgress(), order.getGpsDistance(), vehicle.getNextTowTargetId(),
                        vehicle.getIsServiceUnit(), vehicle.getTargetTowId()
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

            for (OrderStateHandler handler : stateHandlers) {
                if (handler.supports(order.getStatus())) {
                    try {
                        handler.handle(order, distanceInTickMeters, distanceInTickKm, ctx);
                    } catch (Exception e) {
                        System.err.println("[SimulationEngine] Błąd przetwarzania statusu " + order.getStatus() + " dla pojazdu " + vehicle.getId());
                    }
                    break;
                }
            }

            if (!"BROKEN".equals(vehicle.getStatus()) && !"WAITING_FOR_TOW".equals(vehicle.getStatus())) {
                ctx.addVehicle(vehicle);
                ctx.addOrder(order);
            }

            tickUpdatesByVehicleId.put(vehicle.getId(), new VehicleSimulationDTO(
                    vehicle.getId(), vehicle.getPlateNumber(), vehicle.getBrand(), vehicle.getModel(),
                    vehicle.getCurrentLat(), vehicle.getCurrentLng(), vehicle.getStatus(), order.getStatus(),
                    order.getProgress(), order.getGpsDistance(), vehicle.getNextTowTargetId(),
                    vehicle.getIsServiceUnit(), vehicle.getTargetTowId()
            ));
        }

        boolean hadOle = false;

        if (!ctx.getVehiclesToSave().isEmpty()) {
            for (Vehicle v : ctx.getVehiclesToSave()) {
                try {
                    vehicleRepository.save(v);
                } catch (ObjectOptimisticLockingFailureException e) {
                    hadOle = true;
                } catch (Exception ignored) {}
            }
        }

        if (!ctx.getOrdersToSave().isEmpty()) {
            for (Order o : ctx.getOrdersToSave()) {
                try {
                    orderRepository.save(o);
                } catch (ObjectOptimisticLockingFailureException e) {
                    hadOle = true;
                } catch (Exception ignored) {}
            }
        }

        boolean hasNewOrders = !ctx.getNewOrdersToSave().isEmpty();
        if (hasNewOrders) {
            for (Order o : ctx.getNewOrdersToSave()) {
                try {
                    orderRepository.save(o);
                } catch (Exception ignored) {}
            }
        }

        for (VehicleSimulationDTO dto : tickUpdatesByVehicleId.values()) {
            ctx.addTickUpdate(dto);
        }

        boolean shouldBroadcastOrders = ctx.isBroadcastOrders() || hasNewOrders || hadOle;
        boolean shouldBroadcastVehicles = ctx.isBroadcastVehicles() || hasNewOrders || hadOle;

        if (shouldBroadcastOrders) {
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        }
        if (shouldBroadcastVehicles) {
            messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        }

        if (!ctx.getTickUpdates().isEmpty()) {
            messagingTemplate.convertAndSend("/topic/trucks", ctx.getTickUpdates());
        }
    }
}