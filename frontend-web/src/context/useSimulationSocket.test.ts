import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSimulationSocket } from './useSimulationSocket'

let onConnectCallback: () => void;
const subscriptions = new Map<string, (message: { body: string }) => void>();
const mockActivate = vi.fn(() => {
    if (onConnectCallback) {
        onConnectCallback();
    }
});
const mockDeactivate = vi.fn();

vi.mock('sockjs-client', () => ({
    default: vi.fn(() => ({ close: vi.fn() }))
}));

vi.mock('@stomp/stompjs', () => ({
    Client: vi.fn().mockImplementation((config) => {
        onConnectCallback = config.onConnect;
        return {
            activate: mockActivate,
            deactivate: mockDeactivate,
            subscribe: (topic: string, callback: (message: { body: string }) => void) => {
                subscriptions.set(topic, callback);
            },
            publish: vi.fn()
        };
    })
}));

describe('useSimulationSocket hook', () => {
    const mockSetTrucks = vi.fn();
    const mockSetIsPlaying = vi.fn();
    const mockSetVirtualTime = vi.fn();
    const mockRefreshVehicles = vi.fn();
    const mockRefreshOrders = vi.fn();

    const hookProps = {
        setTrucks: mockSetTrucks,
        setIsPlaying: mockSetIsPlaying,
        setVirtualTime: mockSetVirtualTime,
        refreshLocations: vi.fn(),
        refreshVehicles: mockRefreshVehicles,
        refreshRoutes: vi.fn(),
        refreshOrders: mockRefreshOrders
    };

    beforeEach(() => {
        vi.clearAllMocks();
        subscriptions.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes stomp client, calls activate on mount, and deactivate on unmount', () => {
        const { unmount } = renderHook(() => useSimulationSocket(hookProps));
        expect(mockActivate).toHaveBeenCalled();
        unmount();
        expect(mockDeactivate).toHaveBeenCalled();
    });

    it('updates trucks on /topic/trucks message', () => {
        renderHook(() => useSimulationSocket(hookProps));
        const truckCallback = subscriptions.get('/topic/trucks');
        expect(truckCallback).toBeDefined();

        const truckUpdate = [{ vehicleId: 1, currentLat: 52.0 }];
        act(() => {
            truckCallback!({ body: JSON.stringify(truckUpdate) });
        });

        expect(mockSetTrucks).toHaveBeenCalled();
    });

    it('updates simulation state on /topic/simulation message', () => {
        renderHook(() => useSimulationSocket(hookProps));
        const simCallback = subscriptions.get('/topic/simulation');
        expect(simCallback).toBeDefined();

        const simUpdate = { running: true, virtualTime: '2026-03-03T08:00:00' };
        act(() => {
            simCallback!({ body: JSON.stringify(simUpdate) });
        });

        expect(mockSetIsPlaying).toHaveBeenCalledWith(true);
        expect(mockSetVirtualTime).toHaveBeenCalledWith('2026-03-03T08:00:00');
    });

    it('calls refresh functions with debounce on /topic/updates message', () => {
        renderHook(() => useSimulationSocket(hookProps));
        const updateCallback = subscriptions.get('/topic/updates');
        expect(updateCallback).toBeDefined();

        act(() => {
            updateCallback!({ body: 'VEHICLES' });
            updateCallback!({ body: 'DRIVERS' });
        });

        expect(mockRefreshVehicles).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(mockRefreshVehicles).toHaveBeenCalledTimes(1);
    });

    it('correctly refreshes orders and related data', () => {
        renderHook(() => useSimulationSocket(hookProps));
        const updateCallback = subscriptions.get('/topic/updates');
        expect(updateCallback).toBeDefined();

        act(() => {
            updateCallback!({ body: 'ORDERS' });
        });

        expect(mockRefreshOrders).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(mockRefreshOrders).toHaveBeenCalledTimes(1);
        expect(mockRefreshVehicles).toHaveBeenCalledTimes(1);
    });
});