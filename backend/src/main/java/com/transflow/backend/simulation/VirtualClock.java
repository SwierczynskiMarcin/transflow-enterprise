package com.transflow.backend.simulation;

import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class VirtualClock {
    @Getter @Setter
    private LocalDateTime currentTime = LocalDateTime.of(2026, 3, 3, 8, 0);

    public void advanceTime(int realSecondsPassed, double multiplier) {
        long virtualSecondsToAdvance = (long) (realSecondsPassed * multiplier);
        currentTime = currentTime.plusSeconds(virtualSecondsToAdvance);
    }
}