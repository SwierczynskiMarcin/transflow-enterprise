package com.transflow.backend.dto;

import lombok.Data;

@Data
public class OrderCreateRequest {
    private Long vehicleId;
    private Long startLocationId;
    private Long endLocationId;

    private String routePolylineApproaching;
    private Double routeDistanceApproaching;
    private String routePolylineTransit;
    private Double routeDistanceTransit;
}