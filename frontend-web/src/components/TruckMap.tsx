import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck, Activity, Building2 } from 'lucide-react';
import SimulationControls from './map/SimulationControls';
import MapResizer from './map/MapResizer';
import { useSimulation } from '../context/SimulationContext';

const createTruckIcon = (colorClass: string, glowColor: string) => {
    const htmlString = renderToString(
        <div className={`bg-slate-900 p-2 rounded-full border-2 ${colorClass} shadow-[0_0_15px_${glowColor}] flex items-center justify-center`}>
            <Truck size={20} className={colorClass.replace('border-', 'text-')} />
        </div>
    );

    return L.divIcon({
        className: 'bg-transparent border-none transition-all duration-[2000ms] ease-linear',
        html: htmlString,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
};

const busyIcon = createTruckIcon('border-cyan-400', 'rgba(34,211,238,0.5)');
const availableIcon = createTruckIcon('border-emerald-400', 'rgba(52,211,153,0.5)');

const createLocationIcon = (type: string) => {
    let colorClass = 'border-rose-400';
    let textColorClass = 'text-rose-400';
    let glowColor = 'rgba(244,63,94,0.3)';

    if (type === 'BASE') {
        colorClass = 'border-blue-400';
        textColorClass = 'text-blue-400';
        glowColor = 'rgba(96,165,250,0.3)';
    } else if (type === 'PORT') {
        colorClass = 'border-indigo-400';
        textColorClass = 'text-indigo-400';
        glowColor = 'rgba(129,140,248,0.3)';
    }

    const htmlString = renderToString(
        <div className={`bg-slate-800 p-1.5 rounded-lg border-2 ${colorClass} shadow-[0_0_10px_${glowColor}] flex items-center justify-center`}>
            <Building2 size={16} className={textColorClass} />
        </div>
    );

    return L.divIcon({
        className: 'bg-transparent border-none',
        html: htmlString,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

export default function TruckMap() {
    const { trucks, locations, mapCenter, mapZoom } = useSimulation(); // NOWE: wyciągam locations z contextu

    const activeTrucks = Array.from(trucks.values()).filter(t => t.status === 'BUSY');

    return (
        <div className="absolute inset-0 z-0">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
                className="z-0 bg-slate-900"
            >
                <MapResizer />
                {/* Twoja jasna mapa */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />

                {locations.map(loc => (
                    <Marker
                        key={`loc-${loc.id}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={createLocationIcon(loc.type)}
                    >
                        <Popup closeButton={false} autoPan={false}>
                            <div className="text-slate-800 font-sans min-w-[150px]">
                                <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                    {loc.name}
                                </strong>
                                <span className="text-sm leading-tight text-slate-600 block mb-2">
                                    {loc.companyName || 'Brak firmy'}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                    loc.type === 'BASE' ? 'bg-blue-100 text-blue-800' :
                                        loc.type === 'PORT' ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-rose-100 text-rose-800'
                                }`}>
                                    {loc.type === 'BASE' ? 'Baza Floty' : loc.type === 'PORT' ? 'Terminal' : 'Magazyn'}
                                </span>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Twoja stara pętla od Trucków */}
                {Array.from(trucks.values()).map((truck) => (
                    <Marker
                        key={truck.id}
                        position={[truck.currentLat, truck.currentLng]}
                        icon={truck.status === 'BUSY' ? busyIcon : availableIcon}
                    >
                        <Popup closeButton={false} autoPan={false}>
                            <div className="text-slate-800 font-sans min-w-[150px]">
                                <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                    {truck.brand} {truck.model}
                                </strong>
                                <span className="text-sm leading-tight text-slate-600 block mb-2">
                                    Rej: <strong className="text-slate-800">{truck.plateNumber}</strong><br/>
                                    Kierowca: <strong className="text-slate-800">{truck.driverName}</strong>
                                </span>

                                {truck.status === 'BUSY' ? (
                                    <span className="bg-cyan-100 text-cyan-800 text-xs font-bold px-2 py-1 rounded-full uppercase">
                                        W trasie: {(truck.progress * 100).toFixed(1)}%
                                    </span>
                                ) : (
                                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full uppercase">
                                        Gotowy do drogi
                                    </span>
                                )}
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
                        {activeTrucks.length} w trasie
                    </span>
                </div>
                <div className="p-4 flex-1 min-h-[150px] max-h-[400px] overflow-y-auto">
                    {activeTrucks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2 mt-4">
                            <span>Brak aktywnych zleceń.</span>
                            <span className="text-xs">Wszystkie pojazdy czekają w bazach.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTrucks.map(truck => (
                                <div key={truck.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-white font-medium text-sm">{truck.plateNumber}</span>
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