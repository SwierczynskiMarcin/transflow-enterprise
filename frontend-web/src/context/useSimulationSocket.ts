import { useEffect } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import type { VehicleData } from './SimulationContext';

interface UseSimulationSocketParams {
    setTrucks: React.Dispatch<React.SetStateAction<Map<number, VehicleData>>>;
    setIsPlaying: (playing: boolean) => void;
    setVirtualTime: (time: string | null) => void;
    refreshLocations: () => void;
    refreshVehicles: () => void;
    refreshRoutes: () => void;
    refreshOrders: () => void;
}

export function useSimulationSocket({
                                        setTrucks, setIsPlaying, setVirtualTime,
                                        refreshLocations, refreshVehicles, refreshRoutes, refreshOrders
                                    }: UseSimulationSocketParams) {
    useEffect(() => {
        let locationsTimeout: ReturnType<typeof setTimeout>;
        let vehiclesTimeout: ReturnType<typeof setTimeout>;
        let ordersTimeout: ReturnType<typeof setTimeout>;

        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws-trucks'),
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe('/topic/trucks', (message) => {
                    const payload = JSON.parse(message.body);
                    const dtoList = Array.isArray(payload) ? payload : [payload];

                    let needsImmediateVehicleRefresh = false;

                    setTrucks((prev) => {
                        let changed = false;
                        const newMap = new Map(prev);

                        for (const dto of dtoList) {
                            const existing = newMap.get(dto.vehicleId);

                            const statusChanged = !existing || existing.status !== dto.status;
                            const orderStatusChanged = existing?.orderStatus !== dto.orderStatus;
                            const isNewRoute = dto.progress < 0.1 && (existing?.progress ?? 0) > 0.85;
                            const isStaleFrame =
                                existing &&
                                !statusChanged &&
                                !orderStatusChanged &&
                                dto.progress < existing.progress - 0.001 &&
                                !isNewRoute;

                            if (isStaleFrame) continue;

                            const nextTowChanged = (dto.nextTowTargetId ?? null) !== (existing?.nextTowTargetId ?? null);
                            if (nextTowChanged) {
                                needsImmediateVehicleRefresh = true;
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
                                isServiceUnit: dto.isServiceUnit ?? existing?.isServiceUnit ?? false,
                                nextTowTargetId: dto.nextTowTargetId ?? null,
                                targetTowId: dto.targetTowId ?? null,
                                driverName: existing?.driverName || 'Brak przypisania',
                                lastKinematicUpdate: Date.now()
                            });
                            changed = true;
                        }

                        return changed ? newMap : prev;
                    });

                    if (needsImmediateVehicleRefresh) {
                        clearTimeout(vehiclesTimeout);
                        refreshVehicles();
                    }
                });

                client.subscribe('/topic/simulation', (message) => {
                    const simState = JSON.parse(message.body);
                    setIsPlaying(simState.running);
                    setVirtualTime(simState.virtualTime);
                });

                client.subscribe('/topic/updates', (message) => {
                    const type = message.body;
                    if (type === 'LOCATIONS') {
                        clearTimeout(locationsTimeout);
                        locationsTimeout = setTimeout(refreshLocations, 400);
                    }
                    if (type === 'VEHICLES' || type === 'DRIVERS') {
                        clearTimeout(vehiclesTimeout);
                        vehiclesTimeout = setTimeout(refreshVehicles, 400);
                    }
                    if (type === 'ORDERS') {
                        clearTimeout(ordersTimeout);
                        ordersTimeout = setTimeout(() => {
                            refreshRoutes();
                            refreshOrders();
                            refreshVehicles();
                        }, 400);
                    }
                });
            }
        });

        client.activate();

        return () => {
            clearTimeout(locationsTimeout);
            clearTimeout(vehiclesTimeout);
            clearTimeout(ordersTimeout);
            client.deactivate();
        };
    }, [refreshVehicles, refreshLocations, refreshRoutes, refreshOrders, setTrucks, setIsPlaying, setVirtualTime]);
}