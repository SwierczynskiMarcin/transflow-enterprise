package com.transflow.backend.finance;

import com.transflow.backend.logistics.Order;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "fuel_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class FuelLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    private Double litersTanked;
    private Double totalCost;
    private Double odometerAtTanking;
    private Boolean isSuspicious = false;
    private LocalDateTime createdAt = LocalDateTime.now();
}