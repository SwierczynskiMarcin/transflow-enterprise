package com.transflow.backend.logistics;

public record RescueCandidateDTO(
        Long vehicleId,
        String plateNumber,
        String brand,
        String category,
        Double distanceKm,
        Double etaMinutes,
        String currentStatus
) {}