import { apiClient } from './apiClient';

export const getSimulationStatus = () => apiClient('/simulation/status');
export const toggleSimulation = () => apiClient('/simulation/toggle', { method: 'POST' });
export const setSimulationSpeed = (multiplier: number) => apiClient(`/simulation/speed?multiplier=${multiplier}`, { method: 'POST' });