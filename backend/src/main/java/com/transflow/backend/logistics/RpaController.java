package com.transflow.backend.logistics;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/rpa")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RpaController {

    private final OrderRepository orderRepository;
    private final InvoiceAuditRepository auditRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/pending-emails")
    public List<OrderDTO> getPendingEmails() {
        return orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false)
                .stream().map(OrderDTO::from).toList();
    }

    @PostMapping("/emails/{id}/mark-sent")
    public ResponseEntity<?> markEmailSent(@PathVariable Long id) {
        return orderRepository.findById(id).map(order -> {
            order.setRpaEmailSent(true);
            orderRepository.save(order);
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/pending-payments")
    public List<OrderDTO> getPendingPayments() {
        return orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false)
                .stream().map(OrderDTO::from).toList();
    }

    @PostMapping("/payments")
    public ResponseEntity<?> registerPayment(@RequestBody RpaPaymentRequest request) {
        return orderRepository.findById(request.orderId()).map(order -> {
            order.setRpaPaymentInfoReceived(true);
            orderRepository.save(order);
            messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/pending-audits")
    public List<OrderDTO> getPendingAudits() {
        return orderRepository.findByStatusAndRpaPaymentInfoReceivedAndRpaAuditStatusAndStartLocationIsNotNull("COMPLETED", true, "PENDING")
                .stream().map(OrderDTO::from).toList();
    }

    @PostMapping("/audit")
    public ResponseEntity<?> performAudit(@RequestBody RpaAuditRequest request) {
        Order order = orderRepository.findById(request.orderId())
                .orElseThrow(() -> new IllegalArgumentException(""));

        double roundedScannedAmount = Math.round(request.scannedAmount() * 100.0) / 100.0;
        double currentContractedAmount = order.getContractedAmount() != null ? order.getContractedAmount() : 0.0;
        double difference = Math.abs(currentContractedAmount - roundedScannedAmount);

        String result = difference <= 0.05 ? "APPROVED" : "DISCREPANCY";

        InvoiceAudit audit = new InvoiceAudit();
        audit.setOrder(order);
        audit.setScannedAmount(roundedScannedAmount);
        audit.setConfidenceScore(request.confidenceScore());
        audit.setAuditResult(result);
        audit.setTimestamp(LocalDateTime.now());
        auditRepository.save(audit);

        order.setRpaAuditStatus(result);
        orderRepository.save(order);

        messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
        return ResponseEntity.ok().build();
    }

    @PostMapping("/bot-status/biller/idle")
    public ResponseEntity<?> releaseBiller() {
        return ResponseEntity.ok().build();
    }

    @PostMapping("/bot-status/collector/idle")
    public ResponseEntity<?> releaseCollector() {
        return ResponseEntity.ok().build();
    }

    @PostMapping("/bot-status/auditor/idle")
    public ResponseEntity<?> releaseAuditor() {
        return ResponseEntity.ok().build();
    }
}