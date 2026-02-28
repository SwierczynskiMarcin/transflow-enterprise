import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck, Activity, Building2, MapPin, Flag, X, Route, Loader2 } from 'lucide-react';
import SimulationControls from './map/SimulationControls';
import MapResizer from './map/MapResizer';
import { useSimulation, type LocationData, type VehicleData } from '../context/SimulationContext';

const decodePolyline = (str: string, precision = 5): [number, number][] => {
    if (!str) return[];
    let index = 0, lat = 0, lng = 0, coordinates: [number, number][] =[], shift = 0, result = 0, byte = null;
    const factor = Math.pow(10, precision);
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        let latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        let longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const createTruckIcon = (colorClass: string, glowColor: string) => {
    const htmlString = renderToString(
        <div className={`
            bg-slate-900 p-2 rounded-full border-2 ${colorClass} 
            transition-all duration-300 ease-out cursor-pointer
            shadow-[0_0_15px_${glowColor}] hover:scale-125 hover:shadow-[0_0_25px_${glowColor}]
            flex items-center justify-center group
        `}>
            <Truck size={20} className={colorClass.replace('border-', 'text-')} />
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor: [20, 20], popupAnchor:[0, -20] });
};

const busyIcon = createTruckIcon('border-cyan-400', 'rgba(34,211,238,0.5)');
const availableIcon = createTruckIcon('border-emerald-400', 'rgba(52,211,153,0.5)');
const approachingIcon = createTruckIcon('border-amber-400', 'rgba(251,191,36,0.5)');

const createLocationIcon = (type: string, truckCount: number, hasBusyTrucks: boolean) => {
    let colorClass = 'border-rose-400';
    let textColorClass = 'text-rose-400';
    let glowColor = 'rgba(244,63,94,0.3)';

    if (type === 'BASE') { colorClass = 'border-blue-400'; textColorClass = 'text-blue-400'; glowColor = 'rgba(96,165,250,0.3)'; }
    else if (type === 'PORT') { colorClass = 'border-indigo-400'; textColorClass = 'text-indigo-400'; glowColor = 'rgba(129,140,248,0.3)'; }

    const badgeBorder = truckCount > 0 ? (hasBusyTrucks ? 'border-cyan-400 text-cyan-400' : 'border-emerald-400 text-emerald-400') : 'border-slate-700 text-white';

    const htmlString = renderToString(
        <div className="relative cursor-pointer group">
            <div className={`bg-slate-800 p-2 rounded-xl border-2 ${colorClass} shadow-[0_0_15px_${glowColor}] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_${glowColor}]`}>
                <Building2 size={20} className={textColorClass} />
            </div>
            {truckCount > 0 && (
                <div className={`absolute -top-2 -right-2 bg-slate-900 border-2 ${badgeBorder} text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] z-50 transition-transform duration-300 group-hover:scale-110`}>
                    {truckCount}
                </div>
            )}
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
};

export default function TruckMap() {
    const { trucks, locations, activeRoutes, mapCenter, mapZoom, refreshRoutes } = useSimulation();
    const activeTrucks = Array.from(trucks.values()).filter(t => t.status === 'BUSY');
    const availableTrucks = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE');

    const[isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [startLoc, setStartLoc] = useState<LocationData | null>(null);
    const [endLoc, setEndLoc] = useState<LocationData | null>(null);
    const[selectedTruckId, setSelectedTruckId] = useState<number | ''>('');

    const[previewDist1, setPreviewDist1] = useState(0);
    const [previewDist2, setPreviewDist2] = useState(0);
    const [previewPoly1Str, setPreviewPoly1Str] = useState("");
    const [previewPoly2Str, setPreviewPoly2Str] = useState("");
    const[previewRoute1, setPreviewRoute1] = useState<[number, number][]>([]);
    const[previewRoute2, setPreviewRoute2] = useState<[number, number][]>([]);

    const decodedActiveRoutes = useMemo(() => {
        const map = new Map<number, { poly1: [number, number][], poly2: [number, number][] }>();
        activeRoutes.forEach((route, vehicleId) => {
            map.set(vehicleId, {
                poly1: route.routePolylineApproaching ? decodePolyline(route.routePolylineApproaching) :[],
                poly2: route.routePolylineTransit ? decodePolyline(route.routePolylineTransit) :[]
            });
        });
        return map;
    }, [activeRoutes]);

    const { parkedTrucks, trucksOnRoad } = useMemo(() => {
        const parked = new Map<number, VehicleData[]>();
        locations.forEach(l => parked.set(l.id, []));
        const onRoad: VehicleData[] =[];

        Array.from(trucks.values()).forEach(truck => {
            let isParked = false;
            for (const loc of locations) {
                if (calculateDistance(truck.currentLat, truck.currentLng, loc.latitude, loc.longitude) <= 0.5) {
                    parked.get(loc.id)!.push(truck);
                    isParked = true;
                    break;
                }
            }
            if (!isParked) { onRoad.push(truck); }
        });
        return { parkedTrucks: parked, trucksOnRoad: onRoad };
    }, [trucks, locations]);

    const selectedTruckData = selectedTruckId ? availableTrucks.find(t => t.id === selectedTruckId) : null;
    const selectedDistance = selectedTruckData && startLoc ? calculateDistance(startLoc.latitude, startLoc.longitude, selectedTruckData.currentLat, selectedTruckData.currentLng) : 0;

    const startLocId = startLoc?.id;
    const endLocId = endLoc?.id;
    const selectedTruckIdStr = selectedTruckId.toString();

    useEffect(() => {
        if (startLocId && endLocId && selectedTruckIdStr) {
            const truck = Array.from(trucks.values()).find(t => t.id.toString() === selectedTruckIdStr);
            if (!truck) return;

            const fetchPreviews = async () => {
                try {
                    const r1 = await fetch(`http://router.project-osrm.org/route/v1/driving/${truck.currentLng},${truck.currentLat};${startLoc!.longitude},${startLoc!.latitude}?overview=full&geometries=polyline`);
                    const d1 = await r1.json();
                    if(d1.routes?.[0]) {
                        setPreviewPoly1Str(d1.routes[0].geometry);
                        setPreviewDist1(d1.routes[0].distance);
                        setPreviewRoute1(decodePolyline(d1.routes[0].geometry));
                    }

                    const r2 = await fetch(`http://router.project-osrm.org/route/v1/driving/${startLoc!.longitude},${startLoc!.latitude};${endLoc!.longitude},${endLoc!.latitude}?overview=full&geometries=polyline`);
                    const d2 = await r2.json();
                    if(d2.routes?.[0]) {
                        setPreviewPoly2Str(d2.routes[0].geometry);
                        setPreviewDist2(d2.routes[0].distance);
                        setPreviewRoute2(decodePolyline(d2.routes[0].geometry));
                    }
                } catch(e) {}
            };
            fetchPreviews();
        } else {
            setPreviewRoute1([]);
            setPreviewRoute2([]);
            setPreviewPoly1Str("");
            setPreviewPoly2Str("");
            setPreviewDist1(0);
            setPreviewDist2(0);
        }
    },[startLocId, endLocId, selectedTruckIdStr]);

    const handleSetStart = (loc: LocationData) => {
        setStartLoc(loc);
        setIsBuilderOpen(true);

        const avail = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE');
        if (avail.length > 0) {
            let closest = avail[0];
            let min = calculateDistance(loc.latitude, loc.longitude, closest.currentLat, closest.currentLng);
            for (let i = 1; i < avail.length; i++) {
                let d = calculateDistance(loc.latitude, loc.longitude, avail[i].currentLat, avail[i].currentLng);
                if (d < min) { min = d; closest = avail[i]; }
            }
            setSelectedTruckId(closest.id);
        } else {
            setSelectedTruckId('');
        }
    };

    const handleSetEnd = (loc: LocationData) => {
        setEndLoc(loc);
        setIsBuilderOpen(true);
    };

    const handleCancelOrder = () => {
        setIsBuilderOpen(false);
        setStartLoc(null);
        setEndLoc(null);
        setSelectedTruckId('');
        setPreviewRoute1([]);
        setPreviewRoute2([]);
    };

    const handleConfirmOrder = async () => {
        if (!startLoc || !endLoc || !selectedTruckId) return;
        setIsSubmitting(true);

        try {
            const response = await fetch('http://localhost:8080/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId: selectedTruckId,
                    startLocationId: startLoc.id,
                    endLocationId: endLoc.id,
                    routePolylineApproaching: previewPoly1Str,
                    routeDistanceApproaching: previewDist1,
                    routePolylineTransit: previewPoly2Str,
                    routeDistanceTransit: previewDist2
                })
            });

            if (response.ok) {
                await refreshRoutes();
                handleCancelOrder();
            }
        } catch (error) {
        } finally {
            setIsSubmitting(false);
        }
    };

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
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />

                {activeTrucks.map(truck => {
                    const isApproaching = truck.orderStatus === 'APPROACHING';
                    const decoded = decodedActiveRoutes.get(truck.id);
                    const poly1 = decoded?.poly1 ||[];
                    const poly2 = decoded?.poly2 ||[];

                    return (
                        <div key={`route-${truck.id}`}>
                            {isApproaching && poly1.length > 0 && (
                                <Polyline positions={poly1} color="#fbbf24" weight={4} opacity={0.6} />
                            )}
                            {poly2.length > 0 && (
                                <Polyline positions={poly2} color="#22d3ee" weight={5} opacity={isApproaching ? 0.3 : 0.8} />
                            )}
                        </div>
                    );
                })}

                {previewRoute1.length > 0 && (
                    <Polyline positions={previewRoute1} color="#fbbf24" weight={4} dashArray="8, 8" opacity={0.8} />
                )}
                {previewRoute2.length > 0 && (
                    <Polyline positions={previewRoute2} color="#22d3ee" weight={4} dashArray="8, 8" opacity={0.8} />
                )}

                {locations.map(loc => {
                    const parkedInHub = parkedTrucks.get(loc.id) ||[];
                    const hasBusy = parkedInHub.some(t => t.status === 'BUSY');

                    return (
                        <Marker
                            key={`loc-${loc.id}`}
                            position={[loc.latitude, loc.longitude]}
                            icon={createLocationIcon(loc.type, parkedInHub.length, hasBusy)}
                            zIndexOffset={1000}
                        >
                            <Popup closeButton={false} autoPan={false}>
                                <div className="text-slate-800 font-sans min-w-[260px] max-w-[300px]">
                                    <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                        {loc.name}
                                    </strong>
                                    <span className="text-xs leading-tight text-slate-500 block mb-2 font-medium uppercase tracking-wider">
                                        {loc.companyName || 'Terminal Niezależny'}
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

                                    <div className="flex gap-2 mt-2 mb-3">
                                        <button onClick={() => handleSetStart(loc)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs py-2 rounded-lg font-bold transition-colors">
                                            <MapPin size={14} /> STĄD
                                        </button>
                                        <button onClick={() => handleSetEnd(loc)} className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs py-2 rounded-lg font-bold transition-colors">
                                            <Flag size={14} /> TUTAJ
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex justify-between items-center border-b border-slate-200 pb-1.5">
                                            <span>Pojazdy w Hubie</span>
                                            <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700">{parkedInHub.length}</span>
                                        </div>

                                        {parkedInHub.length === 0 ? (
                                            <div className="text-[11px] text-slate-400 italic text-center py-3">Brak pojazdów stacjonujących.</div>
                                        ) : (
                                            <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                                                {parkedInHub.map(t => (
                                                    <div key={t.id} className="flex items-center justify-between bg-white border border-slate-200 p-1.5 rounded shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Truck size={14} className={
                                                                t.status === 'AVAILABLE' ? 'text-emerald-500' :
                                                                    t.orderStatus === 'APPROACHING' ? 'text-amber-500' :
                                                                        'text-cyan-500'
                                                            } />
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700 leading-none">{t.plateNumber}</span>
                                                                <span className="text-[9px] text-slate-500 leading-none mt-1">{t.brand}</span>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                            t.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                                t.orderStatus === 'APPROACHING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                    'bg-cyan-50 text-cyan-600 border border-cyan-100'
                                                        }`}>
                                                            {t.orderStatus === 'APPROACHING' ? 'Dojazd' :
                                                                t.orderStatus === 'LOADING' ? 'Załadunek' :
                                                                    t.status === 'BUSY' ? 'W Trasie' : 'Gotowy'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {trucksOnRoad.map((truck) => {
                    let currentIcon = availableIcon;
                    if (truck.status === 'BUSY') {
                        currentIcon = truck.orderStatus === 'APPROACHING' ? approachingIcon : busyIcon;
                    }

                    return (
                        <Marker key={`truck-${truck.id}`} position={[truck.currentLat, truck.currentLng]} icon={currentIcon}>
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
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                                            truck.orderStatus === 'APPROACHING' ? 'bg-amber-100 text-amber-800' :
                                                truck.orderStatus === 'LOADING' ? 'bg-blue-100 text-blue-800' : 'bg-cyan-100 text-cyan-800'
                                        }`}>
                                            {truck.orderStatus === 'APPROACHING' ? 'Dojazd: ' :
                                                truck.orderStatus === 'LOADING' ? 'Załadunek...' : 'W trasie: '}
                                            {truck.orderStatus !== 'LOADING' && `${(truck.progress * 100).toFixed(1)}%`}
                                        </span>
                                    ) : (
                                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full uppercase">Oczekuje w trasie</span>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {isBuilderOpen && (
                <div className="absolute top-6 left-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                        <h2 className="text-white font-semibold flex items-center gap-2"><Route size={18} className="text-emerald-400" /> Kreator Zlecenia</h2>
                        <button onClick={handleCancelOrder} className="text-slate-400 hover:text-rose-400 transition-colors"><X size={20} /></button>
                    </div>

                    <div className="p-4 flex flex-col gap-4">
                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 relative shadow-inner">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt A (Załadunek)</span>
                            {startLoc ? <span className="text-emerald-400 font-medium text-sm flex items-center gap-2"><MapPin size={16} /> {startLoc.name}</span> : <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>}
                        </div>

                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 relative shadow-inner">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt B (Rozładunek)</span>
                            {endLoc ? <span className="text-rose-400 font-medium text-sm flex items-center gap-2"><Flag size={16} /> {endLoc.name}</span> : <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>}
                        </div>

                        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 mt-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Przypisany pojazd</span>
                            {!startLoc ? (
                                <span className="text-xs text-slate-500">Wybierz Punkt A, aby wyszukać auta.</span>
                            ) : selectedTruckData ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-600 shadow-inner">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">{selectedTruckData.plateNumber}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">{selectedTruckData.brand}</span>
                                        </div>
                                        <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">{selectedDistance.toFixed(0)} km stąd</span>
                                    </div>
                                    <select value={selectedTruckId} onChange={(e) => setSelectedTruckId(Number(e.target.value))} className="w-full text-xs p-1.5 border border-slate-700 rounded bg-slate-800 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer">
                                        <option value="" disabled>Zmień pojazd...</option>
                                        {availableTrucks.map(t => {
                                            const dist = calculateDistance(startLoc.latitude, startLoc.longitude, t.currentLat, t.currentLng);
                                            return <option key={t.id} value={t.id}>{t.plateNumber} ({dist.toFixed(0)} km stąd)</option>;
                                        })}
                                    </select>
                                </div>
                            ) : (
                                <span className="text-xs text-rose-500 font-medium">Brak wolnych pojazdów w systemie.</span>
                            )}
                        </div>

                        <button
                            onClick={handleConfirmOrder}
                            disabled={!startLoc || !endLoc || !selectedTruckId || isSubmitting}
                            className={`w-full py-3 rounded-lg font-bold mt-2 transition-all flex items-center justify-center gap-2 ${
                                startLoc && endLoc && selectedTruckId && !isSubmitting
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Wysyłanie...</> : (startLoc && endLoc && selectedTruckId ? 'Potwierdź Zlecenie' : 'Uzupełnij dane zlecenia')}
                        </button>
                    </div>
                </div>
            )}

            <div className="absolute top-6 right-6 z-[1000] w-80 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-white font-semibold flex items-center gap-2"><Activity size={18} className="text-cyan-400" /> Zlecenia w toku</h2>
                    <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded-full font-medium">{activeTrucks.length} w trasie</span>
                </div>
                <div className="p-4 flex-1 min-h-[150px] max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {activeTrucks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2 mt-4">
                            <span>Brak aktywnych zleceń.</span><span className="text-xs">Wszystkie pojazdy czekają w bazach.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTrucks.map(truck => (
                                <div key={truck.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium text-sm">{truck.plateNumber}</span>
                                            <span className={`text-[10px] font-bold uppercase ${truck.orderStatus === 'APPROACHING' ? 'text-amber-400' : truck.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}`}>
                                                {truck.orderStatus === 'APPROACHING' ? 'Dojazd do punktu A' : truck.orderStatus === 'LOADING' ? 'Załadunek towaru' : 'W trasie do punktu B'}
                                            </span>
                                        </div>
                                        <span className={`text-xs font-bold ${truck.orderStatus === 'APPROACHING' ? 'text-amber-400' : truck.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}`}>
                                            {truck.orderStatus === 'LOADING' ? 'WAIT' : `${(truck.progress * 100).toFixed(0)}%`}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${truck.orderStatus === 'APPROACHING' ? 'bg-amber-400' : truck.orderStatus === 'LOADING' ? 'bg-blue-400' : 'bg-cyan-400'}`} style={{ width: truck.orderStatus === 'LOADING' ? '100%' : `${truck.progress * 100}%` }}></div>
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