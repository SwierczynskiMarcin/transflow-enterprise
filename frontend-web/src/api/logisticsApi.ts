import { apiClient } from './apiClient';

export const getLocations = () => apiClient('/locations');
export const addLocation = (data: any) => apiClient('/locations', { method: 'POST', body: JSON.stringify(data) });
export const updateLocation = (id: number, data: any) => apiClient(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLocation = (id: number) => apiClient(`/locations/${id}`, { method: 'DELETE' });

export const getOrders = () => apiClient('/orders');
export const createOrder = (data: any) => apiClient('/orders', { method: 'POST', body: JSON.stringify(data) });
export const getActiveRoutes = () => apiClient('/orders/active-routes');

export const getRescueCandidates = (vehicleId: number) => apiClient(`/rescue-radar/${vehicleId}`);
export const assignRescue = (rescuerId: number, brokenVehicleId: number) => apiClient('/rescue-radar/assign', { method: 'POST', body: JSON.stringify({ rescuerId, brokenVehicleId }) });
export const autoAssignRescue = (vehicleId: number) => apiClient(`/rescue-radar/${vehicleId}/auto-assign`, { method: 'POST' });