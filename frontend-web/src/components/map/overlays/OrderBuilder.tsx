import { useState, useEffect, useCallback } from 'react';
import { X, Route as RouteIcon, MapPin, Flag, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useSimulation, decodePolyline } from '../../../context/SimulationContext';
import { useMapContext } from '../MapContext';
import { calculateDistance } from '../../../utils/mapUtils';
import { createOrder } from '../../../api/logisticsApi';
import { useToast } from '../../../context/ToastContext';

export default function OrderBuilder() {
    const { trucks } = useSimulation();
    const { showToast } = useToast();
    const {
        isBuilderOpen, setIsBuilderOpen,
        startLoc, setStartLoc,
        endLoc, setEndLoc,
        selectedTruckId, setSelectedTruckId,
        setPreviewRoute1, setPreviewRoute2,
        previewPoly1Str, setPreviewPoly1Str,
        previewPoly2Str, setPreviewPoly2Str,
        previewDist1, setPreviewDist1,
        previewDist2, setPreviewDist2
    } = useMapContext();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingRoute, setIsFetchingRoute] = useState(false);
    const [routeFetchError, setRouteFetchError] = useState(false);
    const [retryToken, setRetryToken] = useState(0);

    const availableTrucks = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE');
    const selectedTruckData = selectedTruckId ? availableTrucks.find(t => t.id === selectedTruckId) : null;
    const selectedDistance = selectedTruckData && startLoc
        ? calculateDistance(startLoc.latitude, startLoc.longitude, selectedTruckData.currentLat, selectedTruckData.currentLng)
        : 0;
    const hasAssignedDriver = selectedTruckData?.driverName && selectedTruckData.driverName !== 'Brak przypisania';
    const isSameLocation = !!(startLoc && endLoc && startLoc.id === endLoc.id);

    useEffect(() => {
        if (!isBuilderOpen || !selectedTruckId) return;
        const selectedId = Number(selectedTruckId);
        const truckInFleet = Array.from(trucks.values()).find(t => t.id === selectedId);
        if (truckInFleet && truckInFleet.status !== 'AVAILABLE') {
            showToast(`Pojazd ${truckInFleet.plateNumber} stał się niedostępny. Proszę wybrać inny pojazd.`, 'error');
            setSelectedTruckId('');
        }
    }, [trucks, selectedTruckId, isBuilderOpen, showToast, setSelectedTruckId]);

    const startLocId = startLoc?.id;
    const endLocId = endLoc?.id;
    const selectedTruckIdStr = selectedTruckId.toString();

    const clearRoutePreviews = useCallback(() => {
        setPreviewRoute1([]);
        setPreviewRoute2([]);
        setPreviewPoly1Str("");
        setPreviewPoly2Str("");
        setPreviewDist1(0);
        setPreviewDist2(0);
    }, [setPreviewRoute1, setPreviewRoute2, setPreviewPoly1Str, setPreviewPoly2Str, setPreviewDist1, setPreviewDist2]);

    useEffect(() => {
        if (startLocId && endLocId && selectedTruckIdStr && !isSameLocation) {
            const truck = Array.from(trucks.values()).find(t => t.id.toString() === selectedTruckIdStr);
            if (!truck) return;

            const abortController = new AbortController();
            setIsFetchingRoute(true);
            setRouteFetchError(false);
            clearRoutePreviews();

            const fetchPreviews = async () => {
                try {
                    const r1 = await fetch(
                        `https://router.project-osrm.org/route/v1/driving/${truck.currentLng},${truck.currentLat};${startLoc!.longitude},${startLoc!.latitude}?overview=full&geometries=polyline`,
                        { signal: abortController.signal }
                    );
                    const d1 = await r1.json();
                    if (d1.routes?.[0]) {
                        setPreviewPoly1Str(d1.routes[0].geometry);
                        setPreviewDist1(d1.routes[0].distance);
                        setPreviewRoute1(decodePolyline(d1.routes[0].geometry));
                    } else {
                        throw new Error('Brak trasy A');
                    }

                    const r2 = await fetch(
                        `https://router.project-osrm.org/route/v1/driving/${startLoc!.longitude},${startLoc!.latitude};${endLoc!.longitude},${endLoc!.latitude}?overview=full&geometries=polyline`,
                        { signal: abortController.signal }
                    );
                    const d2 = await r2.json();
                    if (d2.routes?.[0]) {
                        setPreviewPoly2Str(d2.routes[0].geometry);
                        setPreviewDist2(d2.routes[0].distance);
                        setPreviewRoute2(decodePolyline(d2.routes[0].geometry));
                    } else {
                        throw new Error('Brak trasy B');
                    }
                } catch (e: any) {
                    if (e.name !== 'AbortError') {
                        setRouteFetchError(true);
                        setIsFetchingRoute(false);
                    }
                } finally {
                    if (!abortController.signal.aborted) setIsFetchingRoute(false);
                }
            };
            fetchPreviews();

            return () => abortController.abort();
        } else {
            clearRoutePreviews();
            setIsFetchingRoute(false);
            setRouteFetchError(false);
        }
    }, [startLocId, endLocId, selectedTruckIdStr, isSameLocation, retryToken]);

    const handleRetryRoute = () => {
        setRouteFetchError(false);
        setRetryToken(t => t + 1);
    };

    const handleCancelOrder = () => {
        setIsBuilderOpen(false);
        setStartLoc(null);
        setEndLoc(null);
        setSelectedTruckId('');
        clearRoutePreviews();
        setIsFetchingRoute(false);
        setRouteFetchError(false);
    };

    const handleConfirmOrder = async () => {
        if (!startLoc || !endLoc || !selectedTruckId || isFetchingRoute || !previewPoly1Str || !previewPoly2Str || !hasAssignedDriver || isSameLocation) return;
        setIsSubmitting(true);

        try {
            await createOrder({
                vehicleId: selectedTruckId,
                startLocationId: startLoc.id,
                endLocationId: endLoc.id,
                routePolylineApproaching: previewPoly1Str,
                routeDistanceApproaching: previewDist1,
                routePolylineTransit: previewPoly2Str,
                routeDistanceTransit: previewDist2
            });
            handleCancelOrder();
            showToast('Zlecenie zostało pomyślnie wygenerowane.', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const routeReady = previewPoly1Str && previewPoly2Str;
    const isReadyToSubmit = startLoc && endLoc && selectedTruckId && !isSubmitting && !isFetchingRoute && routeReady && hasAssignedDriver && !isSameLocation;

    if (!isBuilderOpen) return null;

    const resolveButtonContent = () => {
        if (isSubmitting) return <><Loader2 size={18} className="animate-spin" /> Wysyłanie...</>;
        if (isFetchingRoute) return <><Loader2 size={18} className="animate-spin text-cyan-500" /> Wyznaczanie trasy...</>;
        if (!startLoc || !endLoc || !selectedTruckId) return 'Uzupełnij dane zlecenia';
        if (isSameLocation) return 'Punkt A i B muszą być różne';
        if (!hasAssignedDriver) return 'Zablokowane (Brak Kadry)';
        if (routeReady) return 'Potwierdź Zlecenie';
        return 'Błąd wyznaczania trasy';
    };

    return (
        <div className="absolute top-6 left-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-white font-semibold flex items-center gap-2">
                    <RouteIcon size={18} className="text-emerald-400" /> Kreator Zlecenia
                </h2>
                <button onClick={handleCancelOrder} className="text-slate-400 hover:text-rose-400 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
                <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 relative shadow-inner">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt A (Załadunek)</span>
                    {startLoc
                        ? <span className="text-emerald-400 font-medium text-sm flex items-center gap-2"><MapPin size={16} /> {startLoc.name}</span>
                        : <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>
                    }
                </div>

                <div className={`bg-slate-800/80 rounded-lg p-3 border relative shadow-inner ${isSameLocation ? 'border-amber-500/50' : 'border-slate-700'}`}>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Punkt B (Rozładunek)</span>
                    {endLoc
                        ? <span className="text-rose-400 font-medium text-sm flex items-center gap-2"><Flag size={16} /> {endLoc.name}</span>
                        : <span className="text-slate-500 text-sm animate-pulse">Wybierz z mapy...</span>
                    }
                    {isSameLocation && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
                            <span className="text-[10px] text-amber-300">Punkt B musi być inny niż Punkt A.</span>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 mt-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Przypisany pojazd</span>
                    {!startLoc ? (
                        <span className="text-xs text-slate-500">Wybierz Punkt A, aby wyszukać auta.</span>
                    ) : selectedTruckData ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-600 shadow-inner">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-bold text-white">{selectedTruckData.plateNumber}</span>
                                    <span className="text-xs text-slate-400">{selectedTruckData.brand}</span>
                                </div>
                                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">{selectedDistance.toFixed(0)} km stąd</span>
                            </div>
                            <select
                                value={selectedTruckId}
                                onChange={(e) => setSelectedTruckId(Number(e.target.value))}
                                className="w-full text-xs p-1.5 border border-slate-700 rounded bg-slate-800 text-slate-300 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="" disabled>Zmień pojazd...</option>
                                {availableTrucks.map(t => {
                                    const dist = calculateDistance(startLoc.latitude, startLoc.longitude, t.currentLat, t.currentLng);
                                    return <option key={t.id} value={t.id}>{t.plateNumber} ({dist.toFixed(0)} km stąd)</option>;
                                })}
                            </select>
                            {!hasAssignedDriver && (
                                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 p-2 rounded mt-2">
                                    <AlertTriangle size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[10px] text-rose-300 leading-tight">Brak kierowcy. Pojazd jest niedostępny operacyjnie.</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-rose-500 font-medium">Brak wolnych pojazdów w systemie.</span>
                    )}
                </div>

                {routeFetchError && !isFetchingRoute && (
                    <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2">
                        <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
                        <span className="text-[10px] text-rose-300 flex-1 leading-tight">
                            Nie udało się wyznaczyć trasy. Sprawdź połączenie i spróbuj ponownie.
                        </span>
                        <button
                            onClick={handleRetryRoute}
                            className="flex-shrink-0 flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-bold px-2 py-1 rounded transition-colors"
                        >
                            <RefreshCw size={10} /> Retry
                        </button>
                    </div>
                )}

                <button
                    onClick={handleConfirmOrder}
                    disabled={!isReadyToSubmit}
                    className={`w-full py-3 rounded-lg font-bold mt-2 transition-all flex items-center justify-center gap-2 ${
                        isReadyToSubmit
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {resolveButtonContent()}
                </button>
            </div>
        </div>
    );
}