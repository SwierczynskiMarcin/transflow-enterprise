package com.transflow.backend.simulation.strategy;

import com.transflow.backend.logistics.Order;

public interface OrderStateHandler {
    boolean supports(String status);
    void handle(Order order, double distanceInTickMeters, double distanceInTickKm, SimulationUpdateContext ctx);
}