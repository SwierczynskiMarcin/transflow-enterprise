package com.transflow.backend.logistics;

public record RpaAuditRequest(Long orderId, Double scannedAmount, Double confidenceScore) {}