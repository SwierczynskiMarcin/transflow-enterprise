package com.transflow.backend.simulation.strategy;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
import com.transflow.backend.logistics.LocationRepository;
import com.transflow.backend.logistics.Order;
import com.transflow.backend.logistics.OrderRepository;
import com.transflow.backend.logistics.RoutingService;
import com.transflow.backend.simulation.PhysicsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TowingOperationHandlerTest {

    @InjectMocks
    private TowingOperationHandler handler;

    @Mock
    private PhysicsService physicsService;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private RoutingService routingService;

    @Mock
    private DriverRepository driverRepository;

    @Test
    void shouldSupportCorrectStatuses() {
        assertTrue(handler.supports("TOW_APPROACHING"));
        assertTrue(handler.supports("WAITING_FOR_CARGO_CLEARANCE"));
        assertTrue(handler.supports("TOWING"));
    }

    @Test
    void shouldTransitionToWaitingForCargoClearanceWhenTowApproachingFinishesButCargoExists() {
        Vehicle towTruck = new Vehicle();
        towTruck.setId(1L);
        towTruck.setTargetTowId(2L);
        towTruck.setCurrentOdometer(100.0);

        Order towOrder = new Order();
        towOrder.setVehicle(towTruck);
        towOrder.setStatus("TOW_APPROACHING");
        towOrder.setProgress(0.95);
        towOrder.setRoutePolylineApproaching("poly");
        towOrder.setRouteDistanceApproaching(1000.0);
        towOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);

        Order cargoOrder = new Order();
        cargoOrder.setVehicle(broken);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));
        when(vehicleRepository.findAll()).thenReturn(List.of(towTruck, broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER")))
                .thenReturn(List.of(cargoOrder));

        handler.handle(towOrder, 1000.0, 1.0, ctx);

        assertEquals("WAITING_FOR_CARGO_CLEARANCE", towOrder.getStatus());
        assertEquals("WAITING_FOR_CARGO_CLEARANCE", towTruck.getStatus());
    }

    @Test
    void shouldTransitionToTowingWhenTowApproachingFinishesAndCargoIsClear() {
        Vehicle towTruck = new Vehicle();
        towTruck.setId(1L);
        towTruck.setTargetTowId(2L);
        towTruck.setCurrentOdometer(100.0);
        towTruck.setCurrentLat(52.0);
        towTruck.setCurrentLng(21.0);

        Order towOrder = new Order();
        towOrder.setVehicle(towTruck);
        towOrder.setStatus("TOW_APPROACHING");
        towOrder.setProgress(0.95);
        towOrder.setRoutePolylineApproaching("poly");
        towOrder.setRouteDistanceApproaching(1000.0);
        towOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);

        Location base = new Location();
        base.setType("BASE");
        base.setLatitude(51.0);
        base.setLongitude(20.0);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));
        when(vehicleRepository.findAll()).thenReturn(List.of(towTruck, broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER")))
                .thenReturn(List.of());
        when(locationRepository.findAll()).thenReturn(List.of(base));
        when(routingService.getRoute(52.0, 21.0, 51.0, 20.0))
                .thenReturn(new RoutingService.RouteInfo("towPoly", 10000.0));

        handler.handle(towOrder, 1000.0, 1.0, ctx);

        assertEquals("TOWING", towOrder.getStatus());
        assertEquals("TOWING", towTruck.getStatus());
        assertEquals("BEING_TOWED", broken.getStatus());
        assertEquals("towPoly", towOrder.getRoutePolylineTransit());
        assertEquals(base, towOrder.getEndLocation());
    }

    @Test
    void shouldUpdateBothVehiclesWhenTowing() {
        Vehicle towTruck = new Vehicle();
        towTruck.setId(1L);
        towTruck.setTargetTowId(2L);
        towTruck.setCurrentOdometer(100.0);

        Order towOrder = new Order();
        towOrder.setVehicle(towTruck);
        towOrder.setStatus("TOWING");
        towOrder.setProgress(0.5);
        towOrder.setRoutePolylineTransit("poly");
        towOrder.setRouteDistanceTransit(10000.0);
        towOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));

        handler.handle(towOrder, 1000.0, 1.0, ctx);

        assertEquals(0.6, towOrder.getProgress(), 0.001);
        assertEquals(52.0, towTruck.getCurrentLat());
        assertEquals(21.0, towTruck.getCurrentLng());
        assertEquals(52.0, broken.getCurrentLat());
        assertEquals(21.0, broken.getCurrentLng());
        assertTrue(ctx.getVehiclesToSave().contains(broken));
        assertEquals(1, ctx.getTickUpdates().size());
        assertEquals(2L, ctx.getTickUpdates().get(0).vehicleId());
    }

    @Test
    void shouldCompleteAndTriggerNextMissionWhenTowingFinishes() {
        Driver driver = new Driver();
        driver.setId(10L);

        Vehicle towTruck = new Vehicle();
        towTruck.setId(1L);
        towTruck.setTargetTowId(2L);
        towTruck.setNextTowTargetId(3L);
        towTruck.setNextTowPolyline("nextPoly");
        towTruck.setNextTowDistance(5000.0);
        towTruck.setCurrentOdometer(100.0);

        Order towOrder = new Order();
        towOrder.setVehicle(towTruck);
        towOrder.setStatus("TOWING");
        towOrder.setProgress(0.95);
        towOrder.setRoutePolylineTransit("poly");
        towOrder.setRouteDistanceTransit(1000.0);
        towOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));
        when(driverRepository.findByAssignedVehicleId(1L)).thenReturn(Optional.of(driver));

        handler.handle(towOrder, 1000.0, 1.0, ctx);

        assertEquals("COMPLETED", towOrder.getStatus());
        assertEquals("AVAILABLE", broken.getStatus());
        assertEquals("TOW_APPROACHING", towTruck.getStatus());
        assertEquals(3L, towTruck.getTargetTowId());
        assertNull(towTruck.getNextTowTargetId());

        assertEquals(1, ctx.getNewOrdersToSave().size());
        Order nextOrder = ctx.getNewOrdersToSave().get(0);
        assertEquals("TOW_APPROACHING", nextOrder.getStatus());
        assertEquals("nextPoly", nextOrder.getRoutePolylineApproaching());
    }
}