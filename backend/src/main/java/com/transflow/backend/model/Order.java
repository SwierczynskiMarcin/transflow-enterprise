package com.transflow.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "start_location_id")
    private Location startLocation;

    @ManyToOne
    @JoinColumn(name = "end_location_id")
    private Location endLocation;

    @ManyToOne
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @ManyToOne
    @JoinColumn(name = "driver_id")
    private Driver driver;

    private Double cargoWeight;
    private Double pricePerKm;
    private String status;

    private Double startOdometer;      // Licznik wpisany przy starcie zlecenia
    private Double gpsDistance = 0.0;  // Suma dystansu naliczonego przez GPS na tym zleceniu
    private Double progress = 0.0;     // Postęp trasy 0.0 - 1.0
}