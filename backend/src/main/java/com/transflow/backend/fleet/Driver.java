package com.transflow.backend.fleet;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "drivers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Driver {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version = 0L;

    private String firstName;
    private String lastName;
    private String phoneNumber;
    private Double totalDrivingTime = 0.0;
    private String status;

    @OneToOne
    @JoinColumn(name = "vehicle_id", unique = true)
    private Vehicle assignedVehicle;
}