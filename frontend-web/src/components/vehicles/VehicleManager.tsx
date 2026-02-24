import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Edit2, X, User, Map as MapIcon } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import CoordinatePickerMap from '../locations/CoordinatePickerMap';

interface VehicleDB {
    id: number; plateNumber: string; brand: string; model: string;
    baseFuelConsumption: number; fuelCapacity: number; status: string;
    currentLat: number; currentLng: number;
    driverName?: string;
}

export default function VehicleManager() {
    const { refreshVehicles } = useSimulation();
    const [vehicles, setVehicles] = useState<VehicleDB[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [isPickerMapOpen, setIsPickerMapOpen] = useState(false);

    const [plate, setPlate] = useState('');
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [consumption, setConsumption] = useState(25);
    const [capacity, setCapacity] = useState(600);
    const [lat, setLat] = useState(52.2297);
    const [lng, setLng] = useState(21.0122);

    const loadVehicles = async () => {
        const [vehRes, drvRes] = await Promise.all([
            fetch('http://localhost:8080/api/vehicles'),
            fetch('http://localhost:8080/api/drivers')
        ]);

        const vehiclesData = await vehRes.json();
        const driversData = await drvRes.json();

        const driverMap = new Map();
        driversData.forEach((d: any) => {
            if (d.assignedVehicle) {
                driverMap.set(d.assignedVehicle.id, `${d.firstName} ${d.lastName}`);
            }
        });

        const mergedVehicles = vehiclesData.map((v: any) => ({
            ...v,
            driverName: driverMap.get(v.id) || null
        }));

        setVehicles(mergedVehicles);
    };

    useEffect(() => { loadVehicles(); }, []);

    const resetForm = () => {
        setPlate(''); setBrand(''); setModel(''); setConsumption(25); setCapacity(600); setLat(52.2297); setLng(21.0122);
        setEditingId(null);
        setIsFormOpen(false);
        setIsPickerMapOpen(false);
    };

    const handleEditClick = (v: VehicleDB) => {
        setPlate(v.plateNumber); setBrand(v.brand); setModel(v.model);
        setConsumption(v.baseFuelConsumption); setCapacity(v.fuelCapacity);
        setLat(v.currentLat); setLng(v.currentLng);
        setEditingId(v.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć ten pojazd?')) return;
        const res = await fetch(`http://localhost:8080/api/vehicles/${id}`, { method: 'DELETE' });
        if (res.ok) { await loadVehicles(); await refreshVehicles(); }
        else alert('Nie można usunąć pojazdu. Prawdopodobnie jest w trasie.');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { plateNumber: plate, brand, model, baseFuelConsumption: consumption, fuelCapacity: capacity, currentLat: lat, currentLng: lng };

        const url = editingId ? `http://localhost:8080/api/vehicles/${editingId}` : 'http://localhost:8080/api/vehicles';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });

        if (res.ok) {
            resetForm();
            await loadVehicles();
            await refreshVehicles();
        }
    };

    const handleLocationPicked = (pickedLat: number, pickedLng: number) => {
        setLat(pickedLat);
        setLng(pickedLng);
        setIsPickerMapOpen(false);
    };

    return (
        <div className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200 relative">

            {/* Nakładka wyboru z mapy */}
            {isPickerMapOpen && (
                <CoordinatePickerMap
                    initialLat={lat}
                    initialLng={lng}
                    onSave={handleLocationPicked}
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
                <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-4 border-l-4 border-l-cyan-400">
                    <h2 className="md:col-span-3 text-lg font-bold text-white mb-2">{editingId ? 'Edytuj Pojazd' : 'Nowy Pojazd'}</h2>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Rejestracja</label><input required value={plate} onChange={e => setPlate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Marka</label><input required value={brand} onChange={e => setBrand(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Model</label><input required value={model} onChange={e => setModel(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Spalanie (L/100km)</label><input type="number" required value={consumption} onChange={e => setConsumption(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Pojemność Baku (L)</label><input type="number" required value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>

                    {/* ZMODYFIKOWANA SEKCJA LAT/LNG */}
                    <div className="flex gap-2 items-end md:col-span-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Start Lat</label>
                            <input type="number" step="0.000001" required value={lat} onChange={e => setLat(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" disabled={!!editingId} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Start Lng</label>
                            <input type="number" step="0.000001" required value={lng} onChange={e => setLng(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" disabled={!!editingId} />
                        </div>
                        {/* PRZYCISK "WYBIERZ Z MAPY" */}
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

                    <div className="md:col-span-3 flex justify-end mt-2">
                        <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                            {editingId ? 'Zapisz Zmiany' : 'Dodaj Pojazd'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Rejestracja</th>
                        <th className="p-4 border-b border-slate-700">Pojazd</th>
                        <th className="p-4 border-b border-slate-700">Kierowca</th>
                        <th className="p-4 border-b border-slate-700">Status</th>
                        <th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {vehicles.map(v => (
                        <tr key={v.id} className="hover:bg-slate-700/50 border-b border-slate-700/50">
                            <td className="p-4 font-bold text-white">{v.plateNumber}</td>
                            <td className="p-4">{v.brand} {v.model}</td>
                            <td className="p-4">
                                {v.driverName ? (
                                    <span className="flex items-center gap-2 text-slate-300">
                                            <User size={14} className="text-slate-500" />
                                        {v.driverName}
                                        </span>
                                ) : (
                                    <span className="text-slate-500 italic">Brak kierowcy</span>
                                )}
                            </td>
                            <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${v.status === 'BUSY' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                        {v.status === 'BUSY' ? 'W trasie' : 'Dostępny'}
                                    </span>
                            </td>
                            <td className="p-4 flex justify-end gap-2">
                                <button onClick={() => handleEditClick(v)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition" title="Edytuj"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(v.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition" title="Usuń"><Trash2 size={18} /></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}