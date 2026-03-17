package com.transflow.backend.simulation;

public record VehicleSimulationDTO(
        Long vehicleId, String plateNumber, String brand, String model,
        Double currentLat, Double currentLng, String status, String orderStatus,
        Double progress, Double gpsDistance, Long nextTowTargetId, Boolean isServiceUnit,
        Long targetTowId
) {}