import React, { createContext, useContext, useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

export interface VehicleData {
    id: number;
    plateNumber: string;
    brand: string;
    model: string;
    currentLat: number;
    currentLng: number;
    status: string; // 'AVAILABLE', 'BUSY'
    progress: number;
    gpsDistance: number;
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
}

const SimulationContext = createContext<SimulationContextProps | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());
    const [isPlaying, setIsPlaying] = useState(true);
    const [speed, setSpeed] = useState(60);
    const [virtualTime, setVirtualTime] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([52.0, 19.0]);
    const [mapZoom, setMapZoom] = useState<number>(6);

    useEffect(() => {
        fetch('http://localhost:8080/api/simulation/status')
            .then(res => res.json())
            .then(data => {
                setIsPlaying(data.isRunning);
                setSpeed(data.timeMultiplier);
            })
            .catch(err => console.error("API Init Error:", err));

        fetch('http://localhost:8080/api/vehicles')
            .then(res => res.json())
            .then((vehicles: any[]) => {
                setTrucks(prev => {
                    const newMap = new Map(prev);
                    vehicles.forEach(v => {
                        newMap.set(v.id, {
                            id: v.id,
                            plateNumber: v.plateNumber,
                            brand: v.brand,
                            model: v.model,
                            currentLat: v.currentLat || 52.0,
                            currentLng: v.currentLng || 19.0,
                            status: v.status || 'AVAILABLE',
                            progress: 0,
                            gpsDistance: 0
                        });
                    });
                    return newMap;
                });
            });

        const socket = new SockJS('http://localhost:8080/ws-trucks');
        const stompClient = Stomp.over(socket);
        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            console.log("✅ Wpięto globalny WebSocket (Context)");

            stompClient.subscribe('/topic/trucks', (message) => {
                const orderData = JSON.parse(message.body);
                const vehicle = orderData.vehicle;

                setTrucks((prev) => {
                    const newMap = new Map(prev);

                    const isFinished = orderData.status === 'COMPLETED' || orderData.progress >= 1.0;

                    newMap.set(vehicle.id, {
                        ...newMap.get(vehicle.id),
                        id: vehicle.id,
                        plateNumber: vehicle.plateNumber,
                        brand: vehicle.brand,
                        model: vehicle.model,
                        currentLat: vehicle.currentLat,
                        currentLng: vehicle.currentLng,
                        status: isFinished ? 'AVAILABLE' : 'BUSY',
                        progress: isFinished ? 0 : orderData.progress,
                        gpsDistance: orderData.gpsDistance
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
    }, []);

    const togglePlay = async () => {
        try {
            const res = await fetch('http://localhost:8080/api/simulation/toggle', { method: 'POST' });
            const data = await res.json();
            setIsPlaying(data.isRunning);
        } catch (err) { console.error(err); }
    };

    const changeSpeed = async (newSpeed: number) => {
        try {
            setSpeed(newSpeed);
            await fetch(`http://localhost:8080/api/simulation/speed?multiplier=${newSpeed}`, { method: 'POST' });
        } catch (err) { console.error(err); }
    };

    const setMapViewState = (center: [number, number], zoom: number) => {
        setMapCenter(center);
        setMapZoom(zoom);
    };

    return (
        <SimulationContext.Provider value={{
            trucks, isPlaying, speed, virtualTime,
            mapCenter, mapZoom,
            togglePlay, changeSpeed, setMapViewState
        }}>
            {children}
        </SimulationContext.Provider>
    );
};

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (!context) throw new Error("useSimulation must be used within SimulationProvider");
    return context;
};