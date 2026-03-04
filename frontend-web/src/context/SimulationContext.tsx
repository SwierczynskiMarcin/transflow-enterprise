import { createContext, useContext, useEffect, useState, useCallback, type FC, type ReactNode } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { getLocations, getActiveRoutes, getOrders } from '../api/logisticsApi';
import { getVehicles, getDrivers } from '../api/fleetApi';
import { getSimulationStatus, toggleSimulation, setSimulationSpeed } from '../api/simulationApi';

export const decodePolyline = (str: string, precision = 5): [number, number][] => {
    if (!str) return[];
    let index = 0, lat = 0, lng = 0, coordinates:[number, number][] =[], shift = 0, result = 0, byte = null;
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
    isPlaying: boolean;
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
    const[trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());
    const [locations, setLocations] = useState<LocationData[]>([]);
    const[activeRoutes, setActiveRoutes] = useState<Map<number, ActiveRoute>>(new Map());
    const[orders, setOrders] = useState<OrderData[]>([]);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(60);
    const[virtualTime, setVirtualTime] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([52.0, 19.0]);
    const[mapZoom, setMapZoom] = useState<number>(6);

    const refreshLocations = useCallback(async () => {
        try {
            const data = await getLocations();
            setLocations(data ||[]);
        } catch (err) {}
    },[]);

    const refreshRoutes = useCallback(async () => {
        try {
            const data: ActiveRoute[] = await getActiveRoutes() ||[];
            const routeMap = new Map<number, ActiveRoute>();
            data.forEach(r => {
                routeMap.set(r.vehicleId, r);
            });
            setActiveRoutes(routeMap);

            setTrucks(prev => {
                let changed = false;
                const newMap = new Map(prev);
                data.forEach(r => {
                    const truck = newMap.get(r.vehicleId);
                    if (truck && truck.orderStatus !== r.orderStatus && truck.status === 'BUSY') {
                        newMap.set(r.vehicleId, { ...truck, orderStatus: r.orderStatus });
                        changed = true;
                    }
                });
                return changed ? newMap : prev;
            });
        } catch (err) {}
    },[]);

    const refreshOrders = useCallback(async () => {
        try {
            const data = await getOrders();
            setOrders(data ||[]);
        } catch (err) {}
    },[]);

    const refreshVehicles = useCallback(async () => {
        try {
            const [vehicles, drivers] = await Promise.all([
                getVehicles(),
                getDrivers()
            ]);

            const driverMap = new Map();
            if (drivers) {
                drivers.forEach((d: any) => {
                    if (d.assignedVehicle) driverMap.set(d.assignedVehicle.id, `${d.firstName} ${d.lastName}`);
                });
            }

            setTrucks(prev => {
                const newMap = new Map(prev);
                if (!vehicles) return prev;

                const dbVehicleIds = new Set(vehicles.map((v: any) => v.id));
                for (const id of newMap.keys()) {
                    if (!dbVehicleIds.has(id)) newMap.delete(id);
                }

                vehicles.forEach((v: any) => {
                    const existing = newMap.get(v.id);
                    const isCurrentlyBusy = existing && existing.status === 'BUSY';

                    newMap.set(v.id, {
                        id: v.id,
                        plateNumber: v.plateNumber,
                        brand: v.brand,
                        model: v.model,
                        currentLat: isCurrentlyBusy ? existing.currentLat : (v.currentLat || 52.0),
                        currentLng: isCurrentlyBusy ? existing.currentLng : (v.currentLng || 19.0),
                        status: isCurrentlyBusy ? 'BUSY' : (v.status || 'AVAILABLE'),
                        orderStatus: existing ? existing.orderStatus : undefined,
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

        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws-trucks'),
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe('/topic/trucks', (message) => {
                    const payload = JSON.parse(message.body);
                    const dtoList = Array.isArray(payload) ? payload : [payload];

                    setTrucks((prev) => {
                        let changed = false;
                        const newMap = new Map(prev);

                        for (const dto of dtoList) {
                            const existing = newMap.get(dto.vehicleId);

                            if (existing && existing.orderStatus === dto.orderStatus && dto.progress < existing.progress - 0.001) {
                                continue;
                            }

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
                            changed = true;
                        }

                        return changed ? newMap : prev;
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
        try {
            const data = await toggleSimulation();
            if (data) setIsPlaying(data.isRunning);
        } catch (error) {
            console.error(error);
        }
    };

    const changeSpeed = async (newSpeed: number) => {
        try {
            setSpeed(newSpeed);
            await setSimulationSpeed(newSpeed);
        } catch (error) {
            console.error(error);
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