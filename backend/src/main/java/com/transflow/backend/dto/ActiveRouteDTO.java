package com.transflow.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ActiveRouteDTO {
    private Long vehicleId;
    private String routePolylineApproaching;
    private String routePolylineTransit;
    private String orderStatus;
}