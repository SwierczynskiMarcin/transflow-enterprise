package com.transflow.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "fuel_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FuelLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    private Double litersTanked;
    private Double totalCost;
    private Double odometerAtTanking; // Stan licznika w momencie tankowania
    private Boolean isSuspicious = false;
    private LocalDateTime createdAt = LocalDateTime.now();
}