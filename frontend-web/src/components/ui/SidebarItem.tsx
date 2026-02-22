import React from 'react';

interface SidebarItemProps {
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

export default function SidebarItem({ icon, isActive, onClick }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`p-3 rounded-xl flex justify-center transition ${
                isActive
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
        >
            {icon}
        </button>
    );
}