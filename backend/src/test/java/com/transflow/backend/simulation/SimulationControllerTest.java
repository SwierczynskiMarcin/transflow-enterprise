package com.transflow.backend.simulation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SimulationControllerTest {

    @InjectMocks
    private SimulationController simulationController;

    @Mock
    private SimulationEngine simulationEngine;

    @Test
    void shouldToggleSimulationState() {
        when(simulationEngine.isRunning()).thenReturn(true);

        Map<String, Boolean> result = simulationController.toggleSimulation();

        assertEquals(false, result.get("isRunning"));
        verify(simulationEngine, times(1)).setRunning(false);
    }

    @Test
    void shouldSetSimulationSpeed() {
        double newSpeed = 120.0;

        Map<String, Double> result = simulationController.setSpeed(newSpeed);

        assertEquals(newSpeed, result.get("timeMultiplier"));
        verify(simulationEngine, times(1)).setTimeMultiplier(newSpeed);
    }

    @Test
    void shouldReturnCurrentStatus() {
        when(simulationEngine.isRunning()).thenReturn(true);
        when(simulationEngine.getTimeMultiplier()).thenReturn(60.0);

        Map<String, Object> result = simulationController.getStatus();

        assertEquals(true, result.get("isRunning"));
        assertEquals(60.0, result.get("timeMultiplier"));
    }
}