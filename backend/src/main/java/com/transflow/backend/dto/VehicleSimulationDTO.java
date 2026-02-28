package com.transflow.backend.dto;

import lombok.Data;

@Data
public class VehicleSimulationDTO {
    private Long vehicleId;
    private String plateNumber;
    private String brand;
    private String model;
    private Double currentLat;
    private Double currentLng;
    private String status;
    private String orderStatus;
    private Double progress;
    private Double gpsDistance;
}