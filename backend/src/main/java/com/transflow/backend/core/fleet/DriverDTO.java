package com.transflow.backend.fleet;

public record DriverDTO(Long id, String firstName, String lastName, String phoneNumber, String status, AssignedVehicleDTO assignedVehicle) {
    public record AssignedVehicleDTO(Long id, String plateNumber, String brand) {}

    public static DriverDTO from(Driver d) {
        return new DriverDTO(
                d.getId(), d.getFirstName(), d.getLastName(), d.getPhoneNumber(), d.getStatus(),
                d.getAssignedVehicle() != null ? new AssignedVehicleDTO(d.getAssignedVehicle().getId(), d.getAssignedVehicle().getPlateNumber(), d.getAssignedVehicle().getBrand()) : null
        );
    }
}