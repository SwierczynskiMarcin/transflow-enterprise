import React, { useState, useEffect } from 'react';
import { Map, ClipboardList, Truck, Users, MapPin, Settings, Clock, Play, Pause } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

interface MainLayoutProps {
    currentView: string;
    onNavigate: (view: string) => void;
    children: React.ReactNode;
}

export default function MainLayout({ currentView, onNavigate, children }: MainLayoutProps) {
    const { virtualTime, isPlaying, speed, togglePlay, changeSpeed } = useSimulation();
    const [localSpeed, setLocalSpeed] = useState(speed);

    useEffect(() => { setLocalSpeed(speed); }, [speed]);

    const handleSpeedCommit = () => { changeSpeed(localSpeed); };

    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return { date: "Ładowanie...", time: "--:--" };
        try {
            const[datePart, timePart] = isoString.split('T');
            const [year, month, day] = datePart.split('-');
            const [hour, minute] = timePart.split(':');
            return { date: `${day}.${month}.${year}`, time: `${hour}:${minute}` };
        } catch (e) {
            return { date: isoString, time: "" };
        }
    };

    const { date, time } = formatDateTime(virtualTime);

    const navItems =[
        { id: 'map', icon: Map, label: 'Mapa Live' },
        { id: 'orders', icon: ClipboardList, label: 'Zlecenia' },
        { id: 'vehicles', icon: Truck, label: 'Flota Pojazdów' },
        { id: 'drivers', icon: Users, label: 'Kierowcy' },
        { id: 'locations', icon: MapPin, label: 'Baza Adresowa' },
        { id: 'settings', icon: Settings, label: 'Ustawienia' },
    ];

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden font-sans">
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 shadow-2xl">

                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Truck className="text-cyan-400" size={24} />
                        <span className="text-white text-xl font-bold tracking-wider text-cyan-50">TransFlow<span className="text-cyan-400">TMS</span></span>
                    </div>
                </div>

                <div className="px-4 py-5 border-b border-slate-800/50">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-900/50 rounded-lg text-slate-400">
                                <Clock size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-100 font-bold tracking-wider text-sm">{time}</span>
                                <span className="text-xs text-slate-500 font-medium">{date}</span>
                            </div>
                        </div>
                        <div title={isPlaying ? "Symulacja w toku" : "Symulacja zatrzymana"} className="pr-1">
                            <span className={`flex w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                                isPlaying
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : 'bg-slate-600'
                            }`}></span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 py-4 flex flex-col gap-2 px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 px-2">Menu Główne</div>

                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-cyan-500/15 text-cyan-400 shadow-[inset_2px_0_0_0_rgba(34,211,238,1)]'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                                <Icon size={20} className={isActive ? 'text-cyan-400' : 'text-slate-500'} />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-col gap-4">
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 shadow-inner">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Silnik Symulacji</span>
                            <button
                                onClick={togglePlay}
                                className={`p-1.5 rounded-lg transition-colors ${isPlaying ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 uppercase font-medium">Mnożnik Czasu</span>
                                <span className="text-xs font-bold text-cyan-400">x{localSpeed}</span>
                            </div>
                            <input
                                type="range" min="1" max="600" step="1"
                                value={localSpeed}
                                onChange={(e) => setLocalSpeed(Number(e.target.value))}
                                onMouseUp={handleSpeedCommit}
                                onTouchEnd={handleSpeedCommit}
                                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold border border-cyan-500/30">
                            A
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-bold text-white">Administrator</span>
                            <span className="text-xs text-slate-500">System TMS</span>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 relative bg-slate-950 overflow-hidden">
                {children}
            </main>
        </div>
    );
}