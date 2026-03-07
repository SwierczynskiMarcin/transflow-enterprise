import { useMemo, memo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Building2 } from 'lucide-react';
import { useSimulation, type VehicleData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';

const createLocationIcon = (type: string, truckCount: number, hasBusyTrucks: boolean, isSelected: boolean) => {
    let colorClass = 'border-rose-400';
    let textColorClass = 'text-rose-400';
    let glowColor = isSelected ? 'rgba(244,63,94,0.8)' : 'rgba(244,63,94,0.3)';

    if (type === 'BASE') { colorClass = 'border-blue-400'; textColorClass = 'text-blue-400'; glowColor = isSelected ? 'rgba(96,165,250,0.8)' : 'rgba(96,165,250,0.3)'; }
    else if (type === 'PORT') { colorClass = 'border-indigo-400'; textColorClass = 'text-indigo-400'; glowColor = isSelected ? 'rgba(129,140,248,0.8)' : 'rgba(129,140,248,0.3)'; }

    const badgeBorder = truckCount > 0 ? (hasBusyTrucks ? 'border-cyan-400 text-cyan-400' : 'border-emerald-400 text-emerald-400') : 'border-slate-700 text-white';
    const scaleClass = isSelected ? 'scale-125' : 'group-hover:scale-110';

    const htmlString = renderToString(
        <div className="relative cursor-pointer group">
            <div className={`bg-slate-800 p-2 rounded-xl border-2 ${colorClass} shadow-[0_0_15px_${glowColor}] flex items-center justify-center transition-all duration-300 ${scaleClass}`}>
                <Building2 size={20} className={textColorClass} />
            </div>
            {truckCount > 0 && (
                <div className={`absolute -top-2 -right-2 bg-slate-900 border-2 ${badgeBorder} text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] z-50 transition-transform duration-300 ${scaleClass}`}>
                    {truckCount}
                </div>
            )}
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor:[20, 20] });
};

const MemoizedLocationMarker = memo(({ loc, truckCount, hasBusy, isSelected, onSelect, onHover, onHoverOut }: any) => {
    const icon = useMemo(() => createLocationIcon(loc.type, truckCount, hasBusy, isSelected),[loc.type, truckCount, hasBusy, isSelected]);

    return (
        <Marker
            position={[loc.latitude, loc.longitude]}
            icon={icon}
            zIndexOffset={isSelected ? 3000 : 2000}
            eventHandlers={{
                click: () => onSelect(loc.id),
                mouseover: () => onHover(loc.id),
                mouseout: () => onHoverOut()
            }}
        />
    );
}, (prev, next) => {
    return prev.loc.id === next.loc.id &&
        prev.truckCount === next.truckCount &&
        prev.hasBusy === next.hasBusy &&
        prev.isSelected === next.isSelected;
});

export default function LocationLayer() {
    const { locations, trucks } = useSimulation();
    const { setSelectedLocationId, setHoveredLocationId, selectedLocationId } = useMapContext();

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
    }, [trucks, locations]);

    return (
        <>
            {locations.map(loc => {
                const parkedInHub = parkedTrucks.get(loc.id) ||[];
                const hasBusy = parkedInHub.some(t => t.status === 'BUSY');
                const isSelected = selectedLocationId === loc.id;

                return (
                    <MemoizedLocationMarker
                        key={`loc-${loc.id}`}
                        loc={loc}
                        truckCount={parkedInHub.length}
                        hasBusy={hasBusy}
                        isSelected={isSelected}
                        onSelect={setSelectedLocationId}
                        onHover={setHoveredLocationId}
                        onHoverOut={() => setHoveredLocationId(null)}
                    />
                );
            })}
        </>
    );
}