package com.transflow.backend.logistics;

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
    public List<LocationDTO> getAllLocations() {
        return locationRepository.findAll().stream().map(LocationDTO::from).toList();
    }

    @PostMapping
    public LocationDTO addLocation(@RequestBody LocationDTO dto) {
        Location location = new Location();
        location.setName(dto.name());
        location.setCompanyName(dto.companyName());
        location.setType(dto.type());
        location.setLatitude(dto.latitude());
        location.setLongitude(dto.longitude());
        location.setAddress(dto.address());
        Location saved = locationRepository.save(location);
        messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
        return LocationDTO.from(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LocationDTO> updateLocation(@PathVariable Long id, @RequestBody LocationDTO details) {
        return locationRepository.findById(id).map(loc -> {
            loc.setName(details.name());
            loc.setCompanyName(details.companyName());
            loc.setType(details.type());
            loc.setLatitude(details.latitude());
            loc.setLongitude(details.longitude());
            loc.setAddress(details.address());
            Location updated = locationRepository.save(loc);
            messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
            return ResponseEntity.ok(LocationDTO.from(updated));
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