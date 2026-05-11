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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RpaControllerTest {

    @InjectMocks
    private RpaController rpaController;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private InvoiceAuditRepository auditRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should fetch all pending emails properly mapped to DTOs")
    void shouldGetPendingEmailsCorrectlyFiltered() {
        Order order = new Order();
        order.setId(1L);
        when(orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false)).thenReturn(List.of(order));

        List<OrderDTO> result = rpaController.getPendingEmails();

        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).id());
    }

    @Test
    @DisplayName("Should set email as sent, save order and broadcast update")
    void shouldMarkEmailSentAndBroadcast() {
        Order order = new Order();
        order.setId(1L);
        order.setRpaEmailSent(false);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ResponseEntity<?> response = rpaController.markEmailSent(1L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(true, order.getRpaEmailSent());
        verify(orderRepository).save(order);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should return 404 when marking email sent for non-existent order")
    void shouldReturnNotFoundWhenMarkingEmailForNonExistentOrder() {
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = rpaController.markEmailSent(99L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(orderRepository, never()).save(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should fetch all pending payments properly mapped to DTOs")
    void shouldGetPendingPaymentsCorrectlyFiltered() {
        Order order = new Order();
        order.setId(2L);
        when(orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false))
                .thenReturn(List.of(order));

        List<OrderDTO> result = rpaController.getPendingPayments();

        assertEquals(1, result.size());
        assertEquals(2L, result.get(0).id());
    }

    @Test
    @DisplayName("Should register incoming RPA payment successfully")
    void shouldRegisterPaymentAndBroadcast() {
        RpaPaymentRequest request = new RpaPaymentRequest(1L);
        Order order = new Order();
        order.setId(1L);
        order.setRpaPaymentInfoReceived(false);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ResponseEntity<?> response = rpaController.registerPayment(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(true, order.getRpaPaymentInfoReceived());
        verify(orderRepository).save(order);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should return 404 when registering payment for non-existent order")
    void shouldReturnNotFoundWhenRegisteringPaymentForNonExistentOrder() {
        RpaPaymentRequest request = new RpaPaymentRequest(99L);
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseEntity<?> response = rpaController.registerPayment(request);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(orderRepository, never()).save(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should fetch all pending audits properly mapped to DTOs")
    void shouldGetPendingAuditsCorrectlyFiltered() {
        Order order = new Order();
        order.setId(3L);
        when(orderRepository.findByStatusAndRpaPaymentInfoReceivedAndRpaAuditStatusAndStartLocationIsNotNull("COMPLETED", true, "PENDING"))
                .thenReturn(List.of(order));

        List<OrderDTO> result = rpaController.getPendingAudits();

        assertEquals(1, result.size());
        assertEquals(3L, result.get(0).id());
    }

    @Test
    @DisplayName("Should approve audit when scanned amount matches contracted amount within tolerance")
    void shouldPerformAuditAndApproveWhenMarginIsWithinTolerance() {
        RpaAuditRequest request = new RpaAuditRequest(1L, 450.04, 0.99);
        Order order = new Order();
        order.setId(1L);
        order.setContractedAmount(450.0);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ResponseEntity<?> response = rpaController.performAudit(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("APPROVED", order.getRpaAuditStatus());
        verify(auditRepository).save(argThat(audit -> "APPROVED".equals(audit.getAuditResult())));
        verify(orderRepository).save(order);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should flag discrepancy when scanned amount exceeds tolerance limit")
    void shouldPerformAuditAndFlagDiscrepancyWhenMarginExceedsTolerance() {
        RpaAuditRequest request = new RpaAuditRequest(1L, 400.0, 0.99);
        Order order = new Order();
        order.setId(1L);
        order.setContractedAmount(450.0);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ResponseEntity<?> response = rpaController.performAudit(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("DISCREPANCY", order.getRpaAuditStatus());
        verify(auditRepository).save(argThat(audit -> "DISCREPANCY".equals(audit.getAuditResult())));
        verify(orderRepository).save(order);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
    }

    @Test
    @DisplayName("Should handle missing contracted amount gracefully by defaulting to zero and flagging discrepancy")
    void shouldPerformAuditSafelyWhenContractedAmountIsNull() {
        RpaAuditRequest request = new RpaAuditRequest(1L, 50.0, 0.95);
        Order order = new Order();
        order.setId(1L);
        order.setContractedAmount(null);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));

        ResponseEntity<?> response = rpaController.performAudit(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("DISCREPANCY", order.getRpaAuditStatus());
        verify(auditRepository).save(any(InvoiceAudit.class));
        verify(orderRepository).save(order);
    }

    @Test
    @DisplayName("Should throw exception when attempting to audit a non-existent order")
    void shouldThrowExceptionWhenAuditingNonExistentOrder() {
        RpaAuditRequest request = new RpaAuditRequest(99L, 100.0, 0.99);
        when(orderRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> rpaController.performAudit(request));

        verify(auditRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("Should handle biller release endpoint successfully")
    void shouldReleaseBillerSuccessfully() {
        ResponseEntity<?> response = rpaController.releaseBiller();
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    @DisplayName("Should handle collector release endpoint successfully")
    void shouldReleaseCollectorSuccessfully() {
        ResponseEntity<?> response = rpaController.releaseCollector();
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    @Test
    @DisplayName("Should handle auditor release endpoint successfully")
    void shouldReleaseAuditorSuccessfully() {
        ResponseEntity<?> response = rpaController.releaseAuditor();
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }
}