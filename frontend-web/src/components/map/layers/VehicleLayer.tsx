import { useMemo, memo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck } from 'lucide-react';
import { useSimulation, type VehicleData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';

const createTruckIcon = (colorClass: string, glowColor: string, isSelected: boolean) => {
    const dynamicGlow = isSelected ? glowColor.replace('0.5)', '0.9)') : glowColor;
    const scaleClass = isSelected ? 'scale-125' : 'hover:scale-110';

    const htmlString = renderToString(
        <div className={`
            bg-slate-900 p-2 rounded-full border-2 ${colorClass} 
            transition-all duration-300 ease-out cursor-pointer
            shadow-[0_0_15px_${dynamicGlow}] ${scaleClass}
            flex items-center justify-center group
        `}>
            <Truck size={20} className={colorClass.replace('border-', 'text-')} />
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
    let colorClass = 'border-emerald-400';
    let glowColor = 'rgba(52,211,153,0.5)';

    if (truck.status === 'BUSY') {
        if (truck.orderStatus === 'APPROACHING') {
            colorClass = 'border-amber-400';
            glowColor = 'rgba(251,191,36,0.5)';
        } else {
            colorClass = 'border-cyan-400';
            glowColor = 'rgba(34,211,238,0.5)';
        }
    }

    return (
        <Marker
            position={[truck.currentLat, truck.currentLng]}
            icon={createTruckIcon(colorClass, glowColor, isSelected)}
            zIndexOffset={isSelected ? 1000 : 500}
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
            if (!isParked) { onRoad.push(truck); }
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