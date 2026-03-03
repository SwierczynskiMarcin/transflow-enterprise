package com.transflow.backend.fleet;

public record VehicleDTO(Long id, String plateNumber, String brand, String model, Double baseFuelConsumption, Double fuelCapacity, String status, Double currentLat, Double currentLng, Double currentOdometer) {
    public static VehicleDTO from(Vehicle v) {
        return new VehicleDTO(v.getId(), v.getPlateNumber(), v.getBrand(), v.getModel(), v.getBaseFuelConsumption(), v.getFuelCapacity(), v.getStatus(), v.getCurrentLat(), v.getCurrentLng(), v.getCurrentOdometer());
    }
}