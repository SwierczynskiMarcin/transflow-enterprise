package com.transflow.backend.controller;

import com.transflow.backend.service.SimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/simulation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SimulationController {

    private final SimulationService simulationService;

    @PostMapping("/toggle")
    public Map<String, Boolean> toggleSimulation() {
        boolean newState = !simulationService.isRunning();
        simulationService.setRunning(newState);
        return Map.of("isRunning", newState);
    }

    @PostMapping("/speed")
    public Map<String, Double> setSpeed(@RequestParam double multiplier) {
        simulationService.setTimeMultiplier(multiplier);
        return Map.of("timeMultiplier", multiplier);
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return Map.of(
                "isRunning", simulationService.isRunning(),
                "timeMultiplier", simulationService.getTimeMultiplier()
        );
    }
}