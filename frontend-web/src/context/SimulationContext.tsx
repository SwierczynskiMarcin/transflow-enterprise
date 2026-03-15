import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';
import { getSimulationStatus, toggleSimulation, setSimulationSpeed } from '../api/simulationApi';
import { useSimulationData } from './useSimulationData';
import { useSimulationSocket } from './useSimulationSocket';
import { useToast } from './ToastContext';

export const decodePolyline = (str: string, precision = 5):[number, number][] => {
    if (!str) return[];
    let index = 0, lat = 0, lng = 0, coordinates: [number, number][] =[], shift = 0, result = 0, byte = null;
    const factor = Math.pow(10, precision);
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        let latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        let longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
};

export interface VehicleData {
    id: number;
    plateNumber: string;
    brand: string;
    model: string;
    currentLat: number;
    currentLng: number;
    status: string;
    orderStatus?: string;
    progress: number;
    gpsDistance: number;
    driverName?: string;
    lastKinematicUpdate?: number;
    isServiceUnit: boolean;
}

export interface ActiveRoute {
    vehicleId: number;
    routePolylineApproaching: string;
    routePolylineTransit: string;
    orderStatus: string;
}

export interface LocationData {
    id: number;
    name: string;
    companyName: string;
    type: string;
    latitude: number;
    longitude: number;
    address: string;
}

export interface OrderData {
    id: number;
    startLocation: LocationData;
    endLocation: LocationData;
    vehicle: VehicleData | null;
    driver: { id: number; firstName: string; lastName: string } | null;
    cargoWeight: number;
    pricePerKm: number;
    status: string;
    progress: number;
}

interface SimulationContextProps {
    trucks: Map<number, VehicleData>;
    locations: LocationData[];
    activeRoutes: Map<number, ActiveRoute>;
    orders: OrderData[];
    isPlaying: boolean | null;
    speed: number;
    virtualTime: string | null;
    mapCenter: [number, number];
    mapZoom: number;
    togglePlay: () => Promise<void>;
    changeSpeed: (newSpeed: number) => Promise<void>;
    setMapViewState: (center: [number, number], zoom: number) => void;
    refreshVehicles: () => Promise<void>;
    refreshLocations: () => Promise<void>;
    refreshRoutes: () => Promise<void>;
    refreshOrders: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const {
        trucks, setTrucks,
        locations, activeRoutes, orders,
        refreshLocations, refreshRoutes, refreshOrders, refreshVehicles
    } = useSimulationData();

    const { showToast } = useToast();
    const[isPlaying, setIsPlaying] = useState<boolean | null>(null);
    const [speed, setSpeed] = useState(60);
    const [virtualTime, setVirtualTime] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([52.0, 19.0]);
    const [mapZoom, setMapZoom] = useState<number>(6);

    useEffect(() => {
        getSimulationStatus()
            .then(data => {
                if (data) {
                    setIsPlaying(data.isRunning);
                    setSpeed(data.timeMultiplier);
                }
            }).catch(() => {});

        refreshVehicles();
        refreshLocations();
        refreshRoutes();
        refreshOrders();
    }, [refreshVehicles, refreshLocations, refreshRoutes, refreshOrders]);

    useSimulationSocket({
        setTrucks,
        setIsPlaying: (val) => setIsPlaying(val),
        setVirtualTime,
        refreshLocations,
        refreshVehicles,
        refreshRoutes,
        refreshOrders
    });

    const togglePlay = async () => {
        try {
            const data = await toggleSimulation();
            if (data) setIsPlaying(data.isRunning);
        } catch (error) {}
    };

    const changeSpeed = async (newSpeed: number) => {
        const prevSpeed = speed;
        try {
            setSpeed(newSpeed);
            await setSimulationSpeed(newSpeed);
        } catch (error: any) {
            setSpeed(prevSpeed);
            showToast(error.message || 'Błąd modyfikacji wektora czasowego silnika', 'error');
        }
    };

    const setMapViewState = (center: [number, number], zoom: number) => {
        setMapCenter(center);
        setMapZoom(zoom);
    };

    return (
        <SimulationContext.Provider value={{
            trucks, locations, activeRoutes, orders, isPlaying, speed, virtualTime,
            mapCenter, mapZoom,
            togglePlay, changeSpeed, setMapViewState, refreshVehicles, refreshLocations, refreshRoutes, refreshOrders
        }}>
            {children}
        </SimulationContext.Provider>
    );
};

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (!context) throw new Error("useSimulation must be used");
    return context;
};