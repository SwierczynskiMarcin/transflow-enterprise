package com.transflow.backend.simulation.strategy;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
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
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RescueOperationHandlerTest {

    @InjectMocks
    private RescueOperationHandler handler;

    @Mock
    private PhysicsService physicsService;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RoutingService routingService;

    @Test
    void shouldSupportCorrectStatuses() {
        assertTrue(handler.supports("RESCUE_APPROACHING"));
        assertTrue(handler.supports("HANDOVER"));
    }

    @Test
    void shouldAdvanceProgressWhenRescueApproaching() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setCurrentOdometer(100.0);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStatus("RESCUE_APPROACHING");
        order.setProgress(0.5);
        order.setRoutePolylineApproaching("poly");
        order.setRouteDistanceApproaching(10000.0);
        order.setGpsDistance(10.0);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});

        handler.handle(order, 1000.0, 1.0, ctx);

        assertEquals(0.6, order.getProgress(), 0.001);
        assertEquals(52.0, vehicle.getCurrentLat());
        assertEquals(21.0, vehicle.getCurrentLng());
        assertEquals(101.0, vehicle.getCurrentOdometer());
    }

    @Test
    void shouldTransitionToHandoverWhenRescueApproachingFinishes() {
        Driver rescuerDriver = new Driver();
        rescuerDriver.setId(10L);

        Vehicle rescuer = new Vehicle();
        rescuer.setId(1L);
        rescuer.setStatus("RESCUE_MISSION");
        rescuer.setTargetRescueId(2L);
        rescuer.setCurrentOdometer(100.0);

        Order rescuerOrder = new Order();
        rescuerOrder.setVehicle(rescuer);
        rescuerOrder.setDriver(rescuerDriver);
        rescuerOrder.setStatus("RESCUE_APPROACHING");
        rescuerOrder.setProgress(0.95);
        rescuerOrder.setRoutePolylineApproaching("poly");
        rescuerOrder.setRouteDistanceApproaching(1000.0);
        rescuerOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);

        Driver brokenDriver = new Driver();
        brokenDriver.setId(20L);
        brokenDriver.setStatus("BUSY");

        Order brokenOrder = new Order();
        brokenOrder.setId(100L);
        brokenOrder.setVehicle(broken);
        brokenOrder.setDriver(brokenDriver);
        brokenOrder.setStatus("IN_TRANSIT");

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));
        when(orderRepository.findByStatusIn(List.of("IN_TRANSIT", "LOADING", "HANDOVER"))).thenReturn(List.of(brokenOrder));

        handler.handle(rescuerOrder, 1000.0, 1.0, ctx);

        assertEquals("COMPLETED", rescuerOrder.getStatus());
        assertEquals("HANDOVER", brokenOrder.getStatus());
        assertEquals("HANDOVER", rescuer.getStatus());
        assertEquals("WAITING_FOR_TOW", broken.getStatus());
        assertEquals("AVAILABLE", brokenDriver.getStatus());
        assertEquals(rescuer, brokenOrder.getVehicle());
        assertEquals(rescuerDriver, brokenOrder.getDriver());
        assertTrue(ctx.getOrdersToSave().contains(brokenOrder));
        assertTrue(ctx.getVehiclesToSave().contains(broken));
        assertTrue(ctx.getDriversToSave().contains(brokenDriver));
        assertTrue(ctx.isBroadcastOrders());
        assertTrue(ctx.isBroadcastVehicles());
        assertTrue(ctx.isBroadcastDrivers());
    }

    @Test
    void shouldTransitionToInTransitWhenHandoverFinishes() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setCurrentLat(52.0);
        vehicle.setCurrentLng(21.0);

        Location endLoc = new Location();
        endLoc.setLatitude(51.0);
        endLoc.setLongitude(20.0);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStatus("HANDOVER");
        order.setLoadingTicksRemaining(1);
        order.setEndLocation(endLoc);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(routingService.getRoute(52.0, 21.0, 51.0, 20.0))
                .thenReturn(new RoutingService.RouteInfo("newPoly", 10000.0));

        handler.handle(order, 0.0, 0.0, ctx);

        assertEquals("IN_TRANSIT", order.getStatus());
        assertEquals("BUSY", vehicle.getStatus());
        assertEquals(0, order.getLoadingTicksRemaining());
        assertEquals(0.0, order.getProgress());
        assertEquals("newPoly", order.getRoutePolylineTransit());
        assertEquals(10000.0, order.getRouteDistanceTransit());
        assertTrue(ctx.isBroadcastOrders());
        assertTrue(ctx.isBroadcastVehicles());
    }
}