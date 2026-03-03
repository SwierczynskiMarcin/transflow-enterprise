import { useMemo, Fragment } from 'react';
import { Polyline } from 'react-leaflet';
import { useSimulation, decodePolyline } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';

export default function RouteLayer() {
    const { activeRoutes, trucks } = useSimulation();
    const { selectedRouteVehicleId, previewRoute1, previewRoute2 } = useMapContext();

    const selectedRoute = selectedRouteVehicleId ? activeRoutes.get(selectedRouteVehicleId) : null;
    const selectedTruck = selectedRouteVehicleId ? trucks.get(selectedRouteVehicleId) : null;

    const poly1 = useMemo(() => {
        return selectedRoute?.routePolylineApproaching ? decodePolyline(selectedRoute.routePolylineApproaching) : [];
    },[selectedRoute?.routePolylineApproaching]);

    const poly2 = useMemo(() => {
        return selectedRoute?.routePolylineTransit ? decodePolyline(selectedRoute.routePolylineTransit) :[];
    },[selectedRoute?.routePolylineTransit]);

    return (
        <>
            {selectedRoute && selectedTruck && (
                <Fragment>
                    {poly2.length > 0 && (
                        <Polyline positions={poly2} color="#3b82f6" weight={6} opacity={selectedTruck.orderStatus === 'APPROACHING' ? 0.3 : 0.8} />
                    )}
                    {selectedTruck.orderStatus === 'APPROACHING' && poly1.length > 0 && (
                        <Polyline positions={poly1} color="#fbbf24" weight={4} dashArray="10, 10" opacity={0.9} />
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