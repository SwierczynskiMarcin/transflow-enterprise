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

    private Double startOdometer;
    private Double gpsDistance = 0.0;
    private Double progress = 0.0;

    private Double startLatApproaching;
    private Double startLngApproaching;
    private Integer loadingTicksRemaining = 0;

    @Column(columnDefinition = "TEXT")
    private String routePolylineApproaching;
    private Double routeDistanceApproaching;

    @Column(columnDefinition = "TEXT")
    private String routePolylineTransit;
    private Double routeDistanceTransit;
}