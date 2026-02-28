package com.transflow.backend.controller;

import com.transflow.backend.model.Location;
import com.transflow.backend.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LocationController {

    private final LocationRepository locationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<Location> getAllLocations() {
        return locationRepository.findAll();
    }

    @PostMapping
    public Location addLocation(@RequestBody Location location) {
        Location saved = locationRepository.save(location);
        messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
        return saved;
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
            Location updated = locationRepository.save(loc);
            messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLocation(@PathVariable Long id) {
        return locationRepository.findById(id).map(loc -> {
            locationRepository.delete(loc);
            messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}