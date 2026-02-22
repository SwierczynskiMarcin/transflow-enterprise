package com.transflow.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "vehicles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String plateNumber;
    private String brand;
    private String model;
    private Double baseFuelConsumption;
    private Double fuelCapacity;
    private String status;

    private Double currentLat;
    private Double currentLng;
    private Double currentOdometer = 0.0;
}