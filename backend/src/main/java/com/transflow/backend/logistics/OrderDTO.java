package com.transflow.backend.logistics;

import com.transflow.backend.fleet.DriverDTO;
import com.transflow.backend.fleet.VehicleDTO;

public record OrderDTO(Long id, Long version, LocationDTO startLocation, LocationDTO endLocation, VehicleDTO vehicle, DriverDTO driver, Double cargoWeight, Double pricePerKm, String status, Double progress) {
    public static OrderDTO from(Order o) {
        return new OrderDTO(
                o.getId(),
                o.getVersion(),
                o.getStartLocation() != null ? LocationDTO.from(o.getStartLocation()) : null,
                o.getEndLocation() != null ? LocationDTO.from(o.getEndLocation()) : null,
                o.getVehicle() != null ? VehicleDTO.from(o.getVehicle()) : null,
                o.getDriver() != null ? DriverDTO.from(o.getDriver()) : null,
                o.getCargoWeight(), o.getPricePerKm(), o.getStatus(), o.getProgress()
        );
    }
}