package com.transflow.backend.logistics;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(@RequestBody OrderCreateRequest request) {
        Order newOrder = orderService.createOrder(request);
        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
        return ResponseEntity.ok(OrderDTO.from(newOrder));
    }

    @GetMapping
    public ResponseEntity<List<OrderDTO>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders().stream().map(OrderDTO::from).toList());
    }

    @GetMapping("/active-routes")
    public ResponseEntity<List<ActiveRouteDTO>> getActiveRoutes() {
        return ResponseEntity.ok(orderService.getActiveRoutes());
    }
}