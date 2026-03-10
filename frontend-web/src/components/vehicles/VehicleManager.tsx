import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Truck, Plus, Trash2, Edit2, X, User, Map as MapIcon, MapPin, AlertTriangle, Wrench } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import CoordinatePickerMap from '../locations/CoordinatePickerMap';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle } from '../../api/fleetApi';
import { calculateDistance } from '../../utils/mapUtils';
import { useToast } from '../../context/ToastContext';

export default function VehicleManager() {
    const { trucks, locations, orders } = useSimulation();
    const { showToast } = useToast();
    const[vehiclesData, setVehiclesData] = useState<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const[isFormOpen, setIsFormOpen] = useState(false);
    const[editingId, setEditingId] = useState<number | null>(null);
    const[isPickerMapOpen, setIsPickerMapOpen] = useState(false);

    const [version, setVersion] = useState<number>(0);
    const[plate, setPlate] = useState('');
    const[brand, setBrand] = useState('');
    const[model, setModel] = useState('');
    const[consumption, setConsumption] = useState(25);
    const [capacity, setCapacity] = useState(600);
    const[lat, setLat] = useState(52.2297);
    const[lng, setLng] = useState(21.0122);
    const[isMSU, setIsMSU] = useState(false);

    useEffect(() => {
        const fetchDBData = async () => {
            try {
                const data = await getVehicles();
                setVehiclesData(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchDBData();
    }, [trucks]);

    const sortedVehicles = useMemo(() => {
        return [...vehiclesData].sort((a, b) => {
            const liveA = trucks.get(a.id);
            const liveB = trucks.get(b.id);
            const statusA = liveA ? liveA.status : a.status;
            const statusB = liveB ? liveB.status : b.status;

            if (statusA === 'BROKEN' && statusB !== 'BROKEN') return -1;
            if (statusA !== 'BROKEN' && statusB === 'BROKEN') return 1;

            if (statusA === 'BUSY' && statusB !== 'BUSY') return -1;
            if (statusA !== 'BUSY' && statusB === 'BUSY') return 1;

            return a.plateNumber.localeCompare(b.plateNumber);
        });
    }, [vehiclesData, trucks]);

    const resetForm = () => {
        setVersion(0); setPlate(''); setBrand(''); setModel(''); setConsumption(25); setCapacity(600); setLat(52.2297); setLng(21.0122); setIsMSU(false);
        setEditingId(null);
        setIsFormOpen(false);
        setIsPickerMapOpen(false);
    };

    const handleEditClick = (v: any) => {
        setVersion(v.version || 0);
        setPlate(v.plateNumber); setBrand(v.brand); setModel(v.model);
        setConsumption(v.baseFuelConsumption); setCapacity(v.fuelCapacity);
        setLat(v.currentLat); setLng(v.currentLng); setIsMSU(v.isServiceUnit);
        setEditingId(v.id);
        setIsFormOpen(true);
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć ten pojazd?')) return;
        try {
            await deleteVehicle(id);
            showToast('Pojazd został usunięty z floty', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { version, plateNumber: plate, brand, model, baseFuelConsumption: consumption, fuelCapacity: capacity, currentLat: lat, currentLng: lng, isServiceUnit: isMSU };

        try {
            if (editingId) {
                await updateVehicle(editingId, payload);
                showToast('Dane pojazdu zostały zaktualizowane', 'success');
            } else {
                await addVehicle(payload);
                showToast('Nowy pojazd został dodany do floty', 'success');
            }
            resetForm();
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const resolveCurrentLocationText = (vehicleId: number) => {
        const liveTruck = trucks.get(vehicleId);
        if (!liveTruck) return <span className="text-slate-500 italic">Ładowanie...</span>;

        if (liveTruck.status === 'BROKEN') {
            return (
                <span className="flex items-center gap-1 text-rose-400 font-bold animate-pulse">
                    <AlertTriangle size={14} /> AWARIA NA TRASIE
                </span>
            );
        }

        if (liveTruck.status === 'WAITING_FOR_TOW') {
            return (
                <span className="flex items-center gap-1 text-slate-400 font-bold border border-slate-600 px-2 py-0.5 rounded text-xs">
                    WRAK (OCZEKUJE NA MSU)
                </span>
            );
        }

        if (liveTruck.status === 'BEING_TOWED') {
            return (
                <span className="flex items-center gap-1 text-slate-500 font-bold">
                    HOLOWANY DO BAZY
                </span>
            );
        }

        if (liveTruck.status === 'WAITING_FOR_CARGO_CLEARANCE') {
            return (
                <span className="flex items-center gap-1 text-sky-400 font-bold animate-pulse">
                    <Wrench size={14} /> PRZYGOTOWANIE DO HOLOWANIA
                </span>
            );
        }

        if (liveTruck.status === 'HANDOVER') {
            return (
                <span className="flex items-center gap-1 text-fuchsia-400 font-bold animate-pulse">
                    POSTÓJ OPERACYJNY NA TRASIE
                </span>
            );
        }

        if (liveTruck.status === 'RESCUE_MISSION') {
            return (
                <span className="flex items-center gap-1 text-indigo-400 font-bold">
                    <Truck size={14} /> W DRODZE PO ŁADUNEK Z WRAKA
                </span>
            );
        }

        if (liveTruck.status === 'TOW_APPROACHING') {
            return (
                <span className="flex items-center gap-1 text-orange-400 font-bold">
                    <Wrench size={14} /> MSU ZMIERZA DO WRAKA
                </span>
            );
        }

        if (liveTruck.status === 'TOWING') {
            return (
                <span className="flex items-center gap-1 text-orange-500 font-bold">
                    <Wrench size={14} /> MSU HOLUJE WRAK
                </span>
            );
        }

        if (liveTruck.status === 'BUSY') {
            const activeOrder = orders.find(o => o.vehicle && o.vehicle.id === vehicleId &&['APPROACHING', 'LOADING', 'IN_TRANSIT'].includes(o.status));
            if (activeOrder) {
                return (
                    <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <Truck size={14} /> W trasie do: {activeOrder.endLocation.name}
                    </span>
                );
            }
            return <span className="text-cyan-400">W trasie</span>;
        } else {
            let closestLoc = null;
            let minD = Infinity;
            for (const loc of locations) {
                const d = calculateDistance(liveTruck.currentLat, liveTruck.currentLng, loc.latitude, loc.longitude);
                if (d < 0.5 && d < minD) {
                    minD = d;
                    closestLoc = loc;
                }
            }
            if (closestLoc) {
                return (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <MapPin size={14} /> Na bazie: {closestLoc.name}
                    </span>
                );
            }
            return <span className="text-slate-400">Oczekuje na przypisanie</span>;
        }
    };

    const isEditingBusy = editingId ? (trucks.get(editingId)?.status !== 'AVAILABLE') : false;

    return (
        <div ref={containerRef} className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200 relative">

            {isPickerMapOpen && (
                <CoordinatePickerMap
                    initialLat={lat}
                    initialLng={lng}
                    onSave={(pLat, pLng) => { setLat(pLat); setLng(pLng); setIsPickerMapOpen(false); }}
                    onCancel={() => setIsPickerMapOpen(false)}
                />
            )}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Truck className="text-cyan-400" size={32} /> Zarządzanie Flotą</h1>
                </div>
                <button onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition">
                    {isFormOpen ? <X size={20} /> : <Plus size={20} />} {isFormOpen ? 'Anuluj' : 'Dodaj Pojazd'}
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className={`p-6 rounded-2xl border mb-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4 border-l-4 ${isEditingBusy ? 'bg-slate-800/50 border-amber-500/50 border-l-amber-500' : 'bg-slate-800 border-slate-700 border-l-cyan-400'}`}>
                    <div className="md:col-span-3 flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-white">{editingId ? 'Edytuj Pojazd' : 'Nowy Pojazd'}</h2>
                        {isEditingBusy && (
                            <span className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                <AlertTriangle size={14} /> Edycja zablokowana - pojazd w trakcie operacji
                            </span>
                        )}
                    </div>

                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Rejestracja</label><input disabled={isEditingBusy} required value={plate} onChange={e => setPlate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Marka</label><input disabled={isEditingBusy} required value={brand} onChange={e => setBrand(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Model</label><input disabled={isEditingBusy} required value={model} onChange={e => setModel(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Spalanie (L/100km)</label><input disabled={isEditingBusy} type="number" required value={consumption} onChange={e => setConsumption(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Pojemność Baku (L)</label><input disabled={isEditingBusy} type="number" required value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="msuCheck" disabled={isEditingBusy} checked={isMSU} onChange={e => setIsMSU(e.target.checked)} className="w-5 h-5 accent-orange-500 cursor-pointer disabled:cursor-not-allowed" />
                        <label htmlFor="msuCheck" className="text-sm font-bold text-orange-400 uppercase tracking-wide cursor-pointer flex items-center gap-2">
                            <Wrench size={16} /> Mobilna Jednostka Serwisowa (MSU)
                        </label>
                    </div>

                    <div className={`flex gap-2 items-end md:col-span-3 p-3 rounded-xl border ${isEditingBusy ? 'bg-slate-900/30 border-slate-700/50' : 'bg-slate-900/50 border-slate-700'}`}>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Start Lat</label>
                            <input type="number" step="0.000001" required value={lat} onChange={e => setLat(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!!editingId} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Start Lng</label>
                            <input type="number" step="0.000001" required value={lng} onChange={e => setLng(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!!editingId} />
                        </div>
                        {!editingId && (
                            <button
                                type="button"
                                onClick={() => setIsPickerMapOpen(true)}
                                className="bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-900 border border-cyan-500/50 px-4 py-2 rounded-lg transition flex items-center gap-2 h-[42px]"
                                title="Kliknij pozycję na mapie"
                            >
                                <MapIcon size={18} />
                                <span className="text-sm font-bold whitespace-nowrap">Wybierz z mapy</span>
                            </button>
                        )}
                    </div>

                    {!isEditingBusy && (
                        <div className="md:col-span-3 flex justify-end mt-2">
                            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                                {editingId ? 'Zapisz Zmiany' : 'Dodaj Pojazd'}
                            </button>
                        </div>
                    )}
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Rejestracja</th>
                        <th className="p-4 border-b border-slate-700">Pojazd</th>
                        <th className="p-4 border-b border-slate-700">Kierowca</th>
                        <th className="p-4 border-b border-slate-700">Aktualne Położenie</th>
                        <th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedVehicles.map(v => {
                        const liveData = trucks.get(v.id);
                        return (
                            <tr key={v.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 transition-colors duration-300">
                                <td className="p-4 font-bold text-white flex items-center gap-2">
                                    {v.plateNumber}
                                    {v.isServiceUnit && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">MSU</span>}
                                </td>
                                <td className="p-4">{v.brand} {v.model}</td>
                                <td className="p-4">
                                    {liveData && liveData.status !== 'WAITING_FOR_TOW' && liveData.status !== 'BEING_TOWED' && liveData.driverName && liveData.driverName !== 'Brak przypisania' ? (
                                        <span className="flex items-center gap-2 text-slate-300">
                                            <User size={14} className="text-slate-500" />
                                            {liveData.driverName}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 italic">Zjechał / Brak</span>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    {resolveCurrentLocationText(v.id)}
                                </td>
                                <td className="p-4 flex justify-end gap-2">
                                    <button onClick={() => handleEditClick(v)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition" title="Edytuj"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(v.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition" title="Usuń"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}