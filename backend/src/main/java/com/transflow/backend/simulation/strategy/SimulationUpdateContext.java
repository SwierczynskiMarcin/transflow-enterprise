package com.transflow.backend.simulation.strategy;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.simulation.VehicleSimulationDTO;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
public class SimulationUpdateContext {
    private final Set<Vehicle> vehiclesToSave = new HashSet<>();
    private final Set<Order> ordersToSave = new HashSet<>();
    private final List<VehicleSimulationDTO> tickUpdates = new ArrayList<>();
    private boolean broadcastOrders = false;
    private boolean broadcastVehicles = false;

    public void addVehicle(Vehicle v) {
        vehiclesToSave.add(v);
    }

    public void addOrder(Order o) {
        ordersToSave.add(o);
    }

    public void addTickUpdate(VehicleSimulationDTO dto) {
        tickUpdates.add(dto);
    }
}