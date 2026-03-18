import { useState } from 'react';
import { Activity, ChevronRight, Wrench, Clock } from 'lucide-react';
import { useSimulation, type VehicleData, type OrderData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';

const INDETERMINATE_STATUSES = new Set([
    'LOADING', 'HANDOVER', 'WAITING_FOR_CARGO_CLEARANCE', 'WAITING_FOR_TOW', 'BEING_TOWED'
]);

const PRIORITY: Record<string, number> = {
    'WAITING_FOR_CARGO_CLEARANCE': 1,
    'TOW_APPROACHING': 2,
    'TOWING': 3,
    'HANDOVER': 4,
    'RESCUE_APPROACHING': 5,
    'RESCUE_MISSION': 6,
    'BROKEN': 7,
    'IN_TRANSIT': 8,
    'LOADING': 9,
    'BUSY': 10,
    'APPROACHING': 11,
    'WAITING_FOR_TOW': 12,
    'BEING_TOWED': 13
};

function getEffectiveStatus(truck: VehicleData, trucks: Map<number, VehicleData>): string {
    if (truck.status === 'WAITING_FOR_TOW') {
        const isTowed = Array.from(trucks.values()).some(t => t.isServiceUnit && t.status === 'TOWING' && t.targetTowId === truck.id);
        if (isTowed) return 'BEING_TOWED';
    }
    return truck.status;
}

const isMsuActiveOperation = (status: string) =>
    status === 'TOW_APPROACHING' || status === 'TOWING' || status === 'WAITING_FOR_CARGO_CLEARANCE';

function resolveStatusLabel(truck: VehicleData, effStatus: string, orders: OrderData[]): string {
    if (effStatus === 'BROKEN') return 'AWARIA POJAZDU';
    if (effStatus === 'WAITING_FOR_TOW') return 'OCZEKUJE NA MSU';
    if (effStatus === 'BEING_TOWED') return 'W TRAKCIE HOLOWANIA';
    if (effStatus === 'TOW_APPROACHING') return 'MSU Dojazd do wraku';
    if (effStatus === 'TOWING') return 'MSU Holowanie';
    if (effStatus === 'WAITING_FOR_CARGO_CLEARANCE') return 'Przygotowanie do holowania';
    if (effStatus === 'RESCUE_MISSION' || truck.orderStatus === 'RESCUE_APPROACHING') return 'Misja Ratunkowa';
    if (effStatus === 'HANDOVER') return 'Przeładunek Techniczny';

    const order = orders.find(o => o.vehicle?.id === truck.id && ['APPROACHING', 'LOADING', 'IN_TRANSIT'].includes(o.status));

    if (truck.orderStatus === 'APPROACHING') return order ? `Dojazd: ${order.startLocation.name}` : 'Dojazd do załadunku';
    if (truck.orderStatus === 'LOADING') return 'Załadunek towaru';
    return order ? `W trasie: ${order.endLocation.name}` : 'W trasie do celu';
}

function resolveAccentColor(truck: VehicleData, effStatus: string): string {
    if (effStatus === 'BROKEN') return 'text-rose-400 animate-pulse';
    if (effStatus === 'WAITING_FOR_TOW') return 'text-slate-400 animate-pulse';
    if (effStatus === 'BEING_TOWED') return 'text-slate-500';
    if (effStatus === 'TOW_APPROACHING') return 'text-orange-400';
    if (effStatus === 'TOWING') return 'text-orange-500';
    if (effStatus === 'WAITING_FOR_CARGO_CLEARANCE') return 'text-sky-400 animate-pulse';
    if (effStatus === 'RESCUE_MISSION' || truck.orderStatus === 'RESCUE_APPROACHING') return 'text-indigo-400';
    if (effStatus === 'HANDOVER') return 'text-fuchsia-400';
    if (truck.orderStatus === 'APPROACHING') return 'text-amber-400';
    if (truck.orderStatus === 'LOADING') return 'text-blue-400';
    return 'text-cyan-400';
}

function resolveBarColor(truck: VehicleData, effStatus: string): string {
    if (effStatus === 'BROKEN') return 'bg-rose-500';
    if (effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED') return 'bg-slate-500';
    if (effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING') return 'bg-orange-500';
    if (effStatus === 'WAITING_FOR_CARGO_CLEARANCE') return 'bg-sky-400';
    if (effStatus === 'RESCUE_MISSION' || truck.orderStatus === 'RESCUE_APPROACHING') return 'bg-indigo-500';
    if (effStatus === 'HANDOVER') return 'bg-fuchsia-500';
    if (truck.orderStatus === 'APPROACHING') return 'bg-amber-400';
    if (truck.orderStatus === 'LOADING') return 'bg-blue-400';
    return 'bg-cyan-400';
}

function resolveBorderClass(_truck: VehicleData, effStatus: string, isSelected: boolean): string {
    if (isSelected) return 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]';
    if (effStatus === 'BROKEN') return 'border-rose-500/50 hover:border-rose-500';
    if (effStatus === 'WAITING_FOR_TOW' || effStatus === 'BEING_TOWED') return 'border-slate-500/50 hover:border-slate-400';
    if (effStatus === 'TOW_APPROACHING' || effStatus === 'TOWING') return 'border-orange-500/50 hover:border-orange-500';
    if (effStatus === 'WAITING_FOR_CARGO_CLEARANCE') return 'border-sky-500/50 hover:border-sky-500';
    if (effStatus === 'RESCUE_MISSION' || effStatus === 'HANDOVER') return 'border-indigo-500/50 hover:border-indigo-500';
    return 'border-slate-700/50 hover:border-slate-500';
}

export default function ActiveOrdersPanel() {
    const { trucks, orders } = useSimulation();
    const { selectedRouteVehicleId, setSelectedRouteVehicleId } = useMapContext();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const activeTrucks = Array.from(trucks.values())
        .filter(t => t.status !== 'AVAILABLE')
        .sort((a, b) => {
            const effStatusA = getEffectiveStatus(a, trucks);
            const effStatusB = getEffectiveStatus(b, trucks);
            const statusA = effStatusA === 'BUSY' && a.orderStatus ? a.orderStatus : effStatusA;
            const statusB = effStatusB === 'BUSY' && b.orderStatus ? b.orderStatus : effStatusB;
            const prioA = PRIORITY[statusA] || 99;
            const prioB = PRIORITY[statusB] || 99;
            if (prioA !== prioB) return prioA - prioB;
            return a.id - b.id;
        });

    const resolvePlateById = (id: number | null | undefined): string => {
        if (!id) return '—';
        const found = trucks.get(id);
        return found ? found.plateNumber : `ID:${id}`;
    };

    if (isCollapsed) {
        return (
            <div
                className="absolute top-6 right-6 z-[1000] bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-2 cursor-pointer flex items-center gap-3 hover:bg-slate-800 transition pointer-events-auto"
                onClick={() => setIsCollapsed(false)}
            >
                <div className="bg-cyan-500/20 text-cyan-400 p-2 rounded-full relative">
                    <Activity size={20} />
                    {activeTrucks.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                        </span>
                    )}
                </div>
                <span className="text-white font-bold pr-3 text-sm tracking-wide">{activeTrucks.length} w akcji</span>
            </div>
        );
    }

    return (
        <div className="absolute top-6 right-6 z-[1000] w-80 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto animate-[fadeIn_0.2s_ease-out]">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-cyan-400" />
                    <h2 className="text-white font-semibold">Zlecenia w toku</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full font-bold">{activeTrucks.length}</span>
                    <button onClick={() => setIsCollapsed(true)} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700 transition">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="p-4 flex-1 min-h-[150px] max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {activeTrucks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2 mt-4">
                        <span>Brak aktywnych operacji.</span>
                        <span className="text-xs">Wszystkie pojazdy czekają w bazach.</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeTrucks.map(truck => {
                            const effStatus = getEffectiveStatus(truck, trucks);
                            const isIndeterminate =
                                INDETERMINATE_STATUSES.has(effStatus) ||
                                INDETERMINATE_STATUSES.has(truck.orderStatus ?? '');

                            const accentColor = resolveAccentColor(truck, effStatus);
                            const barColor = resolveBarColor(truck, effStatus);
                            const showMsuInfo = truck.isServiceUnit && isMsuActiveOperation(effStatus);
                            const hasQueuedMission = truck.isServiceUnit && !!truck.nextTowTargetId;

                            const syncDelay = `-${Date.now() % 2000}ms`;

                            return (
                                <div
                                    key={truck.id}
                                    className={`bg-slate-800/80 rounded-xl p-3 border transition-colors cursor-pointer ${resolveBorderClass(truck, effStatus, truck.id === selectedRouteVehicleId)}`}
                                    onClick={() => setSelectedRouteVehicleId(truck.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-white font-bold text-sm flex items-center gap-2">
                                                {truck.plateNumber}
                                                {truck.isServiceUnit && (
                                                    <span className="text-[8px] bg-orange-500 text-white px-1 rounded uppercase">MSU</span>
                                                )}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold uppercase tracking-wider ${accentColor} line-clamp-1 break-all`}
                                                style={{ animationDelay: syncDelay }}
                                            >
                                                {resolveStatusLabel(truck, effStatus, orders)}
                                            </span>
                                        </div>

                                        <div className="ml-2 flex-shrink-0">
                                            {isIndeterminate ? (
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                                    <Clock size={10} /> WAIT
                                                </span>
                                            ) : (
                                                <span className={`text-xs font-bold ${accentColor.replace(' animate-pulse', '')}`}>
                                                    {(truck.progress * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {showMsuInfo && truck.targetTowId && (
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Wrench size={10} className="text-orange-400 flex-shrink-0" />
                                            <span className="text-[10px] text-slate-400">
                                                Cel:{' '}
                                                <span className="font-bold text-orange-300">
                                                    {resolvePlateById(truck.targetTowId)}
                                                </span>
                                            </span>
                                        </div>
                                    )}

                                    {hasQueuedMission && (
                                        <div className="flex items-center gap-1.5 mb-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1">
                                            <Clock size={10} className="text-orange-400 flex-shrink-0" />
                                            <span className="text-[10px] text-orange-300">
                                                Kolejna misja:{' '}
                                                <span className="font-bold">{resolvePlateById(truck.nextTowTargetId)}</span>
                                            </span>
                                        </div>
                                    )}

                                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden relative">
                                        {isIndeterminate ? (
                                            <div
                                                className={`absolute top-0 h-full rounded-full ${barColor} opacity-75`}
                                                style={{ width: '40%', animation: 'panel-indeterminate 1.4s ease-in-out infinite' }}
                                            />
                                        ) : (
                                            <div
                                                className={`h-full transition-all duration-1000 ${barColor}`}
                                                style={{ width: `${truck.progress * 100}%` }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes panel-indeterminate {
                    0%   { left: -40%; }
                    100% { left: 140%; }
                }
            `}</style>
        </div>
    );
}