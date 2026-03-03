import { useMemo, memo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Truck } from 'lucide-react';
import { useSimulation, type VehicleData } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';

const createTruckIcon = (colorClass: string, glowColor: string) => {
    const htmlString = renderToString(
        <div className={`
            bg-slate-900 p-2 rounded-full border-2 ${colorClass} 
            transition-all duration-300 ease-out cursor-pointer
            shadow-[0_0_15px_${glowColor}] hover:scale-125 hover:shadow-[0_0_25px_${glowColor}]
            flex items-center justify-center group
        `}>
            <Truck size={20} className={colorClass.replace('border-', 'text-')} />
        </div>
    );
    return L.divIcon({ className: 'bg-transparent border-none', html: htmlString, iconSize:[40, 40], iconAnchor: [20, 20], popupAnchor:[0, -20] });
};

const busyIcon = createTruckIcon('border-cyan-400', 'rgba(34,211,238,0.5)');
const availableIcon = createTruckIcon('border-emerald-400', 'rgba(52,211,153,0.5)');
const approachingIcon = createTruckIcon('border-amber-400', 'rgba(251,191,36,0.5)');

const MemoizedTruckMarker = memo(({ truck, onSelect }: { truck: VehicleData, onSelect: (id: number) => void }) => {
    let currentIcon = availableIcon;
    if (truck.status === 'BUSY') {
        currentIcon = truck.orderStatus === 'APPROACHING' ? approachingIcon : busyIcon;
    }

    return (
        <Marker
            position={[truck.currentLat, truck.currentLng]}
            icon={currentIcon}
            eventHandlers={{ click: () => onSelect(truck.id) }}
        >
            <Popup closeButton={false} autoPan={false}>
                <div className="text-slate-800 font-sans min-w-[150px]">
                    <strong className="text-base block mb-1 border-b pb-1 border-slate-200">
                        {truck.brand} {truck.model}
                    </strong>
                    <span className="text-sm leading-tight text-slate-600 block mb-2">
                        Rej: <strong className="text-slate-800">{truck.plateNumber}</strong><br />
                        Kierowca: <strong className="text-slate-800">{truck.driverName}</strong>
                    </span>

                    {truck.status === 'BUSY' ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${truck.orderStatus === 'APPROACHING' ? 'bg-amber-100 text-amber-800' :
                            truck.orderStatus === 'LOADING' ? 'bg-blue-100 text-blue-800' : 'bg-cyan-100 text-cyan-800'
                        }`}>
                            {truck.orderStatus === 'APPROACHING' ? 'Dojazd: ' :
                                truck.orderStatus === 'LOADING' ? 'Załadunek...' : 'W trasie: '}
                            {truck.orderStatus !== 'LOADING' && `${(truck.progress * 100).toFixed(1)}%`}
                        </span>
                    ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full uppercase">Oczekuje w trasie</span>
                    )}
                </div>
            </Popup>
        </Marker>
    );
}, (prev, next) => {
    return prev.truck.currentLat === next.truck.currentLat &&
        prev.truck.currentLng === next.truck.currentLng &&
        prev.truck.status === next.truck.status &&
        prev.truck.orderStatus === next.truck.orderStatus &&
        prev.truck.progress === next.truck.progress;
});

export default function VehicleLayer() {
    const { trucks, locations } = useSimulation();
    const { setSelectedRouteVehicleId } = useMapContext();

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
    },[trucks, locations]);

    return (
        <>
            {trucksOnRoad.map(truck => (
                <MemoizedTruckMarker
                    key={`truck-${truck.id}`}
                    truck={truck}
                    onSelect={setSelectedRouteVehicleId}
                />
            ))}
        </>
    );
}