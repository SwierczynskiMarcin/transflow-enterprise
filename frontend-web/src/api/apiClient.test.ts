import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './apiClient';

globalThis.fetch = vi.fn();

describe('apiClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns parsed JSON on successful request', async () => {
        const mockData = { id: 1, status: 'AVAILABLE' };

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue(JSON.stringify(mockData))
        });

        const result = await apiClient('/vehicles');

        expect(result).toEqual(mockData);
        expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8080/api/vehicles', expect.objectContaining({
            headers: { 'Content-Type': 'application/json' }
        }));
    });

    it('returns null when server responds with 204 No Content', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            status: 204
        });

        const result = await apiClient('/vehicles/1', { method: 'DELETE' });

        expect(result).toBeNull();
    });

    it('throws error with extracted message when server responds with an error', async () => {
        const errorData = { message: 'Business Validation Failed' };

        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            status: 400,
            json: vi.fn().mockResolvedValue(errorData)
        });

        await expect(apiClient('/orders', { method: 'POST' })).rejects.toThrow('Business Validation Failed');
    });

    it('throws generic error when server error response lacks message property', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            status: 500,
            json: vi.fn().mockRejectedValue(new Error('JSON Parse Error')),
            text: vi.fn().mockResolvedValue('Internal Server Error Text')
        });

        await expect(apiClient('/locations')).rejects.toThrow('Internal Server Error Text');
    });
});