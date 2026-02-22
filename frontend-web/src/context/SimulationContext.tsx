import React, { createContext, useContext, useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

export interface VehicleData {
    id: number;
    status: string;
    vehicle: { plateNumber: string; brand: string; model: string; };
    currentLat: number; currentLng: number;
    gpsDistance: number; progress: number;
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

        const socket = new SockJS('http://localhost:8080/ws-trucks');
        const stompClient = Stomp.over(socket);
        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            console.log("✅ Wpięto globalny WebSocket (Context)");

            stompClient.subscribe('/topic/trucks', (message) => {
                const truckData: VehicleData = JSON.parse(message.body);

                setTrucks((prev) => {
                    const newMap = new Map(prev);
                    if (truckData.status === 'COMPLETED' || truckData.progress >= 1.0) {
                        newMap.delete(truckData.id);
                    } else {
                        newMap.set(truckData.id, truckData);
                    }
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