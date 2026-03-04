import { createContext, useContext, useState, type FC, type ReactNode } from 'react';
import type { LocationData } from '../../context/SimulationContext';

interface MapContextProps {
    isBuilderOpen: boolean;
    setIsBuilderOpen: (open: boolean) => void;
    startLoc: LocationData | null;
    setStartLoc: (loc: LocationData | null) => void;
    endLoc: LocationData | null;
    setEndLoc: (loc: LocationData | null) => void;

    selectedTruckId: number | '';
    setSelectedTruckId: (id: number | '') => void;

    selectedRouteVehicleId: number | null;
    setSelectedRouteVehicleId: (id: number | null) => void;
    hoveredVehicleId: number | null;
    setHoveredVehicleId: (id: number | null) => void;

    selectedLocationId: number | null;
    setSelectedLocationId: (id: number | null) => void;
    hoveredLocationId: number | null;
    setHoveredLocationId: (id: number | null) => void;

    previewRoute1: [number, number][];
    setPreviewRoute1: (route: [number, number][]) => void;
    previewRoute2:[number, number][];
    setPreviewRoute2: (route: [number, number][]) => void;
    previewPoly1Str: string;
    setPreviewPoly1Str: (poly: string) => void;
    previewPoly2Str: string;
    setPreviewPoly2Str: (poly: string) => void;
    previewDist1: number;
    setPreviewDist1: (dist: number) => void;
    previewDist2: number;
    setPreviewDist2: (dist: number) => void;
}

const MapContext = createContext<MapContextProps | undefined>(undefined);

export const MapProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [startLoc, setStartLoc] = useState<LocationData | null>(null);
    const[endLoc, setEndLoc] = useState<LocationData | null>(null);

    const [selectedTruckId, setSelectedTruckId] = useState<number | ''>('');
    const [selectedRouteVehicleId, setSelectedRouteVehicleId] = useState<number | null>(null);
    const [hoveredVehicleId, setHoveredVehicleId] = useState<number | null>(null);

    const[selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const[hoveredLocationId, setHoveredLocationId] = useState<number | null>(null);

    const[previewRoute1, setPreviewRoute1] = useState<[number, number][]>([]);
    const [previewRoute2, setPreviewRoute2] = useState<[number, number][]>([]);
    const [previewPoly1Str, setPreviewPoly1Str] = useState("");
    const[previewPoly2Str, setPreviewPoly2Str] = useState("");
    const[previewDist1, setPreviewDist1] = useState(0);
    const [previewDist2, setPreviewDist2] = useState(0);

    return (
        <MapContext.Provider value={{
            isBuilderOpen, setIsBuilderOpen,
            startLoc, setStartLoc,
            endLoc, setEndLoc,
            selectedTruckId, setSelectedTruckId,
            selectedRouteVehicleId, setSelectedRouteVehicleId,
            hoveredVehicleId, setHoveredVehicleId,
            selectedLocationId, setSelectedLocationId,
            hoveredLocationId, setHoveredLocationId,
            previewRoute1, setPreviewRoute1,
            previewRoute2, setPreviewRoute2,
            previewPoly1Str, setPreviewPoly1Str,
            previewPoly2Str, setPreviewPoly2Str,
            previewDist1, setPreviewDist1,
            previewDist2, setPreviewDist2
        }}>
            {children}
        </MapContext.Provider>
    );
};

export const useMapContext = () => {
    const context = useContext(MapContext);
    if (!context) throw new Error("useMapContext must be used within a MapProvider");
    return context;
};