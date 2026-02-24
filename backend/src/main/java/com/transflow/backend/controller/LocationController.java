package com.transflow.backend.controller;

import com.transflow.backend.model.Location;
import com.transflow.backend.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LocationController {

    private final LocationRepository locationRepository;

    @GetMapping
    public List<Location> getAllLocations() {
        return locationRepository.findAll();
    }

    @PostMapping
    public Location addLocation(@RequestBody Location location) {
        return locationRepository.save(location);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Location> updateLocation(@PathVariable Long id, @RequestBody Location details) {
        return locationRepository.findById(id).map(loc -> {
            loc.setName(details.getName());
            loc.setCompanyName(details.getCompanyName());
            loc.setType(details.getType());
            loc.setLatitude(details.getLatitude());
            loc.setLongitude(details.getLongitude());
            loc.setAddress(details.getAddress());
            return ResponseEntity.ok(locationRepository.save(loc));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLocation(@PathVariable Long id) {
        return locationRepository.findById(id).map(loc -> {
            locationRepository.delete(loc);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}