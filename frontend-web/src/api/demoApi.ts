import { apiClient } from './apiClient';

export const seedLocations = () => apiClient('/demo/seed-locations', { method: 'POST' });
export const seedFleet = () => apiClient('/demo/seed-fleet', { method: 'POST' });
export const autoDispatch = (count: number) => apiClient(`/demo/auto-dispatch?count=${count}`, { method: 'POST' });
export const clearAllData = () => apiClient('/demo/clear-all', { method: 'POST' });