package com.transflow.backend.finance;

import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FuelLogService {

    private final FuelLogRepository fuelLogRepository;
    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository;

    public FuelLog addFuelLog(FuelLog fuelLog) {
        Order order = orderRepository.findById(fuelLog.getOrder().getId())
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono zlecenia"));

        Vehicle vehicle = order.getVehicle();
        double distanceTraveled = fuelLog.getOdometerAtTanking() - order.getStartOdometer();
        double baseConsumption = vehicle.getBaseFuelConsumption();
        double weightBonus = order.getCargoWeight() * 0.5;
        double expectedFuel = (distanceTraveled / 100) * (baseConsumption + weightBonus);

        fuelLog.setIsSuspicious(fuelLog.getLitersTanked() > expectedFuel * 1.2);
        vehicle.setCurrentOdometer(fuelLog.getOdometerAtTanking());
        vehicleRepository.save(vehicle);

        return fuelLogRepository.save(fuelLog);
    }
}