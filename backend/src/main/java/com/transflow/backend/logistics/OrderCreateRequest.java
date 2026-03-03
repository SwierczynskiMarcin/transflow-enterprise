package com.transflow.backend.logistics;

public record OrderCreateRequest(
        Long vehicleId, Long startLocationId, Long endLocationId,
        String routePolylineApproaching, Double routeDistanceApproaching,
        String routePolylineTransit, Double routeDistanceTransit
) {}