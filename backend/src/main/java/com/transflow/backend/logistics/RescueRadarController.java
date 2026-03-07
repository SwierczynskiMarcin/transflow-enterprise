package com.transflow.backend.logistics;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rescue-radar")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RescueRadarController {

    private final RescueRadarService rescueRadarService;

    @GetMapping("/{vehicleId}")
    public ResponseEntity<List<RescueCandidateDTO>> getCandidates(@PathVariable Long vehicleId) {
        return ResponseEntity.ok(rescueRadarService.scanForCandidates(vehicleId));
    }

    @PostMapping("/assign")
    public ResponseEntity<?> assignRescue(@RequestBody AssignRescueRequest request) {
        rescueRadarService.assignRescue(request.rescuerId(), request.brokenVehicleId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{vehicleId}/auto-assign")
    public ResponseEntity<?> autoAssignRescue(@PathVariable Long vehicleId) {
        rescueRadarService.autoAssignRescue(vehicleId);
        return ResponseEntity.ok().build();
    }
}