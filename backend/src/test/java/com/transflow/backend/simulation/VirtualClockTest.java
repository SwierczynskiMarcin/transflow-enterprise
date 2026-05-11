package com.transflow.backend.simulation;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VirtualClockTest {

    private final VirtualClock virtualClock = new VirtualClock();

    @Test
    void shouldInitializeWithDefaultTime() {
        LocalDateTime expectedStart = LocalDateTime.of(2026, 3, 3, 8, 0);

        assertEquals(expectedStart, virtualClock.getCurrentTime());
    }

    @Test
    void shouldAdvanceTimeCorrectlyWithMultiplier() {
        LocalDateTime initialTime = virtualClock.getCurrentTime();
        int realSecondsPassed = 2;
        double multiplier = 60.0;

        virtualClock.advanceTime(realSecondsPassed, multiplier);

        LocalDateTime expectedTime = initialTime.plusSeconds(120);
        assertEquals(expectedTime, virtualClock.getCurrentTime());
    }

    @Test
    void shouldHandleFractionalMultipliersCorrectly() {
        LocalDateTime initialTime = virtualClock.getCurrentTime();
        int realSecondsPassed = 2;
        double multiplier = 0.5;

        virtualClock.advanceTime(realSecondsPassed, multiplier);

        LocalDateTime expectedTime = initialTime.plusSeconds(1);
        assertEquals(expectedTime, virtualClock.getCurrentTime());
    }

    @Test
    void shouldSetAndGetCurrentTime() {
        LocalDateTime newTime = LocalDateTime.of(2030, 1, 1, 12, 0);
        virtualClock.setCurrentTime(newTime);

        assertEquals(newTime, virtualClock.getCurrentTime());
    }
}