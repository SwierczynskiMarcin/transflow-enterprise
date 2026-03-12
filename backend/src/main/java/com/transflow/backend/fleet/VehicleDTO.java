package com.transflow.backend.fleet;

public record VehicleDTO(
        Long id, Long version, String plateNumber, String brand, String model,
        Double baseFuelConsumption, Double fuelCapacity, String status,
        Double currentLat, Double currentLng, Double currentOdometer,
        Boolean isServiceUnit, Long nextTowTargetId
) {
    public static VehicleDTO from(Vehicle v) {
        return new VehicleDTO(
                v.getId(), v.getVersion(), v.getPlateNumber(), v.getBrand(), v.getModel(),
                v.getBaseFuelConsumption(), v.getFuelCapacity(), v.getStatus(),
                v.getCurrentLat(), v.getCurrentLng(), v.getCurrentOdometer(),
                v.getIsServiceUnit(), v.getNextTowTargetId()
        );
    }
}