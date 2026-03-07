import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import MapResizer from './MapResizer';
import LocationLayer from './layers/LocationLayer';
import VehicleLayer from './layers/VehicleLayer';
import RouteLayer from './layers/RouteLayer';
import OrderBuilder from './overlays/OrderBuilder';
import ActiveOrdersPanel from './overlays/ActiveOrdersPanel';
import InfoHUD from './overlays/InfoHUD';
import { useSimulation } from '../../context/SimulationContext';
import { MapProvider, useMapContext } from './MapContext';

const MapEventsHandler = () => {
    const { setSelectedRouteVehicleId, setSelectedLocationId } = useMapContext();
    useMapEvents({
        click: () => {
            setSelectedRouteVehicleId(null);
            setSelectedLocationId(null);
        },
    });
    return null;
};

const MapInner = () => {
    const { mapCenter, mapZoom } = useSimulation();

    return (
        <div className="absolute inset-0 z-0">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                preferCanvas={true}
                style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
                className="z-0 bg-slate-900"
            >
                <MapResizer />
                <MapEventsHandler />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                <RouteLayer />
                <LocationLayer />
                <VehicleLayer />
            </MapContainer>

            <OrderBuilder />
            <ActiveOrdersPanel />
            <InfoHUD />
        </div>
    );
};

export default function MapCanvas() {
    return (
        <MapProvider>
            <MapInner />
        </MapProvider>
    );
}