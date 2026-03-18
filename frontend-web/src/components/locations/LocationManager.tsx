import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Plus, Trash2, Edit2, X, Map as MapIcon, MapPin, Anchor, Warehouse } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import CoordinatePickerMap from './CoordinatePickerMap';
import { getLocations, addLocation, updateLocation, deleteLocation } from '../../api/logisticsApi';
import { useToast } from '../../context/ToastContext';

const TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    BASE: { label: 'Baza Floty', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: <Building2 size={16} /> },
    PORT: { label: 'Terminal / Port', className: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: <Anchor size={16} /> },
    WAREHOUSE: { label: 'Magazyn', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30', icon: <Warehouse size={16} /> }
};

const TYPE_PRIORITY: Record<string, number> = {
    'BASE': 1,
    'WAREHOUSE': 2,
    'PORT': 3
};

function TypeBadge({ type }: { type: string }) {
    const config = TYPE_CONFIG[type] ?? { label: type, className: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: <MapPin size={16} /> };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${config.className}`}>
            {config.icon}
            {config.label}
        </span>
    );
}

export default function LocationManager() {
    const { refreshLocations, refreshOrders, refreshRoutes } = useSimulation();
    const { showToast } = useToast();
    const [locationsData, setLocationsData] = useState<any[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isPickerMapOpen, setIsPickerMapOpen] = useState(false);

    const [name, setName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [type, setType] = useState('BASE');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState(52.2297);
    const [lng, setLng] = useState(21.0122);

    const fetchDBData = async () => {
        try {
            const data = await getLocations();
            setLocationsData(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDBData();
    }, []);

    const sortedLocations = useMemo(() => {
        return [...locationsData].sort((a, b) => {
            const prioA = TYPE_PRIORITY[a.type] || 99;
            const prioB = TYPE_PRIORITY[b.type] || 99;
            if (prioA !== prioB) return prioA - prioB;
            return a.name.localeCompare(b.name);
        });
    }, [locationsData]);

    const resetForm = () => {
        setName('');
        setCompanyName('');
        setType('BASE');
        setAddress('');
        setLat(52.2297);
        setLng(21.0122);
        setEditingId(null);
        setIsFormOpen(false);
        setIsPickerMapOpen(false);
    };

    const handleEditClick = (loc: any) => {
        setName(loc.name);
        setCompanyName(loc.companyName);
        setType(loc.type);
        setAddress(loc.address);
        setLat(loc.latitude);
        setLng(loc.longitude);
        setEditingId(loc.id);
        setIsFormOpen(true);
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć ten hub logistyczny?')) return;
        try {
            await deleteLocation(id);
            setLocationsData(prev => prev.filter(l => l.id !== id));
            await refreshLocations();
            await refreshOrders();
            await refreshRoutes();
            showToast('Punkt logistyczny został usunięty', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name,
            companyName,
            type,
            address,
            latitude: lat,
            longitude: lng
        };

        try {
            if (editingId) {
                await updateLocation(editingId, payload);
                showToast('Dane hubu zostały zaktualizowane', 'success');
            } else {
                await addLocation(payload);
                showToast('Nowy hub logistyczny dodany do sieci', 'success');
            }
            resetForm();
            await fetchDBData();
            await refreshLocations();
        } catch (error: any) {
            showToast(error.message, 'error');
        }
    };

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
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Building2 className="text-cyan-400" size={32} /> Sieć Logistyczna
                    </h1>
                </div>
                <button
                    onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition"
                >
                    {isFormOpen ? <X size={20} /> : <Plus size={20} />}
                    {isFormOpen ? 'Anuluj' : 'Dodaj Hub'}
                </button>
            </div>

            {isFormOpen && (
                <form
                    onSubmit={handleSubmit}
                    className="p-6 rounded-2xl border mb-8 shadow-xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-l-4 bg-slate-800 border-slate-700 border-l-cyan-400"
                >
                    <div className="md:col-span-2 lg:col-span-4 flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-white">{editingId ? 'Edytuj Hub' : 'Nowy Hub Logistyczny'}</h2>
                    </div>

                    <div className="lg:col-span-2">
                        <label className="block text-xs text-slate-400 uppercase mb-1">Nazwa Obiektu</label>
                        <input required value={name} onChange={e => setName(e.target.value)}
                               className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase mb-1">Firma / Właściciel</label>
                        <input required value={companyName} onChange={e => setCompanyName(e.target.value)}
                               className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase mb-1">Typ Obiektu</label>
                        <select value={type} onChange={e => setType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400">
                            <option value="BASE">Baza Floty</option>
                            <option value="WAREHOUSE">Magazyn</option>
                            <option value="PORT">Terminal / Port</option>
                        </select>
                    </div>

                    <div className="lg:col-span-4">
                        <label className="block text-xs text-slate-400 uppercase mb-1">Pełny Adres</label>
                        <input required value={address} onChange={e => setAddress(e.target.value)}
                               className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" />
                    </div>

                    <div className="flex gap-2 items-end lg:col-span-4 p-3 rounded-xl border bg-slate-900/50 border-slate-700 mt-2">
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Szerokość (Lat)</label>
                            <input type="number" step="0.000001" required value={lat}
                                   onChange={e => setLat(Number(e.target.value))}
                                   className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Długość (Lng)</label>
                            <input type="number" step="0.000001" required value={lng}
                                   onChange={e => setLng(Number(e.target.value))}
                                   className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-cyan-400" />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPickerMapOpen(true)}
                            className="bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-900 border border-cyan-500/50 px-4 py-2 rounded-lg transition flex items-center gap-2 h-[42px]"
                        >
                            <MapIcon size={18} />
                            <span className="text-sm font-bold whitespace-nowrap">Wybierz z mapy</span>
                        </button>
                    </div>

                    <div className="lg:col-span-4 flex justify-end mt-4">
                        <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                            {editingId ? 'Zapisz Zmiany' : 'Utwórz Hub'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Nazwa i Właściciel</th>
                        <th className="p-4 border-b border-slate-700">Typ Obiektu</th>
                        <th className="p-4 border-b border-slate-700">Adres</th>
                        <th className="p-4 border-b border-slate-700">Współrzędne</th>
                        <th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sortedLocations.map(loc => (
                        <tr key={loc.id} className="hover:bg-slate-700/50 border-b border-slate-700/50 transition-colors duration-300">
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-white">{loc.name}</span>
                                    <span className="text-xs text-slate-400">{loc.companyName}</span>
                                </div>
                            </td>
                            <td className="p-4">
                                <TypeBadge type={loc.type} />
                            </td>
                            <td className="p-4">
                                <span className="text-slate-300 text-sm">{loc.address}</span>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col text-xs text-slate-400 font-mono">
                                    <span>Lat: {loc.latitude.toFixed(5)}</span>
                                    <span>Lng: {loc.longitude.toFixed(5)}</span>
                                </div>
                            </td>
                            <td className="p-4 flex justify-end gap-2">
                                <button
                                    onClick={() => handleEditClick(loc)}
                                    className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition"
                                    title="Edytuj Hub"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(loc.id)}
                                    className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition"
                                    title="Usuń Hub"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {sortedLocations.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">
                                Brak zdefiniowanych hubów logistycznych.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}