import React from 'react';
import { Map, ClipboardList, Truck, Users, MapPin, Settings, Clock } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

interface MainLayoutProps {
    currentView: string;
    onNavigate: (view: string) => void;
    children: React.ReactNode;
}

export default function MainLayout({ currentView, onNavigate, children }: MainLayoutProps) {
    const { virtualTime, isPlaying } = useSimulation();

    // Funkcja czyszcząca surowy czas z backendu (np. 2026-02-24T10:43:06 -> 24.02.2026 oraz 10:43)
    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return { date: "Ładowanie...", time: "--:--" };
        try {
            const [datePart, timePart] = isoString.split('T');
            const [year, month, day] = datePart.split('-');
            const [hour, minute] = timePart.split(':');
            return { date: `${day}.${month}.${year}`, time: `${hour}:${minute}` };
        } catch (e) {
            return { date: isoString, time: "" };
        }
    };

    const { date, time } = formatDateTime(virtualTime);

    const navItems = [
        { id: 'map', icon: Map, label: 'Mapa Live' },
        { id: 'orders', icon: ClipboardList, label: 'Zlecenia' },
        { id: 'vehicles', icon: Truck, label: 'Flota Pojazdów' },
        { id: 'drivers', icon: Users, label: 'Kierowcy' },
        { id: 'locations', icon: MapPin, label: 'Baza Adresowa' },
        { id: 'settings', icon: Settings, label: 'Ustawienia' },
    ];

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden font-sans">
            {/* Pasek boczny (Sidebar) */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 shadow-2xl">

                {/* 1. LOGO */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <Truck className="text-cyan-400" size={24} />
                        <span className="text-white text-xl font-bold tracking-wider text-cyan-50">TransFlow<span className="text-cyan-400">TMS</span></span>
                    </div>
                </div>

                {/* 2. ZEGAR SYSTEMOWY */}
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
                        {/* Dioda statusu */}
                        <div title={isPlaying ? "Symulacja w toku" : "Symulacja zatrzymana"} className="pr-1">
                            <span className={`flex w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                                isPlaying
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : 'bg-slate-600'
                            }`}></span>
                        </div>
                    </div>
                </div>

                {/* 3. NAWIGACJA */}
                <nav className="flex-1 py-4 flex flex-col gap-2 px-4 overflow-y-auto">
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

                {/* 4. PROFIL ADMINA */}
                <div className="p-4 border-t border-slate-800 bg-slate-900">
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

            {/* Główny obszar roboczy*/}
            <main className="flex-1 relative bg-slate-950 overflow-hidden">
                {children}
            </main>
        </div>
    );
}