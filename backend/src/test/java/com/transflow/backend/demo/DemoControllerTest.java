package com.transflow.backend.demo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DemoControllerTest {

    @InjectMocks
    private DemoController demoController;

    @Mock
    private DemoService demoService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void shouldSeedLocationsAndBroadcastUpdate() {
        Map<String, Integer> expectedResponse = Map.of("added", 25, "skipped", 0);
        when(demoService.seedLocations()).thenReturn(expectedResponse);

        ResponseEntity<?> response = demoController.seedLocations();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expectedResponse, response.getBody());
        verify(demoService).seedLocations();
        verify(messagingTemplate).convertAndSend("/topic/updates", "LOCATIONS");
        verifyNoMoreInteractions(messagingTemplate);
    }

    @Test
    void shouldSeedFleetAndBroadcastUpdates() {
        Map<String, Integer> expectedResponse = Map.of("added", 50, "skipped", 0);
        when(demoService.seedFleetAndStaff()).thenReturn(expectedResponse);

        ResponseEntity<?> response = demoController.seedFleet();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(expectedResponse, response.getBody());
        verify(demoService).seedFleetAndStaff();
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
        verifyNoMoreInteractions(messagingTemplate);
    }

    @Test
    void shouldTriggerAutoDispatchSuccessfully() {
        int dispatchCount = 5;

        ResponseEntity<?> response = demoController.autoDispatch(dispatchCount);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(demoService).autoDispatch(dispatchCount);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void shouldTriggerAutoDispatchWithZeroCount() {
        int dispatchCount = 0;

        ResponseEntity<?> response = demoController.autoDispatch(dispatchCount);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(demoService).autoDispatch(dispatchCount);
    }

    @Test
    void shouldClearAllDataAndBroadcastUpdates() {
        ResponseEntity<?> response = demoController.clearAllData();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response);

        verify(demoService).clearAllData();
        verify(messagingTemplate).convertAndSend("/topic/updates", "LOCATIONS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate).convertAndSend("/topic/updates", "DRIVERS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
        verifyNoMoreInteractions(messagingTemplate);
    }
}