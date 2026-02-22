package com.transflow.backend.service;

import com.transflow.backend.model.FuelLog;
import com.transflow.backend.model.Order;
import com.transflow.backend.repository.FuelLogRepository;
import com.transflow.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FuelLogService {

    private final FuelLogRepository fuelLogRepository;
    private final OrderRepository orderRepository;

    public FuelLog addFuelLog(FuelLog fuelLog) {
        Order order = orderRepository.findById(fuelLog.getOrder().getId())
                .orElseThrow(() -> new RuntimeException("Nie znaleziono zlecenia"));

        double distanceTraveled = fuelLog.getOdometerAtTanking() - order.getStartOdometer();

        double baseConsumption = order.getVehicle().getBaseFuelConsumption();
        double weightBonus = order.getCargoWeight() * 0.5;
        double expectedFuel = (distanceTraveled / 100) * (baseConsumption + weightBonus);

        if (fuelLog.getLitersTanked() > expectedFuel * 1.2) {
            fuelLog.setIsSuspicious(true);
        }

        order.setCurrentOdometer(fuelLog.getOdometerAtTanking());
        orderRepository.save(order);

        return fuelLogRepository.save(fuelLog);
    }
}