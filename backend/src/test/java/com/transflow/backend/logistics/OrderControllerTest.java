package com.transflow.backend.logistics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderControllerTest {

    @InjectMocks
    private OrderController orderController;

    @Mock
    private OrderService orderService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should create order successfully and broadcast updates to WebSockets")
    void shouldCreateOrderAndBroadcastUpdates() {
        OrderCreateRequest request = new OrderCreateRequest(1L, 1L, 2L, "poly1", 1000.0, "poly2", 2000.0, 4.5);
        Order savedOrder = new Order();
        savedOrder.setId(100L);
        savedOrder.setStatus("APPROACHING");

        when(orderService.createOrder(any(OrderCreateRequest.class))).thenReturn(savedOrder);

        ResponseEntity<OrderDTO> response = orderController.createOrder(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(100L, Objects.requireNonNull(response.getBody()).id());
        assertEquals("APPROACHING", response.getBody().status());

        verify(orderService).createOrder(request);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
        verifyNoMoreInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should propagate exception and not send WebSocket events when creation fails")
    void shouldPropagateExceptionOnCreationFailure() {
        OrderCreateRequest request = new OrderCreateRequest(99L, 1L, 2L, "poly1", 1000.0, "poly2", 2000.0, 4.5);

        when(orderService.createOrder(any(OrderCreateRequest.class)))
                .thenThrow(new IllegalArgumentException("Vehicle not found"));

        assertThrows(IllegalArgumentException.class, () -> orderController.createOrder(request));

        verify(orderService).createOrder(request);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should get all orders mapped to DTOs")
    void shouldGetAllOrders() {
        Order order = new Order();
        order.setId(1L);
        when(orderService.getAllOrders()).thenReturn(List.of(order));

        ResponseEntity<List<OrderDTO>> response = orderController.getAllOrders();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, Objects.requireNonNull(response.getBody()).size());
        assertEquals(1L, response.getBody().get(0).id());
    }

    @Test
    @DisplayName("Should handle empty list when getting all orders")
    void shouldHandleEmptyListWhenGettingAllOrders() {
        when(orderService.getAllOrders()).thenReturn(Collections.emptyList());

        ResponseEntity<List<OrderDTO>> response = orderController.getAllOrders();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, Objects.requireNonNull(response.getBody()).size());
    }

    @Test
    @DisplayName("Should get active routes correctly")
    void shouldGetActiveRoutes() {
        ActiveRouteDTO routeDTO = new ActiveRouteDTO(1L, "poly1", "poly2", "IN_TRANSIT");
        when(orderService.getActiveRoutes()).thenReturn(List.of(routeDTO));

        ResponseEntity<List<ActiveRouteDTO>> response = orderController.getActiveRoutes();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, Objects.requireNonNull(response.getBody()).size());
        assertEquals("IN_TRANSIT", response.getBody().get(0).orderStatus());
    }

    @Test
    @DisplayName("Should handle empty list when getting active routes")
    void shouldHandleEmptyListWhenGettingActiveRoutes() {
        when(orderService.getActiveRoutes()).thenReturn(Collections.emptyList());

        ResponseEntity<List<ActiveRouteDTO>> response = orderController.getActiveRoutes();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(0, Objects.requireNonNull(response.getBody()).size());
    }
}