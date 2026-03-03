package com.transflow.backend.simulation;

import java.time.LocalDateTime;

public record SimulationStateDTO(boolean running, double timeMultiplier, LocalDateTime virtualTime) {}