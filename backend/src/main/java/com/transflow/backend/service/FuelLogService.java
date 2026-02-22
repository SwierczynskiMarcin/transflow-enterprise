package com.transflow.backend.service;

import com.transflow.backend.model.FuelLog;
import com.transflow.backend.model.Order;
import com.transflow.backend.model.Vehicle;
import com.transflow.backend.repository.FuelLogRepository;
import com.transflow.backend.repository.OrderRepository;
import com.transflow.backend.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FuelLogService {

    private final FuelLogRepository fuelLogRepository;
    private final OrderRepository orderRepository;
    private final VehicleRepository vehicleRepository; // Dodane repozytorium pojazdów

    public FuelLog addFuelLog(FuelLog fuelLog) {
        Order order = orderRepository.findById(fuelLog.getOrder().getId())
                .orElseThrow(() -> new RuntimeException("Nie znaleziono zlecenia"));

        Vehicle vehicle = order.getVehicle();

        double distanceTraveled = fuelLog.getOdometerAtTanking() - order.getStartOdometer();

        double baseConsumption = vehicle.getBaseFuelConsumption();
        double weightBonus = order.getCargoWeight() * 0.5;
        double expectedFuel = (distanceTraveled / 100) * (baseConsumption + weightBonus);

        if (fuelLog.getLitersTanked() > expectedFuel * 1.2) {
            fuelLog.setIsSuspicious(true);
        } else {
            fuelLog.setIsSuspicious(false);
        }

        vehicle.setCurrentOdometer(fuelLog.getOdometerAtTanking());
        vehicleRepository.save(vehicle);


        return fuelLogRepository.save(fuelLog);
    }
}