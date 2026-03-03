package com.transflow.backend.simulation;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/simulation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimulationController {

    private final SimulationEngine simulationEngine;

    @PostMapping("/toggle")
    public Map<String, Boolean> toggleSimulation() {
        boolean newState = !simulationEngine.isRunning();
        simulationEngine.setRunning(newState);
        return Map.of("isRunning", newState);
    }

    @PostMapping("/speed")
    public Map<String, Double> setSpeed(@RequestParam double multiplier) {
        simulationEngine.setTimeMultiplier(multiplier);
        return Map.of("timeMultiplier", multiplier);
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return Map.of(
                "isRunning", simulationEngine.isRunning(),
                "timeMultiplier", simulationEngine.getTimeMultiplier()
        );
    }
}