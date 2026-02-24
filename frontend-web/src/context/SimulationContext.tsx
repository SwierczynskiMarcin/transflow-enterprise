import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

export interface VehicleData {
    id: number;
    plateNumber: string;
    brand: string;
    model: string;
    currentLat: number;
    currentLng: number;
    status: string;
    progress: number;
    gpsDistance: number;
    driverName?: string;
}

interface SimulationContextProps {
    trucks: Map<number, VehicleData>;
    isPlaying: boolean;
    speed: number;
    virtualTime: string | null;
    mapCenter: [number, number];
    mapZoom: number;
    togglePlay: () => Promise<void>;
    changeSpeed: (newSpeed: number) => Promise<void>;
    setMapViewState: (center: [number, number], zoom: number) => void;
    refreshVehicles: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(60);
    const [virtualTime, setVirtualTime] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([52.0, 19.0]);
    const [mapZoom, setMapZoom] = useState<number>(6);

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
                if (d.assignedVehicle) {
                    driverMap.set(d.assignedVehicle.id, `${d.firstName} ${d.lastName}`);
                }
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
                        driverName: driverMap.get(v.id) || 'Brak przypisania' // Łączymy dane!
                    });
                });
                return newMap;
            });
        } catch (err) {
            console.error("Błąd pobierania danych:", err);
        }
    }, []);

    useEffect(() => {
        fetch('http://localhost:8080/api/simulation/status')
            .then(res => res.json())
            .then(data => {
                setIsPlaying(data.isRunning);
                setSpeed(data.timeMultiplier);
            })
            .catch(err => console.error("API Init Error:", err));

        refreshVehicles();

        const socket = new SockJS('http://localhost:8080/ws-trucks');
        const stompClient = Stomp.over(socket);
        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            stompClient.subscribe('/topic/trucks', (message) => {
                const orderData = JSON.parse(message.body);
                const vehicle = orderData.vehicle;

                setTrucks((prev) => {
                    const newMap = new Map(prev);
                    const isFinished = orderData.status === 'COMPLETED' || orderData.progress >= 1.0;
                    const existing = newMap.get(vehicle.id);

                    newMap.set(vehicle.id, {
                        ...existing,
                        id: vehicle.id,
                        plateNumber: vehicle.plateNumber,
                        brand: vehicle.brand,
                        model: vehicle.model,
                        currentLat: vehicle.currentLat,
                        currentLng: vehicle.currentLng,
                        status: isFinished ? 'AVAILABLE' : 'BUSY',
                        progress: isFinished ? 0 : orderData.progress,
                        gpsDistance: orderData.gpsDistance,
                        driverName: existing?.driverName || 'Brak przypisania'
                    });

                    return newMap;
                });
            });

            stompClient.subscribe('/topic/simulation', (message) => {
                const simState = JSON.parse(message.body);
                setIsPlaying(simState.running);
                setVirtualTime(simState.virtualTime);
            });
        });

        return () => {
            if (stompClient.connected) stompClient.disconnect();
        };
    }, [refreshVehicles]);

    const togglePlay = async () => { /* bez zmian */
        const res = await fetch('http://localhost:8080/api/simulation/toggle', { method: 'POST' });
        const data = await res.json();
        setIsPlaying(data.isRunning);
    };

    const changeSpeed = async (newSpeed: number) => { /* bez zmian */
        setSpeed(newSpeed);
        await fetch(`http://localhost:8080/api/simulation/speed?multiplier=${newSpeed}`, { method: 'POST' });
    };

    const setMapViewState = (center: [number, number], zoom: number) => {
        setMapCenter(center);
        setMapZoom(zoom);
    };

    return (
        <SimulationContext.Provider value={{
            trucks, isPlaying, speed, virtualTime,
            mapCenter, mapZoom,
            togglePlay, changeSpeed, setMapViewState, refreshVehicles
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