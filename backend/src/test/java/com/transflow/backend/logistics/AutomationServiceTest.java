package com.transflow.backend.logistics;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutomationServiceTest {

    @InjectMocks
    @Spy
    private AutomationService automationService;

    @Mock
    private OrderRepository orderRepository;

    private AtomicBoolean isRobotBusy;

    @BeforeEach
    void setUp() {
        isRobotBusy = (AtomicBoolean) ReflectionTestUtils.getField(automationService, "isRobotBusy");
        ReflectionTestUtils.setField(automationService, "robotPath", "dummyPath");
        ReflectionTestUtils.setField(automationService, "billerPath", "biller");
        ReflectionTestUtils.setField(automationService, "collectorPath", "collector");
        ReflectionTestUtils.setField(automationService, "auditorPath", "auditor");
    }

    @Test
    @DisplayName("Should skip processing when robot is already marked as busy")
    void shouldNotTriggerAnythingWhenRobotIsBusy() {
        isRobotBusy.set(true);

        automationService.watchdog();

        verify(orderRepository, never()).findByRpaEmailSentAndStartLocationIsNotNull(anyBoolean());
        verify(automationService, never()).triggerBiller();
        verify(automationService, never()).triggerCollector();
        verify(automationService, never()).triggerAuditor();
    }

    @Test
    @DisplayName("Should trigger Biller process when there are pending emails")
    void shouldTriggerBillerWhenPendingEmailsExist() {
        isRobotBusy.set(false);
        when(orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false)).thenReturn(List.of(new Order()));
        doNothing().when(automationService).triggerBiller();

        automationService.watchdog();

        verify(automationService).triggerBiller();
        verify(automationService, never()).triggerCollector();
        verify(automationService, never()).triggerAuditor();
    }

    @Test
    @DisplayName("Should trigger Collector process when there are pending payments and no pending emails")
    void shouldTriggerCollectorWhenPendingPaymentsExist() {
        isRobotBusy.set(false);
        when(orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false)).thenReturn(List.of());
        when(orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false))
                .thenReturn(List.of(new Order()));
        doNothing().when(automationService).triggerCollector();

        automationService.watchdog();

        verify(automationService, never()).triggerBiller();
        verify(automationService).triggerCollector();
        verify(automationService, never()).triggerAuditor();
    }

    @Test
    @DisplayName("Should trigger Auditor process when there are pending audits and no other pending tasks")
    void shouldTriggerAuditorWhenPendingAuditsExist() {
        isRobotBusy.set(false);
        when(orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false)).thenReturn(List.of());
        when(orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false))
                .thenReturn(List.of());
        when(orderRepository.findByStatusAndRpaPaymentInfoReceivedAndRpaAuditStatusAndStartLocationIsNotNull("COMPLETED", true, "PENDING"))
                .thenReturn(List.of(new Order()));
        doNothing().when(automationService).triggerAuditor();

        automationService.watchdog();

        verify(automationService, never()).triggerBiller();
        verify(automationService, never()).triggerCollector();
        verify(automationService).triggerAuditor();
    }

    @Test
    @DisplayName("Should handle immediate release when Robot path is invalid during execution")
    void shouldReleaseRobotOnExecutionFailure() {
        isRobotBusy.set(false);

        automationService.triggerBiller();

        assertFalse(isRobotBusy.get());
    }

    @Test
    @DisplayName("Should explicitly set robot flag to false on releaseRobot call")
    void shouldReleaseRobotCorrectly() {
        isRobotBusy.set(true);

        automationService.releaseRobot();

        assertFalse(isRobotBusy.get());
    }

    @Test
    @DisplayName("Should prevent concurrent executions if compareAndSet fails")
    void shouldPreventConcurrentTriggers() {
        isRobotBusy.set(true);

        automationService.triggerBiller();
        automationService.triggerCollector();
        automationService.triggerAuditor();

        assertTrue(isRobotBusy.get());
    }
}