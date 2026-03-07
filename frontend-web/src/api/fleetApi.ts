import { apiClient } from './apiClient';

export const getVehicles = () => apiClient('/vehicles');
export const addVehicle = (data: any) => apiClient('/vehicles', { method: 'POST', body: JSON.stringify(data) });
export const updateVehicle = (id: number, data: any) => apiClient(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteVehicle = (id: number) => apiClient(`/vehicles/${id}`, { method: 'DELETE' });
export const triggerBreakdown = (id: number) => apiClient(`/vehicles/${id}/breakdown`, { method: 'POST' });

export const getDrivers = () => apiClient('/drivers');
export const addDriver = (data: any) => apiClient('/drivers', { method: 'POST', body: JSON.stringify(data) });
export const updateDriver = (id: number, data: any) => apiClient(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDriver = (id: number) => apiClient(`/drivers/${id}`, { method: 'DELETE' });