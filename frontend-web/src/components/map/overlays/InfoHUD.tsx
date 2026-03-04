import { MapPin, Flag, Truck, Building2, User } from 'lucide-react';
import { useMapContext } from '../MapContext';
import { useSimulation, type LocationData, type VehicleData } from '../../../context/SimulationContext';
import { calculateDistance } from '../../../utils/mapUtils';

export default function InfoHUD() {
    const {
        hoveredVehicleId, selectedRouteVehicleId,
        hoveredLocationId, selectedLocationId,
        setIsBuilderOpen, setStartLoc, setEndLoc, setSelectedTruckId
    } = useMapContext();
    const { trucks, locations } = useSimulation();

    let targetType: 'none' | 'vehicle' | 'location' = 'none';
    let vehicleData: VehicleData | null = null;
    let locationData: LocationData | null = null;

    if (hoveredVehicleId) { targetType = 'vehicle'; vehicleData = trucks.get(hoveredVehicleId) || null; }
    else if (hoveredLocationId) { targetType = 'location'; locationData = locations.find(l => l.id === hoveredLocationId) || null; }
    else if (selectedRouteVehicleId) { targetType = 'vehicle'; vehicleData = trucks.get(selectedRouteVehicleId) || null; }
    else if (selectedLocationId) { targetType = 'location'; locationData = locations.find(l => l.id === selectedLocationId) || null; }

    if (targetType === 'none') return null;

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

    return (
        <div className="absolute bottom-8 right-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pointer-events-auto animate-[fadeIn_0.2s_ease-out]">

            {targetType === 'vehicle' && vehicleData && (
                <>
                    <div className={`p-4 border-b ${vehicleData.status === 'BUSY' ? 'border-cyan-500/30 bg-cyan-950/20' : 'border-emerald-500/30 bg-emerald-950/20'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${vehicleData.status === 'BUSY' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                <Truck size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-base leading-tight">{vehicleData.plateNumber}</span>
                                <span className="text-xs text-slate-400">{vehicleData.brand} {vehicleData.model}</span>
                            </div>
                        </div>
                        <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${vehicleData.status === 'BUSY' ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${vehicleData.status === 'BUSY' ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
                        </span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <User size={16} className="text-slate-500" />
                            <span>{vehicleData.driverName || 'Brak przypisania'}</span>
                        </div>

                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                            {vehicleData.status === 'BUSY' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                                        <span className={vehicleData.orderStatus === 'APPROACHING' ? 'text-amber-400' : vehicleData.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}>
                                            {vehicleData.orderStatus === 'APPROACHING' ? 'Dojazd' : vehicleData.orderStatus === 'LOADING' ? 'Załadunek' : 'W Trasie'}
                                        </span>
                                        <span className="text-white">{vehicleData.orderStatus !== 'LOADING' ? `${(vehicleData.progress * 100).toFixed(1)}%` : 'WAIT'}</span>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${vehicleData.orderStatus === 'APPROACHING' ? 'bg-amber-400' : vehicleData.orderStatus === 'LOADING' ? 'bg-blue-400' : 'bg-cyan-400'}`} style={{ width: vehicleData.orderStatus === 'LOADING' ? '100%' : `${vehicleData.progress * 100}%` }}></div>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-emerald-400 text-sm font-bold block text-center uppercase tracking-wider">Oczekuje na zlecenie</span>
                            )}
                        </div>
                    </div>
                </>
            )}

            {targetType === 'location' && locationData && (
                <>
                    <div className={`p-4 border-b ${locationData.type === 'BASE' ? 'border-blue-500/30 bg-blue-950/20' : locationData.type === 'PORT' ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-rose-500/30 bg-rose-950/20'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${locationData.type === 'BASE' ? 'bg-blue-500/20 text-blue-400' : locationData.type === 'PORT' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                <Building2 size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-base leading-tight truncate max-w-[200px]">{locationData.name}</span>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{locationData.companyName || 'Terminal Niezależny'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase mb-4 inline-block ${locationData.type === 'BASE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : locationData.type === 'PORT' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {locationData.type === 'BASE' ? 'Baza Floty' : locationData.type === 'PORT' ? 'Terminal' : 'Magazyn'}
                        </span>

                        {selectedLocationId === locationData.id && (
                            <div className="flex gap-2 mt-2 animate-[fadeIn_0.3s_ease-out]">
                                <button onClick={() => handleSetStart(locationData!)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs py-2.5 rounded-xl font-bold transition-colors">
                                    <MapPin size={14} /> STĄD
                                </button>
                                <button onClick={() => { setEndLoc(locationData!); setIsBuilderOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs py-2.5 rounded-xl font-bold transition-colors">
                                    <Flag size={14} /> TUTAJ
                                </button>
                            </div>
                        )}
                        {hoveredLocationId && !selectedLocationId && (
                            <div className="text-[10px] text-slate-500 italic text-center mt-2 animate-pulse">
                                Kliknij hub, aby utworzyć zlecenie.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}