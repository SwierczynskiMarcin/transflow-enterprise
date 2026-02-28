import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

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
    vehicle: VehicleData;
    driver: { firstName: string, lastName: string } | null;
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
    isPlaying: boolean;
    speed: number;
    virtualTime: string | null;
    mapCenter:[number, number];
    mapZoom: number;
    togglePlay: () => Promise<void>;
    changeSpeed: (newSpeed: number) => Promise<void>;
    setMapViewState: (center:[number, number], zoom: number) => void;
    refreshVehicles: () => Promise<void>;
    refreshLocations: () => Promise<void>;
    refreshRoutes: () => Promise<void>;
    refreshOrders: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());
    const[locations, setLocations] = useState<LocationData[]>([]);
    const [activeRoutes, setActiveRoutes] = useState<Map<number, ActiveRoute>>(new Map());
    const [orders, setOrders] = useState<OrderData[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);
    const[speed, setSpeed] = useState(60);
    const [virtualTime, setVirtualTime] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([52.0, 19.0]);
    const [mapZoom, setMapZoom] = useState<number>(6);

    const refreshLocations = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:8080/api/locations');
            setLocations(await res.json());
        } catch (err) {}
    },[]);

    const refreshRoutes = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:8080/api/orders/active-routes');
            const data: ActiveRoute[] = await res.json();
            const routeMap = new Map();
            data.forEach(r => routeMap.set(r.vehicleId, r));
            setActiveRoutes(routeMap);
        } catch (err) {}
    },[]);

    const refreshOrders = useCallback(async () => {
        try {
            const res = await fetch('http://localhost:8080/api/orders');
            setOrders(await res.json());
        } catch (err) {}
    },[]);

    const refreshVehicles = useCallback(async () => {
        try {
            const [vehRes, drvRes] = await Promise.all([
                fetch('http://localhost:8080/api/vehicles'),
                fetch('http://localhost:8080/api/drivers')
            ]);

            const vehicles: any[] = await vehRes.json();
            const drivers: any[] = await drvRes.json();

            const driverMap = new Map();
            drivers.forEach(d => {
                if (d.assignedVehicle) driverMap.set(d.assignedVehicle.id, `${d.firstName} ${d.lastName}`);
            });

            setTrucks(prev => {
                const newMap = new Map(prev);
                const dbVehicleIds = new Set(vehicles.map(v => v.id));
                for (const id of newMap.keys()) {
                    if (!dbVehicleIds.has(id)) newMap.delete(id);
                }

                vehicles.forEach(v => {
                    const existing = newMap.get(v.id);
                    newMap.set(v.id, {
                        id: v.id,
                        plateNumber: v.plateNumber,
                        brand: v.brand,
                        model: v.model,
                        currentLat: v.currentLat || 52.0,
                        currentLng: v.currentLng || 19.0,
                        status: existing?.status === 'BUSY' ? 'BUSY' : (v.status || 'AVAILABLE'),
                        progress: existing ? existing.progress : 0,
                        gpsDistance: existing ? existing.gpsDistance : 0,
                        driverName: driverMap.get(v.id) || 'Brak przypisania'
                    });
                });
                return newMap;
            });
        } catch (err) {}
    },[]);

    useEffect(() => {
        fetch('http://localhost:8080/api/simulation/status')
            .then(res => res.json())
            .then(data => {
                setIsPlaying(data.isRunning);
                setSpeed(data.timeMultiplier);
            }).catch(() => {});

        refreshVehicles();
        refreshLocations();
        refreshRoutes();
        refreshOrders();

        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws-trucks'),
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe('/topic/trucks', (message) => {
                    const dto = JSON.parse(message.body);

                    setTrucks((prev) => {
                        const existing = prev.get(dto.vehicleId);

                        if (existing && existing.orderStatus === dto.orderStatus && dto.progress < existing.progress - 0.001) {
                            return prev;
                        }

                        const newMap = new Map(prev);
                        const isFinished = dto.status === 'AVAILABLE';

                        newMap.set(dto.vehicleId, {
                            ...existing,
                            id: dto.vehicleId,
                            plateNumber: dto.plateNumber,
                            brand: dto.brand,
                            model: dto.model,
                            currentLat: dto.currentLat,
                            currentLng: dto.currentLng,
                            status: dto.status,
                            orderStatus: isFinished ? undefined : dto.orderStatus,
                            progress: isFinished ? 0 : dto.progress,
                            gpsDistance: dto.gpsDistance,
                            driverName: existing?.driverName || 'Brak przypisania'
                        });

                        return newMap;
                    });
                });

                client.subscribe('/topic/simulation', (message) => {
                    const simState = JSON.parse(message.body);
                    setIsPlaying(simState.running);
                    setVirtualTime(simState.virtualTime);
                });

                client.subscribe('/topic/updates', (message) => {
                    const type = message.body;
                    if (type === 'LOCATIONS') refreshLocations();
                    if (type === 'VEHICLES' || type === 'DRIVERS') refreshVehicles();
                    if (type === 'ORDERS') {
                        refreshRoutes();
                        refreshOrders();
                    }
                });
            }
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    },[refreshVehicles, refreshLocations, refreshRoutes, refreshOrders]);

    const togglePlay = async () => {
        const res = await fetch('http://localhost:8080/api/simulation/toggle', { method: 'POST' });
        const data = await res.json();
        setIsPlaying(data.isRunning);
    };

    const changeSpeed = async (newSpeed: number) => {
        setSpeed(newSpeed);
        await fetch(`http://localhost:8080/api/simulation/speed?multiplier=${newSpeed}`, { method: 'POST' });
    };

    const setMapViewState = (center:[number, number], zoom: number) => {
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