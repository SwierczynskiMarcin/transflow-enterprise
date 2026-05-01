package com.transflow.backend.logistics;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;

@Service
@RequiredArgsConstructor
public class AutomationService {

    private final OrderRepository orderRepository;

    @Value("${uipath.robot.path}")
    private String robotPath;

    @Value("${uipath.project.biller}")
    private String billerPath;

    @Value("${uipath.project.collector}")
    private String collectorPath;

    @Value("${uipath.project.auditor}")
    private String auditorPath;

    private final AtomicBoolean isRobotBusy = new AtomicBoolean(false);

    @Async
    public void triggerBiller() {
        if (isRobotBusy.compareAndSet(false, true)) {
            executeRobot(billerPath);
        }
    }

    @Async
    public void triggerCollector() {
        if (isRobotBusy.compareAndSet(false, true)) {
            executeRobot(collectorPath);
        }
    }

    @Async
    public void triggerAuditor() {
        if (isRobotBusy.compareAndSet(false, true)) {
            executeRobot(auditorPath);
        }
    }

    public void releaseRobot() {
        isRobotBusy.set(false);
    }

    @Scheduled(fixedDelay = 10000)
    public void watchdog() {
        if (isRobotBusy.get()) {
            return;
        }

        if (!orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false).isEmpty()) {
            triggerBiller();
            return;
        }
        if (!orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false).isEmpty()) {
            triggerCollector();
            return;
        }
        if (!orderRepository.findByStatusAndRpaPaymentInfoReceivedAndRpaAuditStatusAndStartLocationIsNotNull("COMPLETED", true, "PENDING").isEmpty()) {
            triggerAuditor();
        }
    }

    private void executeRobot(String projectPath) {
        try {
            String safeRobotPath = robotPath.replace("/", "\\");
            String safeProjectPath = projectPath.replace("/", "\\");

            ProcessBuilder pb = new ProcessBuilder(safeRobotPath, "execute", "--file", safeProjectPath);

            java.io.File robotExe = new java.io.File(safeRobotPath);
            pb.directory(robotExe.getParentFile());

            pb.inheritIO();

            Process p = pb.start();
            p.waitFor();

            Thread.sleep(5000);

        } catch (Exception e) {
        } finally {
            releaseRobot();
        }
    }
}