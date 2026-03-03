package com.transflow.backend.logistics;

public record ActiveRouteDTO(Long vehicleId, String routePolylineApproaching, String routePolylineTransit, String orderStatus) {}