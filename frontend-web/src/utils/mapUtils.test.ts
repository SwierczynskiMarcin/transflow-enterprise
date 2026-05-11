import { describe, it, expect } from 'vitest';
import { calculateDistance } from './mapUtils';

describe('mapUtils - calculateDistance', () => {
    it('returns 0 for identical coordinates', () => {
        const distance = calculateDistance(52.2297, 21.0122, 52.2297, 21.0122);
        expect(distance).toBe(0);
    });

    it('calculates distance accurately between two distinct points', () => {
        const distance = calculateDistance(52.2297, 21.0122, 50.0647, 19.9450);

        expect(distance).toBeGreaterThan(240);
        expect(distance).toBeLessThan(260);
    });

    it('handles negative coordinates correctly', () => {
        const distance = calculateDistance(-34.6037, -58.3816, -22.9068, -43.1729);

        expect(distance).toBeGreaterThan(1900);
        expect(distance).toBeLessThan(2000);
    });
});