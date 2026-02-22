import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck, Activity } from 'lucide-react';
import SimulationControls from './map/SimulationControls';
import MapResizer from './map/MapResizer';
import { useSimulation } from '../context/SimulationContext';

const truckIconHtml = renderToString(
    <div className="bg-slate-900 p-2 rounded-full border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] text-cyan-400 flex items-center justify-center">
        <Truck size={20} />
    </div>
);

const customTruckIcon = L.divIcon({
    className: 'bg-transparent border-none transition-all duration-[2000ms] ease-linear',
    html: truckIconHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

export default function TruckMap() {
    const { trucks, mapCenter, mapZoom } = useSimulation();

    return (
        <div className="absolute inset-0 z-0">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
                className="z-0 bg-slate-900"
            >
                <MapResizer />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />

                {Array.from(trucks.values()).map((truck) => (
                    <Marker key={truck.id} position={[truck.currentLat || 0, truck.currentLng || 0]} icon={customTruckIcon}>
                        <Popup closeButton={false} autoPan={false}>
                            <div className="text-slate-800 font-sans min-w-[150px]">
                                <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                    {truck.vehicle.brand} {truck.vehicle.model}
                                </strong>
                                <span className="text-sm leading-tight text-slate-600">
                                    Rej: <strong className="text-slate-800">{truck.vehicle.plateNumber}</strong><br/>
                                    Postęp: <strong className="text-cyan-600">{(truck.progress * 100).toFixed(1)}%</strong>
                                </span>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            <div className="absolute top-6 right-6 z-[1000] w-80 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Activity size={18} className="text-cyan-400" />
                        Zlecenia w toku
                    </h2>
                    <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded-full font-medium">
                        {trucks.size} w trasie
                    </span>
                </div>
                <div className="p-4 flex-1 min-h-[150px] max-h-[400px] overflow-y-auto">
                    {trucks.size === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">Czysto na drogach...</div>
                    ) : (
                        <div className="space-y-4">
                            {Array.from(trucks.values()).map(truck => (
                                <div key={truck.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-white font-medium text-sm">{truck.vehicle.plateNumber}</span>
                                        <span className="text-cyan-400 text-xs font-bold">{(truck.progress * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-cyan-400 h-full transition-all duration-1000" style={{ width: `${truck.progress * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <SimulationControls />
        </div>
    );
}