package com.transflow.backend.fleet;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "vehicles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Vehicle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version = 0L;

    private String plateNumber;
    private String brand;
    private String model;
    private Double baseFuelConsumption;
    private Double fuelCapacity;
    private String status;
    private Double currentLat;
    private Double currentLng;
    private Double currentOdometer = 0.0;

    private Long targetRescueId;

    @Column(columnDefinition = "TEXT")
    private String rescuePolyline;
    private Double rescueDistance;

    private Boolean isServiceUnit = false;
    private Long targetTowId;
}