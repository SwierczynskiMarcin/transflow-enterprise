package com.transflow.backend.logistics;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
class LocationRepositoryTest {

    @Autowired
    private LocationRepository locationRepository;

    @BeforeEach
    void setUp() {
        locationRepository.deleteAll();
    }

    @Test
    @DisplayName("Should return true when location with exact name exists")
    void shouldReturnTrueWhenNameExists() {
        Location location = new Location();
        location.setName("Unique Warsaw Test Hub");
        location.setCompanyName("TransFlow");
        location.setType("BASE");
        location.setLatitude(52.2297);
        location.setLongitude(21.0122);
        location.setAddress("Logistics Park 1");

        locationRepository.saveAndFlush(location);

        boolean exists = locationRepository.existsByName("Unique Warsaw Test Hub");

        assertTrue(exists);
    }

    @Test
    @DisplayName("Should return false when location with name does not exist")
    void shouldReturnFalseWhenNameDoesNotExist() {
        boolean exists = locationRepository.existsByName("Non Existent Hub");

        assertFalse(exists);
    }

    @Test
    @DisplayName("Should return false for partial name matches")
    void shouldReturnFalseForPartialNameMatch() {
        Location location = new Location();
        location.setName("Partial Name Test Hub");
        locationRepository.saveAndFlush(location);

        boolean exists = locationRepository.existsByName("Partial Name");

        assertFalse(exists);
    }

    @Test
    @DisplayName("Should return false when name is null")
    void shouldReturnFalseWhenNameIsNull() {
        Location location = new Location();
        location.setName("Null Name Test Hub");
        locationRepository.saveAndFlush(location);

        boolean exists = locationRepository.existsByName(null);

        assertFalse(exists);
    }
}