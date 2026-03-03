package com.transflow.backend.logistics;

public record LocationDTO(Long id, String name, String companyName, String type, Double latitude, Double longitude, String address) {
    public static LocationDTO from(Location l) {
        return new LocationDTO(l.getId(), l.getName(), l.getCompanyName(), l.getType(), l.getLatitude(), l.getLongitude(), l.getAddress());
    }
}