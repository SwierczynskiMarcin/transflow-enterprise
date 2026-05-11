package com.transflow.backend.logistics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationControllerTest {

    @InjectMocks
    private LocationController locationController;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should return a list of all locations")
    void shouldGetAllLocations() {
        Location location = new Location(1L, "Hub Warsaw", "TransFlow", "BASE", 52.2297, 21.0122, "Test Address");
        when(locationRepository.findAll()).thenReturn(List.of(location));

        List<LocationDTO> result = locationController.getAllLocations();

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).id());
        assertEquals("Hub Warsaw", result.get(0).name());
    }

    @Test
    @DisplayName("Should return an empty list when no locations exist")
    void shouldReturnEmptyListWhenNoLocationsExist() {
        when(locationRepository.findAll()).thenReturn(Collections.emptyList());

        List<LocationDTO> result = locationController.getAllLocations();

        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("Should add new location and broadcast WebSocket event")
    void shouldAddLocationSuccessfully() {
        LocationDTO payload = new LocationDTO(null, "Hub Berlin", "TransFlow", "PORT", 52.5200, 13.4050, "Berlin Address");
        Location savedLocation = new Location(1L, "Hub Berlin", "TransFlow", "PORT", 52.5200, 13.4050, "Berlin Address");

        when(locationRepository.save(any(Location.class))).thenReturn(savedLocation);

        LocationDTO response = locationController.addLocation(payload);

        assertEquals(1L, response.id());
        assertEquals("Hub Berlin", response.name());
        verify(locationRepository).save(any(Location.class));
        verify(messagingTemplate).convertAndSend("/topic/updates", "LOCATIONS");
    }

    @Test
    @DisplayName("Should update existing location and broadcast WebSocket event")
    void shouldUpdateLocationSuccessfully() {
        Location existingLocation = new Location(1L, "Old Name", "Old Co", "BASE", 0.0, 0.0, "Old Addr");
        LocationDTO payload = new LocationDTO(1L, "New Name", "New Co", "PORT", 1.0, 1.0, "New Addr");

        when(locationRepository.findById(1L)).thenReturn(Optional.of(existingLocation));
        when(locationRepository.save(any(Location.class))).thenReturn(existingLocation);

        ResponseEntity<LocationDTO> response = locationController.updateLocation(1L, payload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("New Name", Objects.requireNonNull(response.getBody()).name());
        verify(locationRepository).save(any(Location.class));
        verify(messagingTemplate).convertAndSend("/topic/updates", "LOCATIONS");
    }

    @Test
    @DisplayName("Should return 404 Not Found when trying to update non-existent location")
    void shouldReturnNotFoundWhenUpdatingNonExistentLocation() {
        LocationDTO payload = new LocationDTO(1L, "Name", "Co", "PORT", 1.0, 1.0, "Addr");
        when(locationRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<LocationDTO> response = locationController.updateLocation(1L, payload);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(locationRepository, never()).save(any(Location.class));
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should delete location when not used in orders and broadcast WebSocket event")
    void shouldDeleteLocationSuccessfully() {
        Location location = new Location(1L, "Hub", "Co", "BASE", 0.0, 0.0, "Addr");

        when(orderRepository.existsByStartLocationIdOrEndLocationId(1L, 1L)).thenReturn(false);
        when(locationRepository.findById(1L)).thenReturn(Optional.of(location));

        ResponseEntity<?> response = locationController.deleteLocation(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(locationRepository).delete(location);
        verify(messagingTemplate).convertAndSend("/topic/updates", "LOCATIONS");
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when attempting to delete location used in active orders")
    void shouldThrowExceptionWhenDeletingLocationUsedInOrders() {
        when(orderRepository.existsByStartLocationIdOrEndLocationId(1L, 1L)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> locationController.deleteLocation(1L));
        verify(locationRepository, never()).findById(anyLong());
        verify(locationRepository, never()).delete(any(Location.class));
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should return 404 Not Found when trying to delete non-existent location")
    void shouldReturnNotFoundWhenDeletingNonExistentLocation() {
        when(orderRepository.existsByStartLocationIdOrEndLocationId(1L, 1L)).thenReturn(false);
        when(locationRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = locationController.deleteLocation(1L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(locationRepository, never()).delete(any(Location.class));
        verifyNoInteractions(messagingTemplate);
    }
}