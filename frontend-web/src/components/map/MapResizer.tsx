import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useSimulation } from '../../context/SimulationContext';

export default function MapResizer() {
    const map = useMap();
    const { setMapViewState } = useSimulation();

    useEffect(() => {
        const container = map.getContainer();

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(container);

        setTimeout(() => map.invalidateSize(), 50);

        const handleMoveEnd = () => {
            const center = map.getCenter();
            const zoom = map.getZoom();
            setMapViewState([center.lat, center.lng], zoom);
        };

        map.on('moveend', handleMoveEnd);
        map.on('zoomend', handleMoveEnd);

        return () => {
            resizeObserver.disconnect();
            map.off('moveend', handleMoveEnd);
            map.off('zoomend', handleMoveEnd);
        };
    }, [map, setMapViewState]);

    return null;
}