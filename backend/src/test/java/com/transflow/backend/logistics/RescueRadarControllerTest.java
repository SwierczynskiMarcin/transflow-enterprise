package com.transflow.backend.logistics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RescueRadarControllerTest {

    @InjectMocks
    private RescueRadarController rescueRadarController;

    @Mock
    private RescueRadarService rescueRadarService;

    @Test
    @DisplayName("Should return a sorted list of rescue candidates")
    void shouldGetCandidates() {
        RescueCandidateDTO candidate = new RescueCandidateDTO(10L, "WA123", "Volvo", "A", 50.0, 45.0, "Wolny");
        when(rescueRadarService.scanForCandidates(1L)).thenReturn(List.of(candidate));

        ResponseEntity<List<RescueCandidateDTO>> response = rescueRadarController.getCandidates(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, Objects.requireNonNull(response.getBody()).size());
        assertEquals(10L, response.getBody().get(0).vehicleId());
    }

    @Test
    @DisplayName("Should return an empty list when no rescue candidates are available")
    void shouldReturnEmptyListWhenNoCandidates() {
        when(rescueRadarService.scanForCandidates(99L)).thenReturn(Collections.emptyList());

        ResponseEntity<List<RescueCandidateDTO>> response = rescueRadarController.getCandidates(99L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, Objects.requireNonNull(response.getBody()).size());
    }

    @Test
    @DisplayName("Should assign rescue successfully on the first attempt")
    void shouldAssignRescueSuccessfully() {
        AssignRescueRequest request = new AssignRescueRequest(10L, 1L);

        ResponseEntity<?> response = rescueRadarController.assignRescue(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(rescueRadarService).assignRescue(10L, 1L);
    }

    @Test
    @DisplayName("Should assign rescue after recovering from an Optimistic Locking Failure")
    void shouldRetryAssignRescueOnOptimisticLockingFailureAndSucceed() {
        AssignRescueRequest request = new AssignRescueRequest(10L, 1L);

        doThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L))
                .doNothing()
                .when(rescueRadarService).assignRescue(10L, 1L);

        ResponseEntity<?> response = rescueRadarController.assignRescue(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(rescueRadarService, times(2)).assignRescue(10L, 1L);
    }

    @Test
    @DisplayName("Should fail to assign rescue and throw exception after max retries are exhausted")
    void shouldFailAssignRescueAfterMaxRetries() {
        AssignRescueRequest request = new AssignRescueRequest(10L, 1L);

        doThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L))
                .when(rescueRadarService).assignRescue(10L, 1L);

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> rescueRadarController.assignRescue(request));
        verify(rescueRadarService, times(3)).assignRescue(10L, 1L);
    }

    @Test
    @DisplayName("Should auto-assign rescue successfully on the first attempt")
    void shouldAutoAssignRescueSuccessfully() {
        ResponseEntity<?> response = rescueRadarController.autoAssignRescue(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(rescueRadarService).autoAssignRescue(1L);
    }

    @Test
    @DisplayName("Should auto-assign rescue after recovering from an Optimistic Locking Failure")
    void shouldRetryAutoAssignRescueOnOptimisticLockingFailureAndSucceed() {
        doThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L))
                .doNothing()
                .when(rescueRadarService).autoAssignRescue(1L);

        ResponseEntity<?> response = rescueRadarController.autoAssignRescue(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(rescueRadarService, times(2)).autoAssignRescue(1L);
    }

    @Test
    @DisplayName("Should fail to auto-assign rescue and throw exception after max retries are exhausted")
    void shouldFailAutoAssignRescueAfterMaxRetries() {
        doThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L))
                .when(rescueRadarService).autoAssignRescue(1L);

        assertThrows(ObjectOptimisticLockingFailureException.class, () -> rescueRadarController.autoAssignRescue(1L));
        verify(rescueRadarService, times(3)).autoAssignRescue(1L);
    }
}