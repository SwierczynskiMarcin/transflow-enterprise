package com.transflow.backend.logistics;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
        for (int i = 0; i < 3; i++) {
            try {
                rescueRadarService.assignRescue(request.rescuerId(), request.brokenVehicleId());
                return ResponseEntity.ok().build();
            } catch (ObjectOptimisticLockingFailureException e) {
                if (i == 2) throw e;
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            }
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{vehicleId}/auto-assign")
    public ResponseEntity<?> autoAssignRescue(@PathVariable Long vehicleId) {
        for (int i = 0; i < 3; i++) {
            try {
                rescueRadarService.autoAssignRescue(vehicleId);
                return ResponseEntity.ok().build();
            } catch (ObjectOptimisticLockingFailureException e) {
                if (i == 2) throw e;
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            }
        }
        return ResponseEntity.ok().build();
    }
}