import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderBuilder from './OrderBuilder'
import { SimulationProvider } from '../../../context/SimulationContext'
import { ToastProvider } from '../../../context/ToastContext'

vi.mock('../../../api/logisticsApi', () => ({
    createOrder: vi.fn(() => Promise.resolve({}))
}))

const mockStartLoc = {
    id: 10,
    name: 'Warsaw Hub',
    latitude: 52.2,
    longitude: 21.0
}

let contextMock = {
    isBuilderOpen: true,
    startLoc: null as any,
    endLoc: null as any,
    selectedTruckId: '' as any,
    setPreviewRoute1: vi.fn(),
    setPreviewRoute2: vi.fn(),
    setPreviewPoly1Str: vi.fn(),
    setPreviewPoly2Str: vi.fn(),
    setPreviewDist1: vi.fn(),
    setPreviewDist2: vi.fn()
}

vi.mock('../MapContext', () => ({
    useMapContext: () => contextMock,
    MapProvider: ({ children }: any) => <div>{children}</div>
}))

describe('OrderBuilder Component', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                routes: [{ geometry: 'encoded_poly', distance: 1000 }]
            })
        })
    })

    it('shows placeholders when no locations are selected', () => {
        contextMock.startLoc = null
        contextMock.endLoc = null
        contextMock.selectedTruckId = ''

        render(
            <ToastProvider>
                <SimulationProvider>
                    <OrderBuilder />
                </SimulationProvider>
            </ToastProvider>
        )

        const placeholders = screen.getAllByText(/Wybierz z mapy/i)
        expect(placeholders.length).toBeGreaterThanOrEqual(2)
    })

    it('validates that point A and B must be different', () => {
        contextMock.startLoc = mockStartLoc
        contextMock.endLoc = mockStartLoc
        contextMock.selectedTruckId = 1

        render(
            <ToastProvider>
                <SimulationProvider>
                    <OrderBuilder />
                </SimulationProvider>
            </ToastProvider>
        )

        expect(screen.getByText(/Punkt B musi być inny niż Punkt A/i)).toBeInTheDocument()

        const submitButton = screen.getByRole('button', { name: /Punkt A i B muszą być różne/i })
        expect(submitButton).toBeDisabled()
    })
})