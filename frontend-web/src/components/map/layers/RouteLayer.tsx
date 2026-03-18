import { useMemo, Fragment } from 'react';
import { Polyline } from 'react-leaflet';
import { useSimulation, decodePolyline } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';

const ACTIVE_ORDER_STATUSES = new Set([
    'APPROACHING', 'LOADING', 'IN_TRANSIT',
    'RESCUE_APPROACHING', 'HANDOVER',
    'TOW_APPROACHING', 'WAITING_FOR_CARGO_CLEARANCE', 'TOWING'
]);

const RouteGroup = ({ vehicleId, isHover }: { vehicleId: number; isHover: boolean }) => {
    const { activeRoutes, trucks } = useSimulation();
    const activeRoute = activeRoutes.get(vehicleId);
    const activeTruck = trucks.get(vehicleId);

    const routeOrderStatus = activeRoute?.orderStatus ?? null;

    const poly1 = useMemo(
        () => activeRoute?.routePolylineApproaching ? decodePolyline(activeRoute.routePolylineApproaching) : [],
        [activeRoute?.routePolylineApproaching]
    );
    const poly2 = useMemo(
        () => activeRoute?.routePolylineTransit ? decodePolyline(activeRoute.routePolylineTransit) : [],
        [activeRoute?.routePolylineTransit]
    );

    if (!activeRoute || !activeTruck) return null;

    if (!routeOrderStatus || !ACTIVE_ORDER_STATUSES.has(routeOrderStatus)) return null;

    if (activeTruck.status === 'AVAILABLE') return null;

    const isBrokenState = activeTruck.status === 'BROKEN' ||
        activeTruck.status === 'WAITING_FOR_TOW' ||
        activeTruck.status === 'BEING_TOWED';

    const isActiveState = activeTruck.status === 'BUSY' ||
        activeTruck.status === 'RESCUE_MISSION' ||
        activeTruck.status === 'HANDOVER' ||
        activeTruck.status === 'TOW_APPROACHING' ||
        activeTruck.status === 'WAITING_FOR_CARGO_CLEARANCE' ||
        activeTruck.status === 'TOWING';

    if (!isActiveState && !isBrokenState) return null;

    const opacity = isHover ? 0.4 : (isBrokenState ? 0.7 : 1);

    const showTransitLine = poly2.length > 0 &&
        routeOrderStatus !== 'RESCUE_APPROACHING' &&
        routeOrderStatus !== 'TOW_APPROACHING';

    const showApproachingLine = routeOrderStatus === 'APPROACHING' && poly1.length > 0;
    const showRescueLine = routeOrderStatus === 'RESCUE_APPROACHING' && poly1.length > 0;
    const showTowLine = routeOrderStatus === 'TOW_APPROACHING' && poly1.length > 0;

    return (
        <Fragment>
            {showTransitLine && (
                <Polyline
                    key={`poly2-${vehicleId}-${routeOrderStatus}-${activeTruck.status}`}
                    positions={poly2}
                    color={isBrokenState ? '#ef4444' : (activeTruck.status === 'TOWING' ? '#f97316' : '#3b82f6')}
                    weight={isBrokenState ? 5 : 6}
                    dashArray={isBrokenState ? '10, 10' : ''}
                    opacity={opacity}
                />
            )}
            {showApproachingLine && (
                <Polyline
                    key={`poly1-approaching-${vehicleId}-${routeOrderStatus}-${activeTruck.status}`}
                    positions={poly1}
                    color={isBrokenState ? '#ef4444' : '#fbbf24'}
                    weight={5}
                    dashArray="10, 10"
                    opacity={opacity}
                />
            )}
            {showRescueLine && (
                <Polyline
                    key={`poly1-rescue-${vehicleId}-${routeOrderStatus}-${activeTruck.status}`}
                    positions={poly1}
                    color={isBrokenState ? '#ef4444' : '#8b5cf6'}
                    weight={5}
                    dashArray="10, 10"
                    opacity={opacity}
                />
            )}
            {showTowLine && (
                <Polyline
                    key={`poly1-tow-${vehicleId}-${routeOrderStatus}-${activeTruck.status}`}
                    positions={poly1}
                    color={isBrokenState ? '#ef4444' : '#f97316'}
                    weight={5}
                    dashArray="10, 10"
                    opacity={opacity}
                />
            )}
        </Fragment>
    );
};

export default function RouteLayer() {
    const { selectedRouteVehicleId, hoveredVehicleId, previewRoute1, previewRoute2 } = useMapContext();

    return (
        <>
            {selectedRouteVehicleId && (
                <RouteGroup vehicleId={selectedRouteVehicleId} isHover={false} />
            )}
            {hoveredVehicleId && hoveredVehicleId !== selectedRouteVehicleId && (
                <RouteGroup vehicleId={hoveredVehicleId} isHover={true} />
            )}
            {previewRoute2.length > 0 && (
                <Polyline positions={previewRoute2} color="#3b82f6" weight={5} dashArray="10, 10" opacity={0.8} />
            )}
            {previewRoute1.length > 0 && (
                <Polyline positions={previewRoute1} color="#fbbf24" weight={4} dashArray="10, 10" opacity={0.8} />
            )}
        </>
    );
}