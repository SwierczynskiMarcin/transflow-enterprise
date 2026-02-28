package com.transflow.backend.controller;

import com.transflow.backend.dto.ActiveRouteDTO;
import com.transflow.backend.dto.OrderCreateRequest;
import com.transflow.backend.model.Order;
import com.transflow.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody OrderCreateRequest request) {
        Order newOrder = orderService.createOrder(request);
        return ResponseEntity.ok(newOrder);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/active-routes")
    public ResponseEntity<List<ActiveRouteDTO>> getActiveRoutes() {
        return ResponseEntity.ok(orderService.getActiveRoutes());
    }
}