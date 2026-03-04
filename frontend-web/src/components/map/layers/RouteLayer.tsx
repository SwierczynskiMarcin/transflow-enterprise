import { useMemo, Fragment } from 'react';
import { Polyline } from 'react-leaflet';
import { useSimulation, decodePolyline } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';

export default function RouteLayer() {
    const { activeRoutes, trucks } = useSimulation();
    const { selectedRouteVehicleId, hoveredVehicleId, previewRoute1, previewRoute2 } = useMapContext();

    const targetId = selectedRouteVehicleId || hoveredVehicleId;
    const activeRoute = targetId ? activeRoutes.get(targetId) : null;
    const activeTruck = targetId ? trucks.get(targetId) : null;

    const poly1 = useMemo(() => {
        return activeRoute?.routePolylineApproaching ? decodePolyline(activeRoute.routePolylineApproaching) : [];
    }, [activeRoute?.routePolylineApproaching]);

    const poly2 = useMemo(() => {
        return activeRoute?.routePolylineTransit ? decodePolyline(activeRoute.routePolylineTransit) : [];
    }, [activeRoute?.routePolylineTransit]);

    return (
        <>
            {activeRoute && activeTruck && (
                <Fragment>
                    {poly2.length > 0 && (
                        <Polyline positions={poly2} color="#3b82f6" weight={6} opacity={1} />
                    )}
                    {activeTruck.orderStatus === 'APPROACHING' && poly1.length > 0 && (
                        <Polyline positions={poly1} color="#fbbf24" weight={5} dashArray="10, 10" opacity={1} />
                    )}
                </Fragment>
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