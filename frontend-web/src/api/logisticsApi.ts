import { apiClient } from './apiClient';

export const getLocations = () => apiClient('/locations');
export const addLocation = (data: any) => apiClient('/locations', { method: 'POST', body: JSON.stringify(data) });
export const updateLocation = (id: number, data: any) => apiClient(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLocation = (id: number) => apiClient(`/locations/${id}`, { method: 'DELETE' });

export const getOrders = () => apiClient('/orders');
export const createOrder = (data: any) => apiClient('/orders', { method: 'POST', body: JSON.stringify(data) });
export const getActiveRoutes = () => apiClient('/orders/active-routes');