import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck, Activity, Building2, MapPin, Flag, X, Route } from 'lucide-react';
import SimulationControls from './map/SimulationControls';
import MapResizer from './map/MapResizer';
import { useSimulation, type LocationData, type VehicleData } from '../context/SimulationContext';

// --- Funkcja pomocnicza: Obliczanie odległości w linii prostej (w km) ---
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Promień Ziemi w km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// --- Twój oryginalny kod od trucków ---
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
    const { trucks, locations, mapCenter, mapZoom } = useSimulation();
    const activeTrucks = Array.from(trucks.values()).filter(t => t.status === 'BUSY');
    const availableTrucks = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE');

    // --- STANY DLA KREATORA ZLECEŃ ---
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [startLoc, setStartLoc] = useState<LocationData | null>(null);
    const [endLoc, setEndLoc] = useState<LocationData | null>(null);
    const [suggestedTruck, setSuggestedTruck] = useState<{ vehicle: VehicleData, distance: number } | null>(null);
    const [selectedTruckId, setSelectedTruckId] = useState<number | ''>('');

    // --- LOGIKA: Szukanie najbliższego dostępnego auta po wybraniu Startu ---
    useEffect(() => {
        if (startLoc) {
            if (availableTrucks.length > 0) {
                let closest = availableTrucks[0];
                let minDistance = calculateDistance(startLoc.latitude, startLoc.longitude, closest.currentLat, closest.currentLng);

                for (let i = 1; i < availableTrucks.length; i++) {
                    const dist = calculateDistance(startLoc.latitude, startLoc.longitude, availableTrucks[i].currentLat, availableTrucks[i].currentLng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = availableTrucks[i];
                    }
                }
                setSuggestedTruck({ vehicle: closest, distance: minDistance });
                setSelectedTruckId(closest.id); // Od razu ustawiamy to auto jako wybrane
            } else {
                setSuggestedTruck(null);
                setSelectedTruckId('');
            }
        } else {
            setSuggestedTruck(null);
            setSelectedTruckId('');
        }
    }, [startLoc, trucks]);

    // Wyciągamy dane aktualnie wybranego auta (do wyświetlenia na pięknej karcie)
    const selectedTruckData = selectedTruckId
        ? availableTrucks.find(t => t.id === selectedTruckId)
        : null;

    const selectedDistance = selectedTruckData && startLoc
        ? calculateDistance(startLoc.latitude, startLoc.longitude, selectedTruckData.currentLat, selectedTruckData.currentLng)
        : 0;

    // Funkcje wywoływane z poziomu dymków na mapie
    const handleSetStart = (loc: LocationData) => {
        setStartLoc(loc);
        setIsBuilderOpen(true);
    };

    const handleSetEnd = (loc: LocationData) => {
        setEndLoc(loc);
        setIsBuilderOpen(true);
    };

    const handleCancelOrder = () => {
        setIsBuilderOpen(false);
        setStartLoc(null);
        setEndLoc(null);
        setSuggestedTruck(null);
        setSelectedTruckId('');
    };

    const handleConfirmOrder = async () => {
        if (!startLoc || !endLoc || !selectedTruckId) return;

        try {
            const response = await fetch('http://localhost:8080/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId: selectedTruckId,
                    startLocationId: startLoc.id,
                    endLocationId: endLoc.id
                })
            });

            if (response.ok) {
                handleCancelOrder();
            } else {
                console.error("Błąd zapisu zlecenia na serwerze");
            }
        } catch (error) {
            console.error("Błąd połączenia z API:", error);
        }
    };

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

                {/* Pętla renderująca Lokalizacje */}
                {locations.map(loc => (
                    <Marker
                        key={`loc-${loc.id}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={createLocationIcon(loc.type)}
                    >
                        <Popup closeButton={false} autoPan={false}>
                            <div className="text-slate-800 font-sans min-w-[200px]">
                                <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                    {loc.name}
                                </strong>
                                <span className="text-sm leading-tight text-slate-600 block mb-2">
                                    {loc.companyName || 'Brak firmy'}
                                </span>
                                <div className="mb-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                        loc.type === 'BASE' ? 'bg-blue-100 text-blue-800' :
                                            loc.type === 'PORT' ? 'bg-indigo-100 text-indigo-800' :
                                                'bg-rose-100 text-rose-800'
                                    }`}>
                                        {loc.type === 'BASE' ? 'Baza Floty' : loc.type === 'PORT' ? 'Terminal' : 'Magazyn'}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2 mt-2">
                                    <button
                                        onClick={() => handleSetStart(loc)}
                                        className="flex items-center justify-center gap-2 w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs py-2 rounded-lg font-bold transition-colors"
                                    >
                                        <MapPin size={14} /> Zlecenie STĄD
                                    </button>
                                    <button
                                        onClick={() => handleSetEnd(loc)}
                                        className="flex items-center justify-center gap-2 w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs py-2 rounded-lg font-bold transition-colors"
                                    >
                                        <Flag size={14} /> Zlecenie TUTAJ
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Pętla od Trucków */}
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

            {/* --- KREATOR ZLECEŃ (Lewa strona) --- */}
            {isBuilderOpen && (
                <div className="absolute top-6 left-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <Route size={18} className="text-emerald-400" />
                            Kreator Zlecenia
                        </h2>
                        <button onClick={handleCancelOrder} className="text-slate-400 hover:text-rose-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-4">
                        {/* Punkt Startowy */}
                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 relative shadow-inner">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt A (Załadunek)</span>
                            {startLoc ? (
                                <span className="text-emerald-400 font-medium text-sm flex items-center gap-2">
                                    <MapPin size={16} /> {startLoc.name}
                                </span>
                            ) : (
                                <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>
                            )}
                        </div>

                        {/* Punkt Docelowy */}
                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 relative shadow-inner">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt B (Rozładunek)</span>
                            {endLoc ? (
                                <span className="text-rose-400 font-medium text-sm flex items-center gap-2">
                                    <Flag size={16} /> {endLoc.name}
                                </span>
                            ) : (
                                <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>
                            )}
                        </div>

                        {/* --- PIĘKNY BLOK POJAZDU (Z MOŻLIWOŚCIĄ ZMIANY) --- */}
                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 mt-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Przypisany pojazd</span>
                            {!startLoc ? (
                                <span className="text-xs text-slate-500">Wybierz Punkt A, aby wyszukać auta.</span>
                            ) : selectedTruckData ? (
                                <div className="flex flex-col gap-2">

                                    {/* Karta wybranego pojazdu - Dokładnie ta, która Ci się podobała! */}
                                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-600 shadow-inner">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">{selectedTruckData.plateNumber}</span>
                                                {suggestedTruck?.vehicle.id === selectedTruckData.id && (
                                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded uppercase font-bold tracking-wider">
                                                        Optymalny
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-400">{selectedTruckData.brand}</span>
                                        </div>
                                        <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                                            {selectedDistance.toFixed(0)} km stąd
                                        </span>
                                    </div>

                                    {/* Dyskretny select do ew. ręcznej zmiany */}
                                    <select
                                        value={selectedTruckId}
                                        onChange={(e) => setSelectedTruckId(Number(e.target.value))}
                                        className="w-full text-xs p-1.5 border border-slate-700 rounded bg-slate-800 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        <option value="" disabled>Zmień pojazd...</option>
                                        {availableTrucks.map(t => {
                                            const dist = calculateDistance(startLoc.latitude, startLoc.longitude, t.currentLat, t.currentLng);
                                            return (
                                                <option key={t.id} value={t.id}>
                                                    {t.plateNumber} ({dist.toFixed(0)} km stąd)
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            ) : (
                                <span className="text-xs text-rose-500 font-medium">Brak wolnych pojazdów w systemie.</span>
                            )}
                        </div>

                        {/* Przycisk akcji */}
                        <button
                            onClick={handleConfirmOrder}
                            disabled={!startLoc || !endLoc || !selectedTruckId}
                            className={`w-full py-3 rounded-lg font-bold mt-2 transition-all ${
                                startLoc && endLoc && selectedTruckId
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {startLoc && endLoc && selectedTruckId ? 'Potwierdź Zlecenie' : 'Uzupełnij dane zlecenia'}
                        </button>
                    </div>
                </div>
            )}

            {/* Twój nienaruszony Prawy Panel */}
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