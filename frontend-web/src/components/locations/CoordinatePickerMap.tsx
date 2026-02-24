import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Check, X } from 'lucide-react';

const pulsingRedIcon = L.divIcon({
    className: 'bg-transparent border-none',
    html: `<div class="relative flex items-center justify-center w-8 h-8">
             <div class="absolute w-full h-full bg-rose-500 rounded-full animate-ping opacity-75"></div>
             <div class="relative w-4 h-4 bg-rose-600 rounded-full border-2 border-white shadow-lg"></div>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const MapClickHandler = ({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) => {
    useMapEvents({
        click(e) {
            onLocationSelected(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

interface Props {
    initialLat: number;
    initialLng: number;
    onSave: (lat: number, lng: number) => void;
    onCancel: () => void;
}

export default function CoordinatePickerMap({ initialLat, initialLng, onSave, onCancel }: Props) {
    const [selectedLatLng, setSelectedLatLng] = useState<[number, number] | null>(null);

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex">
            {/* Lewa strona: Mapa */}
            <div className="flex-1 relative">
                <MapContainer
                    center={[initialLat, initialLng]}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <MapClickHandler onLocationSelected={(lat, lng) => setSelectedLatLng([lat, lng])} />

                    {/* Jeśli użytkownik kliknął, pokaż pulsujący marker */}
                    {selectedLatLng && (
                        <Marker position={selectedLatLng} icon={pulsingRedIcon} />
                    )}
                </MapContainer>
            </div>

            {/* Prawa strona: Panel operacyjny */}
            <div className="w-80 bg-slate-900 border-l border-slate-700 p-6 flex flex-col shadow-2xl z-[10000]">
                <h2 className="text-xl font-bold text-white mb-4">Wybierz punkt</h2>
                <p className="text-slate-400 text-sm mb-6">
                    Kliknij w dowolne miejsce na mapie, aby ustawić dokładne współrzędne dla tej lokalizacji.
                </p>

                {selectedLatLng ? (
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 shadow-inner">
                        <div className="text-xs text-slate-500 uppercase mb-2 font-bold tracking-wider">Wybrane współrzędne:</div>
                        <div className="flex flex-col gap-1">
                            <div className="font-mono text-rose-400 font-bold bg-slate-900 p-2 rounded-lg border border-slate-700">Lat: {selectedLatLng[0].toFixed(6)}</div>
                            <div className="font-mono text-rose-400 font-bold bg-slate-900 p-2 rounded-lg border border-slate-700">Lng: {selectedLatLng[1].toFixed(6)}</div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 border-dashed mb-6 text-center text-slate-500 text-sm py-8">
                        Czekam na kliknięcie...
                    </div>
                )}

                <div className="mt-auto flex flex-col gap-3">
                    <button
                        onClick={() => selectedLatLng && onSave(selectedLatLng[0], selectedLatLng[1])}
                        disabled={!selectedLatLng}
                        className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
                            selectedLatLng
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        }`}
                    >
                        <Check size={20} /> Zapisz punkt
                    </button>
                    <button
                        onClick={onCancel}
                        className="py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white transition border border-slate-700"
                    >
                        <X size={20} /> Anuluj
                    </button>
                </div>
            </div>
        </div>
    );
}