package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.Vehicle;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrderRepositoryTest {

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private OrderRepository orderRepository;

    private Vehicle vehicle;
    private Driver driver;
    private Location startLocation;
    private Location endLocation;

    @BeforeEach
    void setUp() {
        vehicle = new Vehicle();
        vehicle.setPlateNumber("WA12345");
        vehicle.setStatus("BUSY");
        entityManager.persist(vehicle);

        driver = new Driver();
        driver.setFirstName("Jan");
        driver.setLastName("Kowalski");
        driver.setStatus("BUSY");
        driver.setAssignedVehicle(vehicle);
        entityManager.persist(driver);

        startLocation = new Location();
        startLocation.setName("Hub Warsaw");
        entityManager.persist(startLocation);

        endLocation = new Location();
        endLocation.setName("Hub Berlin");
        entityManager.persist(endLocation);

        entityManager.flush();
    }

    @Test
    @DisplayName("Should find orders by specific vehicle ID")
    void shouldFindOrdersByVehicleId() {
        Order order = new Order();
        order.setVehicle(vehicle);
        entityManager.persist(order);
        entityManager.flush();

        List<Order> results = orderRepository.findByVehicleId(vehicle.getId());

        assertEquals(1, results.size());
        assertEquals(vehicle.getId(), results.get(0).getVehicle().getId());
    }

    @Test
    @DisplayName("Should find orders by specific driver ID")
    void shouldFindOrdersByDriverId() {
        Order order = new Order();
        order.setDriver(driver);
        entityManager.persist(order);
        entityManager.flush();

        List<Order> results = orderRepository.findByDriverId(driver.getId());

        assertEquals(1, results.size());
        assertEquals(driver.getId(), results.get(0).getDriver().getId());
    }

    @Test
    @DisplayName("Should find orders matching any status in provided list")
    void shouldFindOrdersByStatusInList() {
        Order approachingOrder = new Order();
        approachingOrder.setStatus("APPROACHING");
        entityManager.persist(approachingOrder);

        Order completedOrder = new Order();
        completedOrder.setStatus("COMPLETED");
        entityManager.persist(completedOrder);

        entityManager.flush();

        List<Order> results = orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING"));

        assertEquals(1, results.size());
        assertEquals("APPROACHING", results.get(0).getStatus());
    }

    @Test
    @DisplayName("Should return true when checking existence by either start or end location ID")
    void shouldExistByStartLocationIdOrEndLocationId() {
        Order order = new Order();
        order.setStartLocation(startLocation);
        order.setEndLocation(endLocation);
        entityManager.persist(order);
        entityManager.flush();

        boolean existsByStart = orderRepository.existsByStartLocationIdOrEndLocationId(startLocation.getId(), 999L);
        boolean existsByEnd = orderRepository.existsByStartLocationIdOrEndLocationId(999L, endLocation.getId());
        boolean existsByBoth = orderRepository.existsByStartLocationIdOrEndLocationId(startLocation.getId(), endLocation.getId());
        boolean existsByNone = orderRepository.existsByStartLocationIdOrEndLocationId(999L, 888L);

        assertTrue(existsByStart);
        assertTrue(existsByEnd);
        assertTrue(existsByBoth);
        assertFalse(existsByNone);
    }

    @Test
    @DisplayName("Should find pending emails strictly for orders with defined start locations")
    void shouldFindPendingEmailsWithStartLocationNotNull() {
        Order validOrder = new Order();
        validOrder.setStartLocation(startLocation);
        validOrder.setRpaEmailSent(false);
        entityManager.persist(validOrder);

        Order invalidOrderNoLocation = new Order();
        invalidOrderNoLocation.setStartLocation(null);
        invalidOrderNoLocation.setRpaEmailSent(false);
        entityManager.persist(invalidOrderNoLocation);

        entityManager.flush();

        List<Order> results = orderRepository.findByRpaEmailSentAndStartLocationIsNotNull(false);

        assertEquals(1, results.size());
        assertNotNull(results.get(0).getStartLocation());
    }

    @Test
    @DisplayName("Should find pending payments for COMPLETED orders strictly with defined start locations")
    void shouldFindPendingPaymentsCorrectlyFiltered() {
        Order validOrder = new Order();
        validOrder.setStatus("COMPLETED");
        validOrder.setRpaEmailSent(true);
        validOrder.setRpaPaymentInfoReceived(false);
        validOrder.setStartLocation(startLocation);
        entityManager.persist(validOrder);

        Order orderWrongStatus = new Order();
        orderWrongStatus.setStatus("IN_TRANSIT");
        orderWrongStatus.setRpaEmailSent(true);
        orderWrongStatus.setRpaPaymentInfoReceived(false);
        orderWrongStatus.setStartLocation(startLocation);
        entityManager.persist(orderWrongStatus);

        entityManager.flush();

        List<Order> results = orderRepository.findByStatusAndRpaEmailSentAndRpaPaymentInfoReceivedAndStartLocationIsNotNull("COMPLETED", true, false);

        assertEquals(1, results.size());
        assertEquals("COMPLETED", results.get(0).getStatus());
    }

    @Test
    @DisplayName("Should find pending audits strictly requiring payment info received and start location")
    void shouldFindPendingAuditsCorrectlyFiltered() {
        Order validOrder = new Order();
        validOrder.setStatus("COMPLETED");
        validOrder.setRpaPaymentInfoReceived(true);
        validOrder.setRpaAuditStatus("PENDING");
        validOrder.setStartLocation(startLocation);
        entityManager.persist(validOrder);

        Order orderMissingPayment = new Order();
        orderMissingPayment.setStatus("COMPLETED");
        orderMissingPayment.setRpaPaymentInfoReceived(false);
        orderMissingPayment.setRpaAuditStatus("PENDING");
        orderMissingPayment.setStartLocation(startLocation);
        entityManager.persist(orderMissingPayment);

        entityManager.flush();

        List<Order> results = orderRepository.findByStatusAndRpaPaymentInfoReceivedAndRpaAuditStatusAndStartLocationIsNotNull("COMPLETED", true, "PENDING");

        assertEquals(1, results.size());
        assertTrue(results.get(0).getRpaPaymentInfoReceived());
        assertEquals("PENDING", results.get(0).getRpaAuditStatus());
    }
}