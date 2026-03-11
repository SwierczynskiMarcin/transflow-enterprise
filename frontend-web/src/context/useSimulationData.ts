import { useState, useCallback } from 'react';
import { getLocations, getActiveRoutes, getOrders } from '../api/logisticsApi';
import { getVehicles, getDrivers } from '../api/fleetApi';
import type { VehicleData, LocationData, ActiveRoute, OrderData } from './SimulationContext';

export function useSimulationData() {
    const [trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());
    const [locations, setLocations] = useState<LocationData[]>([]);
    const[activeRoutes, setActiveRoutes] = useState<Map<number, ActiveRoute>>(new Map());
    const[orders, setOrders] = useState<OrderData[]>([]);

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
                    if (truck && truck.orderStatus !== r.orderStatus && (truck.status === 'BUSY' || truck.status === 'TOW_APPROACHING' || truck.status === 'TOWING')) {
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
            setOrders(data || []);
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
                    const now = Date.now();
                    const recentlyUpdatedByWS = existing?.lastKinematicUpdate && (now - existing.lastKinematicUpdate < 3000);

                    const criticalStates =['WAITING_FOR_TOW', 'BROKEN', 'RESCUE_MISSION', 'HANDOVER', 'BEING_TOWED', 'WAITING_FOR_CARGO_CLEARANCE', 'TOW_APPROACHING', 'TOWING', 'AVAILABLE'];
                    const forceOverride = existing?.status !== v.status && (criticalStates.includes(v.status) || criticalStates.includes(existing?.status || ''));

                    if (existing && recentlyUpdatedByWS && !forceOverride) {
                        newMap.set(v.id, {
                            ...existing,
                            plateNumber: v.plateNumber,
                            brand: v.brand,
                            model: v.model,
                            isServiceUnit: v.isServiceUnit,
                            driverName: driverMap.get(v.id) || 'Brak przypisania'
                        });
                    } else {
                        const isAvailable = v.status === 'AVAILABLE';
                        newMap.set(v.id, {
                            id: v.id,
                            plateNumber: v.plateNumber,
                            brand: v.brand,
                            model: v.model,
                            isServiceUnit: v.isServiceUnit,
                            currentLat: v.currentLat || 52.0,
                            currentLng: v.currentLng || 19.0,
                            status: v.status || 'AVAILABLE',
                            orderStatus: isAvailable ? undefined : existing?.orderStatus,
                            progress: isAvailable ? 0 : (forceOverride ? 0 : (existing?.progress || 0)),
                            gpsDistance: forceOverride ? 0 : (existing?.gpsDistance || 0),
                            driverName: driverMap.get(v.id) || 'Brak przypisania',
                            lastKinematicUpdate: existing?.lastKinematicUpdate || 0
                        });
                    }
                });
                return newMap;
            });
        } catch (err) {}
    },[]);

    return {
        trucks, setTrucks,
        locations, activeRoutes, orders,
        refreshLocations, refreshRoutes, refreshOrders, refreshVehicles
    };
}