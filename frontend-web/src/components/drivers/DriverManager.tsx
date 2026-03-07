import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Plus, Trash2, Edit2, X, AlertTriangle, Truck, MapPin } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { getDrivers, addDriver, updateDriver, deleteDriver, getVehicles } from '../../api/fleetApi';
import { useToast } from '../../context/ToastContext';
import { calculateDistance } from '../../utils/mapUtils';

interface DriverDB { id: number; version?: number; firstName: string; lastName: string; phoneNumber: string; status: string; assignedVehicle?: { id: number; plateNumber: string; brand: string; }; }
interface VehicleDB { id: number; plateNumber: string; brand: string; }

export default function DriverManager() {
    const { refreshVehicles, trucks, locations, orders } = useSimulation();
    const { showToast } = useToast();
    const[drivers, setDrivers] = useState<DriverDB[]>([]);
    const [vehicles, setVehicles] = useState<VehicleDB[]>([]);
    const[isFormOpen, setIsFormOpen] = useState(false);
    const[editingId, setEditingId] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const[version, setVersion] = useState<number>(0);
    const[firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const[phone, setPhone] = useState('');
    const[selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    const loadData = async () => {
        try {
            const[drvRes, vehRes] = await Promise.all([getDrivers(), getVehicles()]);
            setDrivers(drvRes);
            setVehicles(vehRes);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { loadData(); },[]);

    const sortedDrivers = useMemo(() => {
        return [...drivers].sort((a, b) => {
            const liveTruckA = a.assignedVehicle ? trucks.get(a.assignedVehicle.id) : null;
            const liveTruckB = b.assignedVehicle ? trucks.get(b.assignedVehicle.id) : null;

            const statusA = liveTruckA ? liveTruckA.status : a.status;
            const statusB = liveTruckB ? liveTruckB.status : b.status;

            if (statusA === 'BROKEN' && statusB !== 'BROKEN') return -1;
            if (statusA !== 'BROKEN' && statusB === 'BROKEN') return 1;

            if (statusA === 'BUSY' && statusB !== 'BUSY') return -1;
            if (statusA !== 'BUSY' && statusB === 'BUSY') return 1;

            const plateA = a.assignedVehicle ? a.assignedVehicle.plateNumber : '';
            const plateB = b.assignedVehicle ? b.assignedVehicle.plateNumber : '';

            if (plateA && plateB) {
                return plateA.localeCompare(plateB);
            }

            if (plateA && !plateB) return -1;
            if (!plateA && plateB) return 1;

            return a.lastName.localeCompare(b.lastName);
        });
    },[drivers, trucks]);

    const resetForm = () => {
        setVersion(0); setFirstName(''); setLastName(''); setPhone(''); setSelectedVehicleId('');
        setEditingId(null); setIsFormOpen(false);
    };

    const handleEditClick = (d: DriverDB) => {
        setVersion(d.version || 0);
        setFirstName(d.firstName); setLastName(d.lastName); setPhone(d.phoneNumber);
        setSelectedVehicleId(d.assignedVehicle ? d.assignedVehicle.id.toString() : '');
        setEditingId(d.id); setIsFormOpen(true);
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć kierowcę? Zostanie on odpięty od ewentualnej ciężarówki, a w historii zleceń pojawi się jako "Usunięty".')) return;
        try {
            await deleteDriver(id);
            await loadData();
            await refreshVehicles();
            showToast('Kierowca został poprawnie usunięty z systemu', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { version, firstName, lastName, phoneNumber: phone, assignedVehicle: selectedVehicleId ? { id: parseInt(selectedVehicleId) } : null };

        try {
            if (editingId) {
                await updateDriver(editingId, payload);
                showToast('Dane kierowcy zostały zaktualizowane', 'success');
            } else {
                await addDriver(payload);
                showToast('Nowy kierowca został dodany do bazy', 'success');
            }
            resetForm();
            await loadData();
            await refreshVehicles();
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const resolveDriverLocationText = (driver: DriverDB) => {
        if (!driver.assignedVehicle) return <span className="text-slate-500 italic">Brak przypisanego pojazdu</span>;

        const vehicleId = driver.assignedVehicle.id;
        const liveTruck = trucks.get(vehicleId);

        if (!liveTruck) return <span className="text-slate-500 italic">Ładowanie...</span>;

        if (liveTruck.status === 'WAITING_FOR_TOW') {
            return (
                <span className="flex items-center gap-1 text-slate-400 font-bold border border-slate-600 px-2 py-0.5 rounded text-xs">
                    ZJECHAŁ Z TRASY (AUTO WRAK)
                </span>
            );
        }

        if (liveTruck.status === 'HANDOVER') {
            return (
                <span className="flex items-center gap-1 text-fuchsia-400 font-bold animate-pulse">
                    PRZEŁADUNEK Z WRAKU
                </span>
            );
        }

        if (liveTruck.status === 'BROKEN') {
            return (
                <span className="flex items-center gap-1 text-rose-400 font-bold animate-pulse">
                    <AlertTriangle size={14} /> POJAZD USZKODZONY
                </span>
            );
        }

        if (liveTruck.status === 'RESCUE_MISSION' || liveTruck.status === 'RESCUE_ARRIVED') {
            return (
                <span className="flex items-center gap-1 text-indigo-400 font-bold">
                    <Truck size={14} /> JEDZIE Z POMOCĄ TECHNICZNĄ
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
                        <MapPin size={14} /> Oczekuje: {closestLoc.name}
                    </span>
                );
            }
            return <span className="text-slate-400">Postój na trasie</span>;
        }
    };

    const availableVehicles = vehicles.filter(v =>
        !drivers.some(d => d.assignedVehicle?.id === v.id && d.id !== editingId)
    );

    const isEditingBusy = editingId ? (drivers.find(d => d.id === editingId)?.status === 'BUSY' || drivers.find(d => d.id === editingId)?.status === 'BROKEN' || trucks.get(editingId)?.status === 'RESCUE_MISSION' || trucks.get(editingId)?.status === 'HANDOVER' || trucks.get(editingId)?.status === 'WAITING_FOR_TOW') : false;

    return (
        <div ref={containerRef} className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200 relative">
            <div className="flex justify-between items-center mb-8">
                <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><User className="text-cyan-400" size={32} /> Zarządzanie Kadrami</h1></div>
                <button onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition">
                    {isFormOpen ? <X size={20} /> : <Plus size={20} />} {isFormOpen ? 'Anuluj' : 'Dodaj Kierowcę'}
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className={`p-6 rounded-2xl border mb-8 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 border-l-4 ${isEditingBusy ? 'bg-slate-800/50 border-amber-500/50 border-l-amber-500' : 'bg-slate-800 border-slate-700 border-l-cyan-400'}`}>
                    <div className="md:col-span-2 flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-white">{editingId ? 'Edytuj Kierowcę' : 'Nowy Kierowca'}</h2>
                        {isEditingBusy && (
                            <span className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                <AlertTriangle size={14} /> Blokada edycji - trasa/awaria
                            </span>
                        )}
                    </div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Imię</label><input disabled={isEditingBusy} required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Nazwisko</label><input disabled={isEditingBusy} required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Telefon</label><input disabled={isEditingBusy} required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed" /></div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase mb-1">Przypisz Pojazd</label>
                        <select disabled={isEditingBusy} value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed">
                            <option value="">-- Brak przypisanego auta --</option>
                            {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand})</option>)}
                        </select>
                    </div>
                    {!isEditingBusy && (
                        <div className="md:col-span-2 flex justify-end mt-2">
                            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                                {editingId ? 'Zapisz Zmiany' : 'Dodaj Kierowcę'}
                            </button>
                        </div>
                    )}
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Identyfikator i Personalia</th>
                        <th className="p-4 border-b border-slate-700">Przypisany Pojazd</th>
                        <th className="p-4 border-b border-slate-700">Status Operacyjny</th>
                        <th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedDrivers.map(d => (
                        <tr key={d.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 transition-colors duration-300">
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-white flex items-center gap-2">
                                        <span className="text-xs bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">#{d.id}</span>
                                        {d.firstName} {d.lastName}
                                    </span>
                                    <span className="text-xs text-slate-400 mt-1">{d.phoneNumber}</span>
                                </div>
                            </td>
                            <td className="p-4">{d.assignedVehicle ? <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 font-mono text-sm">{d.assignedVehicle.plateNumber}</span> : <span className="text-slate-500 italic">Brak auta</span>}</td>
                            <td className="p-4 text-sm">
                                {resolveDriverLocationText(d)}
                            </td>
                            <td className="p-4 flex justify-end gap-2 items-center">
                                <button onClick={() => handleEditClick(d)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition" title="Edytuj"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(d.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition" title="Usuń"><Trash2 size={18} /></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}