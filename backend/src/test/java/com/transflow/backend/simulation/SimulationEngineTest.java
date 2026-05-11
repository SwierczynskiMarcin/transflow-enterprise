package com.transflow.backend.simulation;

import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.simulation.strategy.OrderStateHandler;
import com.transflow.backend.simulation.strategy.SimulationUpdateContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SimulationEngineTest {

    @InjectMocks
    private SimulationEngine simulationEngine;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private VirtualClock virtualClock;

    @Mock
    private List<OrderStateHandler> stateHandlers;

    @Mock
    private TransactionTemplate transactionTemplate;

    @Test
    void shouldBroadcastStateAndAbortWhenNotRunning() {
        simulationEngine.setRunning(false);
        when(virtualClock.getCurrentTime()).thenReturn(LocalDateTime.now());

        simulationEngine.simulateMovement();

        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/simulation"), any(SimulationStateDTO.class));
        verify(transactionTemplate, never()).execute(any());
    }

    @Test
    void shouldExecuteTransactionAndBroadcastUpdatesWhenRunning() {
        simulationEngine.setRunning(true);
        when(virtualClock.getCurrentTime()).thenReturn(LocalDateTime.now());

        SimulationUpdateContext mockContext = new SimulationUpdateContext();
        mockContext.setBroadcastOrders(true);
        mockContext.setBroadcastVehicles(true);
        mockContext.setBroadcastDrivers(true);
        mockContext.addTickUpdate(new VehicleSimulationDTO(1L, "WA123", "Volvo", "FH", 52.0, 21.0, "BUSY", "IN_TRANSIT", 0.5, 100.0, null, false, null));

        when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<SimulationUpdateContext> callback = invocation.getArgument(0);
            return mockContext;
        });

        simulationEngine.simulateMovement();

        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/simulation"), any(SimulationStateDTO.class));
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "ORDERS");
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "VEHICLES");
        verify(messagingTemplate, times(1)).convertAndSend("/topic/updates", "DRIVERS");
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/trucks"), anyList());
    }

    @Test
    void shouldHandleOptimisticLockingFailureGracefully() {
        simulationEngine.setRunning(true);
        when(virtualClock.getCurrentTime()).thenReturn(LocalDateTime.now());

        when(transactionTemplate.execute(any())).thenThrow(new ObjectOptimisticLockingFailureException("Vehicle", 1L));

        assertDoesNotThrow(() -> simulationEngine.simulateMovement());

        verify(messagingTemplate, never()).convertAndSend(eq("/topic/updates"), anyString());
        verify(messagingTemplate, never()).convertAndSend(eq("/topic/trucks"), anyList());
    }

    @Test
    void shouldHandleGenericExceptionsGracefully() {
        simulationEngine.setRunning(true);
        when(virtualClock.getCurrentTime()).thenReturn(LocalDateTime.now());

        when(transactionTemplate.execute(any())).thenThrow(new RuntimeException("Unexpected Database Crash"));

        assertDoesNotThrow(() -> simulationEngine.simulateMovement());
    }
}