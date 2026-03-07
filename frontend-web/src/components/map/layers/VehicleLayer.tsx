import { useMemo, memo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck, Wrench } from 'lucide-react';
import { useSimulation, type VehicleData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';

const createTruckIcon = (colorClass: string, glowColor: string, isSelected: boolean, isBroken: boolean, isWaitingForTow: boolean, isServiceUnit: boolean, isBeingTowed: boolean) => {
    const dynamicGlow = isSelected ? glowColor.replace('0.5)', '0.9)').replace('0.8)', '1)') : glowColor;
    const scaleClass = isSelected ? 'scale-125' : 'hover:scale-110';
    const brokenClass = isBroken ? 'animate-pulse' : '';
    const towOpacity = isWaitingForTow ? 'opacity-60' : isBeingTowed ? 'opacity-30 scale-75' : 'opacity-100';

    const IconComponent = isServiceUnit ? Wrench : Truck;

    const htmlString = renderToString(
        <div className={`
            bg-slate-900 p-2 rounded-full border-2 ${colorClass} 
            transition-all duration-300 ease-out cursor-pointer
            shadow-[0_0_15px_${dynamicGlow}] ${scaleClass} ${brokenClass} ${towOpacity}
            flex items-center justify-center group
        `}>
            <IconComponent size={20} className={colorClass.replace('border-', 'text-')} />
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor: [20, 20] });
};

const MemoizedTruckMarker = memo(({
                                      truck, onSelect, onHover, onHoverOut, isSelected
                                  }: {
    truck: VehicleData,
    onSelect: (id: number) => void,
    onHover: (id: number) => void,
    onHoverOut: () => void,
    isSelected: boolean
}) => {
    let colorClass = truck.isServiceUnit ? 'border-orange-400' : 'border-emerald-400';
    let glowColor = truck.isServiceUnit ? 'rgba(251,146,60,0.5)' : 'rgba(52,211,153,0.5)';

    let isBroken = truck.status === 'BROKEN';
    let isWaitingForTow = truck.status === 'WAITING_FOR_TOW';
    let isBeingTowed = truck.status === 'BEING_TOWED';

    if (isBroken) {
        colorClass = 'border-rose-500';
        glowColor = 'rgba(244,63,94,0.8)';
    } else if (isWaitingForTow || isBeingTowed) {
        colorClass = 'border-slate-500 border-dashed';
        glowColor = 'rgba(100,116,139,0.5)';
    } else if (truck.status === 'HANDOVER' || truck.status === 'WAITING_FOR_CARGO_CLEARANCE') {
        colorClass = 'border-fuchsia-400';
        glowColor = 'rgba(232,121,249,0.8)';
    } else if (truck.status === 'RESCUE_MISSION' || truck.orderStatus === 'RESCUE_APPROACHING' || truck.status === 'TOW_APPROACHING' || truck.status === 'TOWING') {
        colorClass = truck.isServiceUnit ? 'border-orange-500' : 'border-indigo-400';
        glowColor = truck.isServiceUnit ? 'rgba(249,115,22,0.8)' : 'rgba(99,102,241,0.5)';
    } else if (truck.status === 'BUSY') {
        if (truck.orderStatus === 'APPROACHING') {
            colorClass = 'border-amber-400';
            glowColor = 'rgba(251,191,36,0.5)';
        } else {
            colorClass = 'border-cyan-400';
            glowColor = 'rgba(34,211,238,0.5)';
        }
    }

    const icon = useMemo(() => createTruckIcon(colorClass, glowColor, isSelected, isBroken, isWaitingForTow, truck.isServiceUnit, isBeingTowed),[colorClass, glowColor, isSelected, isBroken, isWaitingForTow, truck.isServiceUnit, isBeingTowed]);

    return (
        <Marker
            position={[truck.currentLat, truck.currentLng]}
            icon={icon}
            zIndexOffset={isSelected ? 1500 : isBeingTowed ? 200 : 500}
            eventHandlers={{
                click: () => onSelect(truck.id),
                mouseover: () => onHover(truck.id),
                mouseout: () => onHoverOut()
            }}
        />
    );
}, (prev, next) => {
    return prev.truck.currentLat === next.truck.currentLat &&
        prev.truck.currentLng === next.truck.currentLng &&
        prev.truck.status === next.truck.status &&
        prev.truck.orderStatus === next.truck.orderStatus &&
        prev.truck.progress === next.truck.progress &&
        prev.isSelected === next.isSelected;
});

export default function VehicleLayer() {
    const { trucks, locations } = useSimulation();
    const {
        setSelectedRouteVehicleId,
        setHoveredVehicleId,
        selectedRouteVehicleId
    } = useMapContext();

    const trucksOnRoad = useMemo(() => {
        const onRoad: VehicleData[] =[];
        Array.from(trucks.values()).forEach(truck => {
            let isParked = false;
            for (const loc of locations) {
                if (calculateDistance(truck.currentLat, truck.currentLng, loc.latitude, loc.longitude) <= 0.5) {
                    isParked = true;
                    break;
                }
            }
            if (!isParked || truck.status === 'WAITING_FOR_TOW' || truck.status === 'BEING_TOWED') { onRoad.push(truck); }
        });
        return onRoad;
    }, [trucks, locations]);

    return (
        <>
            {trucksOnRoad.map(truck => (
                <MemoizedTruckMarker
                    key={`truck-${truck.id}`}
                    truck={truck}
                    isSelected={selectedRouteVehicleId === truck.id}
                    onSelect={setSelectedRouteVehicleId}
                    onHover={setHoveredVehicleId}
                    onHoverOut={() => setHoveredVehicleId(null)}
                />
            ))}
        </>
    );
}