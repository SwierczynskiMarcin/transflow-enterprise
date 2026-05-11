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
class CommercialTransportHandlerTest {

    @InjectMocks
    private CommercialTransportHandler handler;

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
        assertTrue(handler.supports("APPROACHING"));
        assertTrue(handler.supports("LOADING"));
        assertTrue(handler.supports("IN_TRANSIT"));
    }

    @Test
    void shouldAdvanceProgressWhenApproaching() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setCurrentOdometer(100.0);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStatus("APPROACHING");
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
    void shouldTransitionToLoadingWhenApproachingFinishes() {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setCurrentOdometer(100.0);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setStatus("APPROACHING");
        order.setProgress(0.95);
        order.setRoutePolylineApproaching("poly");
        order.setRouteDistanceApproaching(1000.0);
        order.setGpsDistance(10.0);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});

        handler.handle(order, 1000.0, 1.0, ctx);

        assertEquals("LOADING", order.getStatus());
        assertEquals(0.0, order.getProgress());
        assertTrue(ctx.isBroadcastOrders());
    }

    @Test
    void shouldDecreaseLoadingTicks() {
        Order order = new Order();
        order.setStatus("LOADING");
        order.setLoadingTicksRemaining(3);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        handler.handle(order, 0.0, 0.0, ctx);

        assertEquals(2, order.getLoadingTicksRemaining());
        assertEquals("LOADING", order.getStatus());
    }

    @Test
    void shouldTransitionToInTransitWhenLoadingFinishes() {
        Order order = new Order();
        order.setStatus("LOADING");
        order.setLoadingTicksRemaining(1);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        handler.handle(order, 0.0, 0.0, ctx);

        assertEquals("IN_TRANSIT", order.getStatus());
        assertEquals(0.0, order.getProgress());
        assertEquals(0, order.getLoadingTicksRemaining());
        assertTrue(ctx.isBroadcastOrders());
    }

    @Test
    void shouldCompleteOrderAndFreeVehicleWhenInTransitFinishes() {
        Driver driver = new Driver();
        driver.setStatus("BUSY");

        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setStatus("BUSY");
        vehicle.setCurrentOdometer(100.0);

        Order order = new Order();
        order.setVehicle(vehicle);
        order.setDriver(driver);
        order.setStatus("IN_TRANSIT");
        order.setProgress(0.95);
        order.setRoutePolylineTransit("poly");
        order.setRouteDistanceTransit(1000.0);
        order.setGpsDistance(10.0);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});

        handler.handle(order, 1000.0, 1.0, ctx);

        assertEquals("COMPLETED", order.getStatus());
        assertEquals("AVAILABLE", vehicle.getStatus());
        assertEquals("AVAILABLE", driver.getStatus());
        assertTrue(ctx.getDriversToSave().contains(driver));
        assertTrue(ctx.isBroadcastOrders());
        assertTrue(ctx.isBroadcastVehicles());
        assertTrue(ctx.isBroadcastDrivers());
    }

    @Test
    void shouldTakeOverBrokenOrderWhenTargetRescueIdIsSet() {
        Driver rescuerDriver = new Driver();
        rescuerDriver.setId(10L);

        Vehicle rescuer = new Vehicle();
        rescuer.setId(1L);
        rescuer.setStatus("BUSY");
        rescuer.setCurrentOdometer(100.0);
        rescuer.setTargetRescueId(2L);
        rescuer.setCurrentLat(52.0);
        rescuer.setCurrentLng(21.0);

        Order currentOrder = new Order();
        currentOrder.setVehicle(rescuer);
        currentOrder.setDriver(rescuerDriver);
        currentOrder.setStatus("IN_TRANSIT");
        currentOrder.setProgress(0.95);
        currentOrder.setRoutePolylineTransit("poly");
        currentOrder.setRouteDistanceTransit(1000.0);
        currentOrder.setGpsDistance(10.0);

        Vehicle broken = new Vehicle();
        broken.setId(2L);
        broken.setStatus("BROKEN");

        Driver brokenDriver = new Driver();
        brokenDriver.setId(20L);
        brokenDriver.setStatus("BUSY");

        Location startLoc = new Location();
        startLoc.setLatitude(51.0);
        startLoc.setLongitude(20.0);

        Order brokenOrder = new Order();
        brokenOrder.setId(100L);
        brokenOrder.setVehicle(broken);
        brokenOrder.setDriver(brokenDriver);
        brokenOrder.setStatus("APPROACHING");
        brokenOrder.setStartLocation(startLoc);

        SimulationUpdateContext ctx = new SimulationUpdateContext();

        when(physicsService.getPositionAtDistance(anyString(), anyDouble())).thenReturn(new double[]{52.0, 21.0});
        when(vehicleRepository.findById(2L)).thenReturn(Optional.of(broken));
        when(orderRepository.findByStatusIn(List.of("APPROACHING", "LOADING", "IN_TRANSIT", "HANDOVER")))
                .thenReturn(List.of(brokenOrder));
        when(routingService.getRoute(52.0, 21.0, 51.0, 20.0))
                .thenReturn(new RoutingService.RouteInfo("newPoly", 5000.0));

        handler.handle(currentOrder, 1000.0, 1.0, ctx);

        assertEquals("COMPLETED", currentOrder.getStatus());
        assertEquals("WAITING_FOR_TOW", broken.getStatus());
        assertEquals("BUSY", rescuer.getStatus());
        assertEquals("AVAILABLE", brokenDriver.getStatus());
        assertEquals(rescuer, brokenOrder.getVehicle());
        assertEquals(rescuerDriver, brokenOrder.getDriver());
        assertEquals("newPoly", brokenOrder.getRoutePolylineApproaching());
        assertTrue(ctx.getOrdersToSave().contains(brokenOrder));
        assertTrue(ctx.getVehiclesToSave().contains(broken));
        assertTrue(ctx.getDriversToSave().contains(brokenDriver));
    }
}