import { Clock } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

export default function TopBar() {
    const { virtualTime } = useSimulation();

    const formattedTime = virtualTime ? new Date(virtualTime).toLocaleString('pl-PL', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).toUpperCase() : "ŁĄCZENIE...";

    return (
        <div className="h-16 w-full bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 z-50">
            <h1 className="text-xl font-bold text-slate-200">System Operacyjny</h1>

            <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 shadow-inner">
                <Clock className="text-cyan-400 animate-pulse" size={20} />
                <span className="text-sm text-cyan-50 font-medium tracking-widest">{formattedTime}</span>
            </div>
        </div>
    );
}