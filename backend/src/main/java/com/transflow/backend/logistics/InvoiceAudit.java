package com.transflow.backend.logistics;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_audits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class InvoiceAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    private Double scannedAmount;
    private Double confidenceScore;
    private String auditResult;
    private LocalDateTime timestamp;
}