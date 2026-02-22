import React from 'react';
import { Map, Truck, User, Settings, FileText } from 'lucide-react';
import SidebarItem from './ui/SidebarItem';
import TopBar from './ui/TopBar';

interface MainLayoutProps {
    children: React.ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
}

export default function MainLayout({ children, currentView, onNavigate }: MainLayoutProps) {
    return (
        <div className="flex h-screen w-screen bg-slate-900 text-white overflow-hidden">
            <aside className="w-20 bg-slate-800 py-6 flex flex-col items-center gap-8 shadow-2xl z-[100] border-r border-slate-700">
                <div className="text-2xl font-bold text-cyan-400 tracking-wider">TF</div>
                <nav className="flex flex-col gap-6 mt-4 w-full px-3">
                    <SidebarItem icon={<Map size={26} />} isActive={currentView === 'map'} onClick={() => onNavigate('map')} />
                    <SidebarItem icon={<FileText size={26} />} isActive={currentView === 'orders'} onClick={() => onNavigate('orders')} />
                    <SidebarItem icon={<Truck size={26} />} isActive={currentView === 'vehicles'} onClick={() => onNavigate('vehicles')} />
                    <SidebarItem icon={<User size={26} />} isActive={currentView === 'drivers'} onClick={() => onNavigate('drivers')} />
                </nav>
                <div className="mt-auto w-full px-3">
                    <SidebarItem icon={<Settings size={26} />} isActive={currentView === 'settings'} onClick={() => onNavigate('settings')} />
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full w-full relative">
                <TopBar />
                <div className="flex-1 relative overflow-hidden bg-slate-900">
                    {children}
                </div>
            </main>
        </div>
    );
}