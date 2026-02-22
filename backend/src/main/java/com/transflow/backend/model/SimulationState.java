package com.transflow.backend.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class SimulationState {
    private boolean isRunning;
    private double timeMultiplier;
    private LocalDateTime virtualTime;
}