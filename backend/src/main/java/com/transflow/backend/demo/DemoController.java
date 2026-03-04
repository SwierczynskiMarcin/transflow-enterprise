package com.transflow.backend.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/demo")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DemoController {

    private final DemoService demoService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/seed-locations")
    public ResponseEntity<?> seedLocations() {
        var response = demoService.seedLocations();
        messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/seed-fleet")
    public ResponseEntity<?> seedFleet() {
        var response = demoService.seedFleetAndStaff();
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/auto-dispatch")
    public ResponseEntity<?> autoDispatch(@RequestParam int count) {
        demoService.autoDispatch(count);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/clear-all")
    public ResponseEntity<?> clearAllData() {
        demoService.clearAllData();
        messagingTemplate.convertAndSend("/topic/updates", "LOCATIONS");
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        return ResponseEntity.ok().build();
    }
}