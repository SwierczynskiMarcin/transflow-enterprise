package com.transflow.backend.logistics;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.simulation.PhysicsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RescueRadarServiceTest {

    @InjectMocks
    private RescueRadarService rescueRadarService;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private PhysicsService physicsService;

    @Mock
    private RoutingService routingService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    @DisplayName("Should throw IllegalArgumentException when scanning candidates for non-existent vehicle")
    void shouldThrowExceptionWhenScanningForNonExistentVehicle() {
        when(vehicleRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> rescueRadarService.scanForCandidates(99L));
        verifyNoInteractions(physicsService);
    }

    @Test
    @DisplayName("Should scan for candidates, filter invalid ones, and return sorted list")
    void shouldScanForCandidatesAndReturnSortedList() {
        Vehicle targetVehicle = new Vehicle();
        targetVehicle.setId(1L);
        targetVehicle.setCurrentLat(52.0);
        targetVehicle.setCurrentLng(21.0);

        Vehicle availableVehicle = new Vehicle();
        availableVehicle.setId(2L);
        availableVehicle.setPlateNumber("WA123");
        availableVehicle.setBrand("Volvo");
        availableVehicle.setStatus("AVAILABLE");
        availableVehicle.setIsServiceUnit(false);
        availableVehicle.setCurrentLat(52.5);
        availableVehicle.setCurrentLng(21.5);

        Vehicle brokenVehicle = new Vehicle();
        brokenVehicle.setId(3L);
        brokenVehicle.setStatus("BROKEN");

        Vehicle msuVehicle = new Vehicle();
        msuVehicle.setId(4L);
        msuVehicle.setIsServiceUnit(true);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(targetVehicle));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))).thenReturn(List.of());
        when(vehicleRepository.findAll()).thenReturn(List.of(targetVehicle, availableVehicle, brokenVehicle, msuVehicle));
        when(orderRepository.findByStatusIn(List.of("IN_TRANSIT", "APPROACHING", "LOADING"))).thenReturn(List.of());
        when(physicsService.calculateDistance(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(100.0);

        List<RescueCandidateDTO> candidates = rescueRadarService.scanForCandidates(1L);

        assertEquals(1, candidates.size());
        assertEquals(2L, candidates.get(0).vehicleId());
        assertEquals(75.0, candidates.get(0).etaMinutes());
    }

    @Test
    @DisplayName("Should release target rescue successfully and clear associated technical orders")
    void shouldReleaseRescueTargetSuccessfully() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setTargetRescueId(5L);

        Order technicalOrder = new Order();
        technicalOrder.setId(10L);
        technicalOrder.setVehicle(vehicle);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(orderRepository.findByStatusIn(List.of("RESCUE_APPROACHING"))).thenReturn(List.of(technicalOrder));

        rescueRadarService.releaseRescueTarget(1L);

        assertEquals("WAITING_FOR_TOW", vehicle.getStatus());
        assertNull(vehicle.getTargetRescueId());
        verify(vehicleRepository).save(vehicle);
        verify(orderRepository).delete(technicalOrder);
    }

    @Test
    @DisplayName("Should cascade release when broken vehicle itself was on a rescue mission")
    void shouldCascadeReleaseDuringAutoAssign() {
        Vehicle brokenVehicle = new Vehicle();
        brokenVehicle.setId(1L);
        brokenVehicle.setTargetRescueId(2L);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(brokenVehicle));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))).thenReturn(List.of());

        rescueRadarService.autoAssignRescue(1L);

        verify(vehicleRepository, atLeastOnce()).save(argThat(v -> v.getId().equals(1L) && v.getTargetRescueId() == null));
    }

    @Test
    @DisplayName("Should queue MSU job when all towing units are currently busy")
    void shouldQueueMsuJobWhenNoAvailableMsu() {
        Vehicle brokenVehicle = new Vehicle();
        brokenVehicle.setId(1L);
        brokenVehicle.setCurrentLat(50.0);
        brokenVehicle.setCurrentLng(20.0);

        Vehicle busyMsu = new Vehicle();
        busyMsu.setId(10L);
        busyMsu.setIsServiceUnit(true);
        busyMsu.setStatus("TOWING");

        Location baseLoc = new Location();
        baseLoc.setLatitude(52.0);
        baseLoc.setLongitude(21.0);
        baseLoc.setType("BASE");

        Order towOrder = new Order();
        towOrder.setVehicle(busyMsu);
        towOrder.setStatus("TOWING");
        towOrder.setProgress(0.5);
        towOrder.setRouteDistanceTransit(100000.0);
        towOrder.setEndLocation(baseLoc);

        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(brokenVehicle));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))).thenReturn(List.of());
        when(vehicleRepository.findAll()).thenReturn(List.of(busyMsu));
        when(orderRepository.findByStatusIn(List.of("TOW_APPROACHING", "TOWING", "WAITING_FOR_CARGO_CLEARANCE"))).thenReturn(List.of(towOrder));
        when(orderRepository.findByStatusIn(List.of("IN_TRANSIT", "APPROACHING", "LOADING"))).thenReturn(List.of());

        when(physicsService.calculateDistance(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(50.0);

        RoutingService.RouteInfo routeInfo = new RoutingService.RouteInfo("queued_poly", 150000.0);
        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(routeInfo);
        when(vehicleRepository.findById(10L)).thenReturn(Optional.of(busyMsu));

        rescueRadarService.autoAssignRescue(1L);

        verify(vehicleRepository).save(argThat(v -> v.getId().equals(10L) && v.getNextTowTargetId().equals(1L) && "queued_poly".equals(v.getNextTowPolyline())));
    }

    @Test
    @DisplayName("Should assign rescue and create orders when rescuer is available")
    void shouldAssignRescueWhenRescuerIsAvailableAndTargetIsApproaching() {
        Vehicle rescuer = new Vehicle();
        rescuer.setId(2L);
        rescuer.setStatus("AVAILABLE");
        rescuer.setCurrentLat(52.0);
        rescuer.setCurrentLng(21.0);

        Vehicle broken = new Vehicle();
        broken.setId(1L);
        broken.setCurrentLat(50.0);
        broken.setCurrentLng(20.0);

        Order brokenOrder = new Order();
        brokenOrder.setId(100L);
        brokenOrder.setVehicle(broken);
        brokenOrder.setStatus("APPROACHING");

        Location startLoc = new Location();
        startLoc.setLatitude(51.0);
        startLoc.setLongitude(21.0);
        brokenOrder.setStartLocation(startLoc);

        Driver rescuerDriver = new Driver();
        rescuerDriver.setId(10L);

        RoutingService.RouteInfo route = new RoutingService.RouteInfo("poly", 1000.0);

        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(rescuer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER")))
                .thenReturn(List.of(brokenOrder));
        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(route);
        when(driverRepository.findByAssignedVehicleId(2L)).thenReturn(Optional.of(rescuerDriver));

        rescueRadarService.assignRescue(2L, 1L);

        assertEquals("BUSY", rescuer.getStatus());
        assertEquals("WAITING_FOR_TOW", broken.getStatus());
        assertEquals(rescuer, brokenOrder.getVehicle());
        assertEquals(rescuerDriver, brokenOrder.getDriver());
        assertEquals("poly", brokenOrder.getRoutePolylineApproaching());

        verify(vehicleRepository).save(rescuer);
        verify(vehicleRepository).save(broken);
        verify(orderRepository).save(brokenOrder);
        verify(messagingTemplate).convertAndSend("/topic/updates", "ORDERS");
        verify(messagingTemplate).convertAndSend("/topic/updates", "VEHICLES");
    }

    @Test
    @DisplayName("Should apply rescue assignment without a driver gracefully")
    void shouldAssignRescueWhenRescuerHasNoDriver() {
        Vehicle rescuer = new Vehicle();
        rescuer.setId(2L);
        rescuer.setStatus("AVAILABLE");
        rescuer.setCurrentLat(52.0);
        rescuer.setCurrentLng(21.0);

        Vehicle broken = new Vehicle();
        broken.setId(1L);
        broken.setCurrentLat(50.0);
        broken.setCurrentLng(20.0);

        Order brokenOrder = new Order();
        brokenOrder.setId(100L);
        brokenOrder.setVehicle(broken);
        brokenOrder.setStatus("IN_TRANSIT");

        RoutingService.RouteInfo route = new RoutingService.RouteInfo("poly", 1000.0);

        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(rescuer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER")))
                .thenReturn(List.of(brokenOrder));
        when(routingService.getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(route);
        when(driverRepository.findByAssignedVehicleId(2L)).thenReturn(Optional.empty());

        rescueRadarService.assignRescue(2L, 1L);

        assertEquals("RESCUE_MISSION", rescuer.getStatus());
        assertEquals(1L, rescuer.getTargetRescueId());

        verify(vehicleRepository).save(rescuer);
        verify(vehicleRepository).save(broken);
        verify(orderRepository).save(argThat(o -> o.getStatus().equals("RESCUE_APPROACHING") && o.getDriver() == null));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when attempting to assign rescue to a vehicle without active order")
    void shouldThrowExceptionWhenAssigningRescueForVehicleWithoutOrder() {
        Vehicle rescuer = new Vehicle();
        rescuer.setId(2L);
        rescuer.setCurrentLat(52.0);
        rescuer.setCurrentLng(21.0);

        Vehicle broken = new Vehicle();
        broken.setId(1L);
        broken.setCurrentLat(50.0);
        broken.setCurrentLng(20.0);

        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(rescuer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER"))).thenReturn(List.of());

        assertThrows(IllegalArgumentException.class, () -> rescueRadarService.assignRescue(2L, 1L));

        verify(routingService, never()).getRoute(anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(vehicleRepository, never()).save(any());
    }
}