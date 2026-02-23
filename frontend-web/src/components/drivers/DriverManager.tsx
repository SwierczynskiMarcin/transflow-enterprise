import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Edit2, X } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';

interface DriverDB { id: number; firstName: string; lastName: string; phoneNumber: string; status: string; assignedVehicle?: { id: number; plateNumber: string; brand: string; }; }
interface VehicleDB { id: number; plateNumber: string; brand: string; }

export default function DriverManager() {
    const { refreshVehicles } = useSimulation();
    const [drivers, setDrivers] = useState<DriverDB[]>([]);
    const [vehicles, setVehicles] = useState<VehicleDB[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    const loadData = async () => {
        const [drvRes, vehRes] = await Promise.all([ fetch('http://localhost:8080/api/drivers'), fetch('http://localhost:8080/api/vehicles') ]);
        setDrivers(await drvRes.json()); setVehicles(await vehRes.json());
    };

    useEffect(() => { loadData(); }, []);

    const resetForm = () => {
        setFirstName(''); setLastName(''); setPhone(''); setSelectedVehicleId('');
        setEditingId(null); setIsFormOpen(false);
    };

    const handleEditClick = (d: DriverDB) => {
        setFirstName(d.firstName); setLastName(d.lastName); setPhone(d.phoneNumber);
        setSelectedVehicleId(d.assignedVehicle ? d.assignedVehicle.id.toString() : '');
        setEditingId(d.id); setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć kierowcę?')) return;
        const res = await fetch(`http://localhost:8080/api/drivers/${id}`, { method: 'DELETE' });
        if (res.ok) { await loadData(); await refreshVehicles(); } else alert('Nie można usunąć kierowcy w trasie.');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { firstName, lastName, phoneNumber: phone, assignedVehicle: selectedVehicleId ? { id: parseInt(selectedVehicleId) } : null };
        const url = editingId ? `http://localhost:8080/api/drivers/${editingId}` : 'http://localhost:8080/api/drivers';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { resetForm(); await loadData(); await refreshVehicles(); }
    };

    // Pokaż wolne auta ORAZ auto aktualnie przypisane do edytowanego kierowcy
    const availableVehicles = vehicles.filter(v =>
        !drivers.some(d => d.assignedVehicle?.id === v.id && d.id !== editingId)
    );

    return (
        <div className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200">
            <div className="flex justify-between items-center mb-8">
                <div><h1 className="text-3xl font-bold text-white flex items-center gap-3"><User className="text-cyan-400" size={32} /> Zarządzanie Kadrami</h1></div>
                <button onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition">
                    {isFormOpen ? <X size={20} /> : <Plus size={20} />} {isFormOpen ? 'Anuluj' : 'Dodaj Kierowcę'}
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 border-l-4 border-l-cyan-400">
                    <h2 className="md:col-span-2 text-lg font-bold text-white mb-2">{editingId ? 'Edytuj Kierowcę' : 'Nowy Kierowca'}</h2>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Imię</label><input required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Nazwisko</label><input required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Telefon</label><input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" /></div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase mb-1">Przypisz Pojazd</label>
                        <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400">
                            <option value="">-- Brak przypisanego auta --</option>
                            {availableVehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} ({v.brand})</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-2">
                        <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                            {editingId ? 'Zapisz Zmiany' : 'Dodaj Kierowcę'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Kierowca</th><th className="p-4 border-b border-slate-700">Kontakt</th><th className="p-4 border-b border-slate-700">Przypisany Pojazd</th><th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {drivers.map(d => (
                        <tr key={d.id} className="hover:bg-slate-700/50 border-b border-slate-700/50">
                            <td className="p-4 font-bold text-white">{d.firstName} {d.lastName}</td>
                            <td className="p-4 text-slate-300">{d.phoneNumber}</td>
                            <td className="p-4">{d.assignedVehicle ? <span className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">{d.assignedVehicle.plateNumber}</span> : <span className="text-slate-500 italic">Brak auta</span>}</td>
                            <td className="p-4 flex justify-end gap-2">
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