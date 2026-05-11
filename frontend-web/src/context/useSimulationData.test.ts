import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulationData } from './useSimulationData';
import * as logisticsApi from '../api/logisticsApi';
import * as fleetApi from '../api/fleetApi';

vi.mock('../api/logisticsApi', () => ({
    getLocations: vi.fn(),
    getActiveRoutes: vi.fn(),
    getOrders: vi.fn()
}));

vi.mock('../api/fleetApi', () => ({
    getVehicles: vi.fn(),
    getDrivers: vi.fn()
}));

describe('useSimulationData hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes with empty data structures', () => {
        const { result } = renderHook(() => useSimulationData());

        expect(result.current.trucks.size).toBe(0);
        expect(result.current.locations).toEqual([]);
        expect(result.current.orders).toEqual([]);
        expect(result.current.activeRoutes.size).toBe(0);
    });

    it('successfully refreshes locations', async () => {
        const mockLocations = [{ id: 1, name: 'Warsaw Central Hub' }];
        vi.mocked(logisticsApi.getLocations).mockResolvedValue(mockLocations);

        const { result } = renderHook(() => useSimulationData());

        await act(async () => {
            await result.current.refreshLocations();
        });

        expect(result.current.locations).toEqual(mockLocations);
    });

    it('refreshes vehicles and correctly maps drivers', async () => {
        const mockVehicles = [{ id: 1, plateNumber: 'WA123', status: 'AVAILABLE', currentLat: 52.0, currentLng: 21.0 }];
        const mockDrivers = [{ id: 10, firstName: 'Jan', lastName: 'Kowalski', assignedVehicle: { id: 1 } }];

        vi.mocked(fleetApi.getVehicles).mockResolvedValue(mockVehicles);
        vi.mocked(fleetApi.getDrivers).mockResolvedValue(mockDrivers);

        const { result } = renderHook(() => useSimulationData());

        await act(async () => {
            await result.current.refreshVehicles();
        });

        const truck = result.current.trucks.get(1);
        expect(truck).toBeDefined();
        expect(truck?.driverName).toBe('Jan Kowalski');
    });

    it('protects kinematic data from being overwritten by stale REST updates', async () => {
        const now = Date.now();
        const initialTruck = {
            id: 1,
            plateNumber: 'WA123',
            status: 'AVAILABLE',
            currentLat: 52.0,
            currentLng: 21.0,
            lastKinematicUpdate: now
        };

        const staleRestVehicle = {
            id: 1,
            plateNumber: 'WA123',
            status: 'AVAILABLE',
            currentLat: 50.0,
            currentLng: 20.0
        };

        vi.mocked(fleetApi.getVehicles).mockResolvedValue([staleRestVehicle]);
        vi.mocked(fleetApi.getDrivers).mockResolvedValue([]);

        const { result } = renderHook(() => useSimulationData());

        await act(async () => {
            result.current.setTrucks(new Map([[1, initialTruck as any]]));
        });

        vi.advanceTimersByTime(1000);

        await act(async () => {
            await result.current.refreshVehicles();
        });

        const truck = result.current.trucks.get(1);
        expect(truck?.currentLat).toBe(52.0);
    });

    it('updates vehicle state locally without API call', async () => {
        const { result } = renderHook(() => useSimulationData());

        await act(async () => {
            result.current.setTrucks(new Map([[1, { id: 1, plateNumber: 'WA123' } as any]]));
        });

        await act(async () => {
            result.current.updateVehicleLocally(1, { plateNumber: 'NEW-PLATE' });
        });

        expect(result.current.trucks.get(1)?.plateNumber).toBe('NEW-PLATE');
    });

    it('cleans up trucks state when vehicles are removed from database', async () => {
        vi.mocked(fleetApi.getVehicles).mockResolvedValue([]);
        vi.mocked(fleetApi.getDrivers).mockResolvedValue([]);

        const { result } = renderHook(() => useSimulationData());

        await act(async () => {
            result.current.setTrucks(new Map([[99, { id: 99 } as any]]));
        });

        await act(async () => {
            await result.current.refreshVehicles();
        });

        expect(result.current.trucks.has(99)).toBe(false);
    });
});