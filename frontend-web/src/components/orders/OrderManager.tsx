import { useMemo } from 'react';
import { ClipboardList, Route, Truck, PackageCheck } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

export default function OrderManager() {
    const { orders, trucks } = useSimulation();

    const computedOrders = useMemo(() => {
        return orders.map(order => {
            let computedStatus = order.status;
            let computedProgress = order.progress;

            if (['APPROACHING', 'LOADING', 'IN_TRANSIT'].includes(order.status)) {
                const liveTruck = trucks.get(order.vehicle.id);
                if (liveTruck) {
                    if (liveTruck.status === 'AVAILABLE') {
                        computedStatus = 'COMPLETED';
                        computedProgress = 1.0;
                    } else if (liveTruck.status === 'BUSY') {
                        computedStatus = liveTruck.orderStatus || order.status;
                        computedProgress = liveTruck.progress !== undefined ? liveTruck.progress : order.progress;
                    }
                }
            }

            return { ...order, computedStatus, computedProgress };
        });
    },[orders, trucks]);

    const liveOrders = computedOrders
        .filter(o =>['APPROACHING', 'LOADING', 'IN_TRANSIT'].includes(o.computedStatus))
        .sort((a, b) => b.id - a.id);

    const historyOrders = computedOrders
        .filter(o => o.computedStatus === 'COMPLETED')
        .sort((a, b) => b.id - a.id);

    const getStatusBadge = (status: string, progress: number) => {
        if (status === 'APPROACHING') return <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold uppercase">Dojazd ({Math.round(progress * 100)}%)</span>;
        if (status === 'LOADING') return <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase animate-pulse">Załadunek...</span>;
        if (status === 'IN_TRANSIT') return <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold uppercase">W Trasie ({Math.round(progress * 100)}%)</span>;
        if (status === 'COMPLETED') return <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase">Ukończone</span>;
        return <span className="bg-slate-500/20 text-slate-400 px-3 py-1 rounded-full text-xs font-bold uppercase">{status}</span>;
    };

    return (
        <div className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ClipboardList className="text-emerald-400" size={32} />
                        Centrum Dowodzenia Zleceniami
                    </h1>
                    <p className="text-slate-400 mt-1">Nadzór nad trwającymi transportami oraz historia operacji synchronizowana na żywo.</p>
                </div>
            </div>

            <div className="mb-12">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Route className="text-cyan-400" size={24} /> Aktywne Transporty
                </h2>
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 border-b border-slate-700">ID</th>
                            <th className="p-4 border-b border-slate-700">Trasa</th>
                            <th className="p-4 border-b border-slate-700">Flota</th>
                            <th className="p-4 border-b border-slate-700">Status & Postęp</th>
                        </tr>
                        </thead>
                        <tbody>
                        {liveOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 transition-colors duration-500">
                                <td className="p-4 font-mono text-slate-400">#{order.id}</td>
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white">{order.startLocation.name}</span>
                                        <span className="text-xs text-slate-500">do {order.endLocation.name}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Truck size={16} className="text-slate-400" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{order.vehicle.plateNumber}</span>
                                            <span className="text-xs text-slate-500">{order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : 'Brak Kierowcy'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-2">
                                        <div>{getStatusBadge(order.computedStatus, order.computedProgress)}</div>
                                        <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                            <div className={`h-full transition-all duration-[2000ms] linear ${order.computedStatus === 'APPROACHING' ? 'bg-amber-400' : order.computedStatus === 'LOADING' ? 'bg-blue-400' : 'bg-cyan-400'}`} style={{ width: order.computedStatus === 'LOADING' ? '100%' : `${order.computedProgress * 100}%` }}></div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {liveOrders.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">Brak aktywnych transportów w tym momencie.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <PackageCheck className="text-emerald-400" size={24} /> Historia Operacji
                </h2>
                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 border-b border-slate-700">ID</th>
                            <th className="p-4 border-b border-slate-700">Trasa</th>
                            <th className="p-4 border-b border-slate-700">Flota</th>
                            <th className="p-4 border-b border-slate-700">Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {historyOrders.map(order => (
                            <tr key={order.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 opacity-80 hover:opacity-100 transition-opacity duration-500 animate-[fadeIn_0.5s_ease-out]">
                                <td className="p-4 font-mono text-slate-400">#{order.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white">{order.startLocation.name}</span>
                                        <span className="text-slate-500">➔</span>
                                        <span className="font-medium text-white">{order.endLocation.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-slate-300">
                                    {order.vehicle.plateNumber} ({order.driver ? `${order.driver.lastName}` : 'N/A'})
                                </td>
                                <td className="p-4">{getStatusBadge(order.computedStatus, 1)}</td>
                            </tr>
                        ))}
                        {historyOrders.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">Brak ukończonych zleceń w historii.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}