import { useState, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

export default function SimulationControls() {
    const { isPlaying, speed, togglePlay, changeSpeed } = useSimulation();
    const[localSpeed, setLocalSpeed] = useState(speed);

    useEffect(() => { setLocalSpeed(speed); },[speed]);

    const handleSpeedCommit = () => { changeSpeed(localSpeed); };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700 shadow-2xl px-8 py-4 flex items-center gap-8">
            <button
                onClick={togglePlay}
                disabled={isPlaying === null}
                className="flex items-center justify-center w-14 h-14 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-full transition-colors shadow-[0_0_15px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isPlaying === null ? <Loader2 size={28} className="animate-spin text-slate-900" /> : (isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />)}
            </button>

            <div className="flex flex-col gap-2 min-w-[300px]">
                <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    <span>Mnożnik Czasu</span>
                    <span className="text-cyan-400 font-bold">x{localSpeed}</span>
                </div>
                <input
                    type="range" min="1" max="600" step="1"
                    value={localSpeed}
                    onChange={(e) => setLocalSpeed(Number(e.target.value))}
                    onMouseUp={handleSpeedCommit}
                    onTouchEnd={handleSpeedCommit}
                    className="w-full accent-cyan-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>
    );
}