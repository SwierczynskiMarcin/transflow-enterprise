import { useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import { useSimulation } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';

export default function ActiveOrdersPanel() {
    const { trucks } = useSimulation();
    const { selectedRouteVehicleId, setSelectedRouteVehicleId } = useMapContext();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const activeTrucks = Array.from(trucks.values()).filter(t => t.status === 'BUSY');

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
                <span className="text-white font-bold pr-3 text-sm tracking-wide">{activeTrucks.length} w trasie</span>
            </div>
        );
    }

    return (
        <div className="absolute top-6 right-6 z-[1000] w-80 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all duration-300">
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
                        <span>Brak aktywnych zleceń.</span><span className="text-xs">Wszystkie pojazdy czekają w bazach.</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeTrucks.map(truck => (
                            <div
                                key={truck.id}
                                className={`bg-slate-800/80 rounded-xl p-3 border transition-colors cursor-pointer ${truck.id === selectedRouteVehicleId ? 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-slate-700/50 hover:border-slate-500'}`}
                                onClick={() => setSelectedRouteVehicleId(truck.id)}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-sm">{truck.plateNumber}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${truck.orderStatus === 'APPROACHING' ? 'text-amber-400' : truck.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}`}>
                                            {truck.orderStatus === 'APPROACHING' ? 'Dojazd do punktu A' : truck.orderStatus === 'LOADING' ? 'Załadunek towaru' : 'W trasie do B'}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-bold ${truck.orderStatus === 'APPROACHING' ? 'text-amber-400' : truck.orderStatus === 'LOADING' ? 'text-blue-400' : 'text-cyan-400'}`}>
                                        {truck.orderStatus === 'LOADING' ? 'WAIT' : `${(truck.progress * 100).toFixed(0)}%`}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${truck.orderStatus === 'APPROACHING' ? 'bg-amber-400' : truck.orderStatus === 'LOADING' ? 'bg-blue-400' : 'bg-cyan-400'}`} style={{ width: truck.orderStatus === 'LOADING' ? '100%' : `${truck.progress * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}