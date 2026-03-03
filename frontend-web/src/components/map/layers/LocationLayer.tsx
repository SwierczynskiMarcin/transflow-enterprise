import { useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Building2, MapPin, Flag, Truck } from 'lucide-react';
import { useSimulation, type VehicleData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';

const createLocationIcon = (type: string, truckCount: number, hasBusyTrucks: boolean) => {
    let colorClass = 'border-rose-400';
    let textColorClass = 'text-rose-400';
    let glowColor = 'rgba(244,63,94,0.3)';

    if (type === 'BASE') { colorClass = 'border-blue-400'; textColorClass = 'text-blue-400'; glowColor = 'rgba(96,165,250,0.3)'; }
    else if (type === 'PORT') { colorClass = 'border-indigo-400'; textColorClass = 'text-indigo-400'; glowColor = 'rgba(129,140,248,0.3)'; }

    const badgeBorder = truckCount > 0 ? (hasBusyTrucks ? 'border-cyan-400 text-cyan-400' : 'border-emerald-400 text-emerald-400') : 'border-slate-700 text-white';

    const htmlString = renderToString(
        <div className="relative cursor-pointer group">
            <div className={`bg-slate-800 p-2 rounded-xl border-2 ${colorClass} shadow-[0_0_15px_${glowColor}] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_25px_${glowColor}]`}>
                <Building2 size={20} className={textColorClass} />
            </div>
            {truckCount > 0 && (
                <div className={`absolute -top-2 -right-2 bg-slate-900 border-2 ${badgeBorder} text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] z-50 transition-transform duration-300 group-hover:scale-110`}>
                    {truckCount}
                </div>
            )}
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor:[20, 20], popupAnchor:[0, -20] });
};

export default function LocationLayer() {
    const { locations, trucks } = useSimulation();
    const { setStartLoc, setEndLoc, setIsBuilderOpen, setSelectedTruckId } = useMapContext();

    const parkedTrucks = useMemo(() => {
        const parked = new Map<number, VehicleData[]>();
        locations.forEach(l => parked.set(l.id,[]));

        Array.from(trucks.values()).forEach(truck => {
            for (const loc of locations) {
                if (calculateDistance(truck.currentLat, truck.currentLng, loc.latitude, loc.longitude) <= 0.5) {
                    parked.get(loc.id)!.push(truck);
                    break;
                }
            }
        });
        return parked;
    },[trucks, locations]);

    const handleSetStart = (loc: any) => {
        setStartLoc(loc);
        setIsBuilderOpen(true);
        const avail = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE');
        if (avail.length > 0) {
            let closest = avail[0];
            let min = calculateDistance(loc.latitude, loc.longitude, closest.currentLat, closest.currentLng);
            for (let i = 1; i < avail.length; i++) {
                let d = calculateDistance(loc.latitude, loc.longitude, avail[i].currentLat, avail[i].currentLng);
                if (d < min) { min = d; closest = avail[i]; }
            }
            setSelectedTruckId(closest.id);
        } else {
            setSelectedTruckId('');
        }
    };

    const handleSetEnd = (loc: any) => {
        setEndLoc(loc);
        setIsBuilderOpen(true);
    };

    return (
        <>
            {locations.map(loc => {
                const parkedInHub = parkedTrucks.get(loc.id) ||[];
                const hasBusy = parkedInHub.some(t => t.status === 'BUSY');

                return (
                    <Marker
                        key={`loc-${loc.id}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={createLocationIcon(loc.type, parkedInHub.length, hasBusy)}
                        zIndexOffset={1000}
                    >
                        <Popup closeButton={false} autoPan={false}>
                            <div className="text-slate-800 font-sans min-w-[260px] max-w-[300px]">
                                <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                                    {loc.name}
                                </strong>
                                <span className="text-xs leading-tight text-slate-500 block mb-2 font-medium uppercase tracking-wider">
                                    {loc.companyName || 'Terminal Niezależny'}
                                </span>

                                <div className="mb-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${loc.type === 'BASE' ? 'bg-blue-100 text-blue-800' :
                                        loc.type === 'PORT' ? 'bg-indigo-100 text-indigo-800' :
                                            'bg-rose-100 text-rose-800'
                                    }`}>
                                        {loc.type === 'BASE' ? 'Baza Floty' : loc.type === 'PORT' ? 'Terminal' : 'Magazyn'}
                                    </span>
                                </div>

                                <div className="flex gap-2 mt-2 mb-3">
                                    <button onClick={() => handleSetStart(loc)} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs py-2 rounded-lg font-bold transition-colors">
                                        <MapPin size={14} /> STĄD
                                    </button>
                                    <button onClick={() => handleSetEnd(loc)} className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs py-2 rounded-lg font-bold transition-colors">
                                        <Flag size={14} /> TUTAJ
                                    </button>
                                </div>

                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex justify-between items-center border-b border-slate-200 pb-1.5">
                                        <span>Pojazdy w Hubie</span>
                                        <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700">{parkedInHub.length}</span>
                                    </div>

                                    {parkedInHub.length === 0 ? (
                                        <div className="text-[11px] text-slate-400 italic text-center py-3">Brak pojazdów stacjonujących.</div>
                                    ) : (
                                        <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                                            {parkedInHub.map(t => (
                                                <div key={t.id} className="flex items-center justify-between bg-white border border-slate-200 p-1.5 rounded shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={14} className={
                                                            t.status === 'AVAILABLE' ? 'text-emerald-500' :
                                                                t.orderStatus === 'APPROACHING' ? 'text-amber-500' :
                                                                    'text-cyan-500'
                                                        } />
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700 leading-none">{t.plateNumber}</span>
                                                            <span className="text-[9px] text-slate-500 leading-none mt-1">{t.brand}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${t.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                        t.orderStatus === 'APPROACHING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                            'bg-cyan-50 text-cyan-600 border border-cyan-100'
                                                    }`}>
                                                        {t.orderStatus === 'APPROACHING' ? 'Dojazd' :
                                                            t.orderStatus === 'LOADING' ? 'Załadunek' :
                                                                t.status === 'BUSY' ? 'W Trasie' : 'Gotowy'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
}