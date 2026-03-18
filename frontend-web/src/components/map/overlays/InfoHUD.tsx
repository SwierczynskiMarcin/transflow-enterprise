import { useState } from 'react';
import { MapPin, Flag, Truck, Building2, User, AlertTriangle, Loader2, Wrench } from 'lucide-react';
import { useMapContext } from '../MapContext';
import { useSimulation, type LocationData, type VehicleData } from '../../../context/SimulationContext';
import { calculateDistance } from '../../../utils/mapUtils';
import { triggerBreakdown } from '../../../api/fleetApi';
import { autoAssignRescue } from '../../../api/logisticsApi';
import { useToast } from '../../../context/ToastContext';

export default function InfoHUD() {
    const {
        hoveredVehicleId, selectedRouteVehicleId,
        hoveredLocationId, selectedLocationId,
        setIsBuilderOpen, setStartLoc, setEndLoc, setSelectedTruckId,
        isBuilderOpen, startLoc
    } = useMapContext();
    const { trucks, locations } = useSimulation();
    const { showToast } = useToast();

    const [isSimulatingBreakdown, setIsSimulatingBreakdown] = useState(false);

    let targetType: 'none' | 'vehicle' | 'location' = 'none';
    let vehicleData: VehicleData | null = null;
    let locationData: LocationData | null = null;

    if (hoveredVehicleId) { targetType = 'vehicle'; vehicleData = trucks.get(hoveredVehicleId) || null; }
    else if (hoveredLocationId) { targetType = 'location'; locationData = locations.find(l => l.id === hoveredLocationId) || null; }
    else if (selectedRouteVehicleId) { targetType = 'vehicle'; vehicleData = trucks.get(selectedRouteVehicleId) || null; }
    else if (selectedLocationId) { targetType = 'location'; locationData = locations.find(l => l.id === selectedLocationId) || null; }

    if (targetType === 'none') return null;

    let effStatus = vehicleData?.status;
    if (effStatus === 'WAITING_FOR_TOW' && vehicleData) {
        const isTowed = Array.from(trucks.values()).some(t => t.isServiceUnit && t.status === 'TOWING' && t.targetTowId === vehicleData.id);
        if (isTowed) effStatus = 'BEING_TOWED';
    }

    const isLocationSelectedAsStart = !!(startLoc && locationData && startLoc.id === locationData.id);
    const builderAwaitingEnd = isBuilderOpen && !!startLoc && !isLocationSelectedAsStart;
    const builderAwaitingStart = !isBuilderOpen || !startLoc;

    const handleSetStart = (loc: LocationData) => {
        setStartLoc(loc);
        setIsBuilderOpen(true);
        const avail = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE' && !t.isServiceUnit);
        if (avail.length > 0) {
            let closest = avail[0];
            let min = calculateDistance(loc.latitude, loc.longitude, closest.currentLat, closest.currentLng);
            for (let i = 1; i < avail.length; i++) {
                const d = calculateDistance(loc.latitude, loc.longitude, avail[i].currentLat, avail[i].currentLng);
                if (d < min) { min = d; closest = avail[i]; }
            }
            setSelectedTruckId(closest.id);
        } else {
            setSelectedTruckId('');
        }
    };

    const handleBreakdown = async () => {
        if (!vehicleData) return;
        const targetId = vehicleData.id;
        setIsSimulatingBreakdown(true);
        try {
            await triggerBreakdown(targetId);
            showToast('Awaria zgłoszona!', 'error');

            setTimeout(async () => {
                try {
                    await autoAssignRescue(targetId);
                    showToast('Sukces. Moduł ratunkowy przetworzył incydent.', 'success');
                } catch (error: any) {
                    showToast(error.message, 'error');
                } finally {
                    setIsSimulatingBreakdown(false);
                }
            }, 1500);

        } catch (error: any) {
            showToast(error.message, 'error');
            setIsSimulatingBreakdown(false);
        }
    };

    const isAlertBlocked = effStatus === 'BROKEN' || effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' || vehicleData?.isServiceUnit;
    const IconComponent = vehicleData?.isServiceUnit ? Wrench : Truck;

    return (
        <div className="absolute bottom-8 right-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pointer-events-auto animate-[fadeIn_0.2s_ease-out]">

            {targetType === 'vehicle' && vehicleData && (
                <>
                    <div className={`p-4 border-b ${effStatus === 'BROKEN' ? 'border-rose-500/30 bg-rose-950/20' : effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'border-slate-500/30 bg-slate-900/50' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'border-sky-500/30 bg-sky-950/20' : effStatus === 'HANDOVER' ? 'border-fuchsia-500/30 bg-fuchsia-950/20' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'border-indigo-500/30 bg-indigo-950/20' : effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING' ? 'border-orange-500/30 bg-orange-950/20' : effStatus === 'BUSY' ? 'border-cyan-500/30 bg-cyan-950/20' : vehicleData.isServiceUnit ? 'border-orange-500/30 bg-orange-950/10' : 'border-emerald-500/30 bg-emerald-950/20'} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${effStatus === 'BROKEN' ? 'bg-rose-500/20 text-rose-400' : effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'bg-slate-800 text-slate-400' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'bg-sky-500/20 text-sky-400' : effStatus === 'HANDOVER' ? 'bg-fuchsia-500/20 text-fuchsia-400' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'bg-indigo-500/20 text-indigo-400' : effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING' ? 'bg-orange-500/20 text-orange-400' : effStatus === 'BUSY' ? 'bg-cyan-500/20 text-cyan-400' : vehicleData.isServiceUnit ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                <IconComponent size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-white font-bold text-base leading-tight flex items-center gap-2">
                                    {vehicleData.plateNumber}
                                    {vehicleData.isServiceUnit && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded">MSU</span>}
                                </span>
                                <span className="text-xs text-slate-400">{vehicleData.brand} {vehicleData.model}</span>
                            </div>
                        </div>
                        <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${effStatus === 'BROKEN' ? 'bg-rose-400' : effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'bg-slate-500' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'bg-sky-400' : effStatus === 'HANDOVER' ? 'bg-fuchsia-400' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'bg-indigo-400' : effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING' ? 'bg-orange-400' : effStatus === 'BUSY' ? 'bg-cyan-400' : vehicleData.isServiceUnit ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${effStatus === 'BROKEN' ? 'bg-rose-500' : effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'bg-slate-500' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'bg-sky-500' : effStatus === 'HANDOVER' ? 'bg-fuchsia-500' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'bg-indigo-500' : effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING' ? 'bg-orange-500' : effStatus === 'BUSY' ? 'bg-cyan-500' : vehicleData.isServiceUnit ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                        </span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <User size={16} className="text-slate-500" />
                            <span>{effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'Kierowca zjechał' : vehicleData.driverName || 'Brak przypisania'}</span>
                        </div>

                        <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                            {(effStatus !== 'AVAILABLE') ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                                        <span className={effStatus === 'BROKEN' ? 'text-rose-400' : effStatus === 'WAITING_FOR_TOW' ? 'text-slate-400' : effStatus === 'BEING_TOWED' ? 'text-slate-500' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'text-sky-400' : effStatus === 'HANDOVER' ? 'text-fuchsia-400' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'text-indigo-400' : effStatus === 'TOW_APPROACHING' ? 'text-orange-400' : effStatus === 'TOWING' ? 'text-orange-500' : vehicleData.orderStatus === 'APPROACHING' ? 'text-amber-400' : vehicleData.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}>
                                            {effStatus === 'BROKEN' ? 'AWARIA KRYTYCZNA' : effStatus === 'WAITING_FOR_TOW' ? 'Oczekuje na holownik' : effStatus === 'BEING_TOWED' ? 'W trakcie holowania' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'Przygotowanie do holowania' : effStatus === 'HANDOVER' ? 'Postój Operacyjny' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'Misja Ratunkowa' : effStatus === 'TOW_APPROACHING' ? 'W drodze do wraku' : effStatus === 'TOWING' ? 'Holowanie wraku' : vehicleData.orderStatus === 'APPROACHING' ? 'Dojazd' : vehicleData.orderStatus === 'LOADING' ? 'Załadunek' : 'W Trasie'}
                                        </span>
                                        <span className="text-white">{vehicleData.orderStatus !== 'LOADING' && effStatus !== 'HANDOVER' && effStatus !== 'WAITING_FOR_CARGO_CLEARANCE' && effStatus !== 'WAITING_FOR_TOW' && effStatus !== 'BEING_TOWED' ? `${(vehicleData.progress * 100).toFixed(1)}%` : (effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED') ? 'WRAK' : 'WAIT'}</span>
                                    </div>
                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${effStatus === 'BROKEN' ? 'bg-rose-500' : effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? 'bg-slate-600' : effStatus === 'WAITING_FOR_CARGO_CLEARANCE' ? 'bg-sky-400' : effStatus === 'HANDOVER' ? 'bg-fuchsia-500' : effStatus === 'RESCUE_MISSION' || vehicleData.orderStatus === 'RESCUE_APPROACHING' ? 'bg-indigo-500' : effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING' ? 'bg-orange-500' : vehicleData.orderStatus === 'APPROACHING' ? 'bg-amber-400' : vehicleData.orderStatus === 'LOADING' ? 'bg-blue-400' : 'bg-cyan-400'}`} style={{ width: vehicleData.orderStatus === 'LOADING' || effStatus === 'HANDOVER' || effStatus === 'WAITING_FOR_CARGO_CLEARANCE' || effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED' ? '100%' : `${vehicleData.progress * 100}%` }}></div>
                                    </div>

                                    {vehicleData.nextTowTargetId && (
                                        <div className="mt-3 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded text-center uppercase tracking-wider">
                                            Kolejna misja: Wrak #{vehicleData.nextTowTargetId}
                                        </div>
                                    )}

                                    {!isAlertBlocked && (
                                        <button onClick={handleBreakdown} disabled={isSimulatingBreakdown} className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs py-2 rounded-xl font-bold transition-colors disabled:opacity-50">
                                            {isSimulatingBreakdown ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                                            {isSimulatingBreakdown ? 'PRZETWARZANIE...' : 'SYMULUJ AWARIĘ'}
                                        </button>
                                    )}

                                    {effStatus === 'WAITING_FOR_TOW' && (
                                        <div className="mt-2 text-[10px] text-center text-slate-500 uppercase font-bold tracking-wider">
                                            Gotowy do usunięcia przez MSU
                                        </div>
                                    )}

                                    {effStatus === 'BEING_TOWED' && (
                                        <div className="mt-2 text-[10px] text-center text-slate-500 uppercase font-bold tracking-wider">
                                            W trakcie holowania do bazy
                                        </div>
                                    )}

                                    {effStatus === 'BROKEN' && (
                                        <div className="mt-3 border-t border-slate-700/50 pt-3">
                                            {isSimulatingBreakdown ? (
                                                <div className="flex items-center justify-center gap-2 bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 text-xs py-2 rounded-xl font-bold shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                                                    <Loader2 size={14} className="animate-spin" /> ANALIZOWANIE FLOTY...
                                                </div>
                                            ) : (
                                                <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                                                    Wrak oczekuje na wsparcie
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <span className="text-emerald-400 text-sm font-bold block text-center uppercase tracking-wider">Oczekuje na zlecenie</span>
                                    {!isAlertBlocked && (
                                        <button onClick={handleBreakdown} disabled={isSimulatingBreakdown} className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs py-2 rounded-xl font-bold transition-colors disabled:opacity-50">
                                            {isSimulatingBreakdown ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                                            {isSimulatingBreakdown ? 'PRZETWARZANIE...' : 'SYMULUJ AWARIĘ'}
                                        </button>
                                    )}
                                </div>
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
                        {isLocationSelectedAsStart && (
                            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                Punkt A
                            </span>
                        )}
                    </div>
                    <div className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase mb-4 inline-block ${locationData.type === 'BASE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : locationData.type === 'PORT' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {locationData.type === 'BASE' ? 'Baza Floty' : locationData.type === 'PORT' ? 'Terminal' : 'Magazyn'}
                        </span>

                        {selectedLocationId === locationData.id && (
                            <div className="flex gap-2 mt-2 animate-[fadeIn_0.3s_ease-out]">
                                <button
                                    onClick={() => handleSetStart(locationData!)}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <MapPin size={14} /> STĄD
                                </button>
                                <button
                                    onClick={() => { setEndLoc(locationData!); setIsBuilderOpen(true); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 border text-xs py-2.5 rounded-xl font-bold transition-colors ${
                                        builderAwaitingEnd
                                            ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse'
                                            : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                                    }`}
                                >
                                    <Flag size={14} /> TUTAJ
                                </button>
                            </div>
                        )}

                        <div className="mt-2 min-h-[20px]">
                            {builderAwaitingEnd && hoveredLocationId && !selectedLocationId && (
                                <div className="flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]">
                                    <Flag size={10} className="text-rose-400" />
                                    <span className="text-[10px] text-rose-300 font-medium">
                                        Kliknij hub, aby ustawić jako Punkt B.
                                    </span>
                                </div>
                            )}
                            {builderAwaitingStart && hoveredLocationId && !selectedLocationId && !isBuilderOpen && (
                                <div className="text-[10px] text-slate-500 italic text-center animate-pulse">
                                    Kliknij hub, aby utworzyć zlecenie.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}