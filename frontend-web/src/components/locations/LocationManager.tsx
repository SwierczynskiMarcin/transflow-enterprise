import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, X, Building2, Map as MapIcon } from 'lucide-react';
import CoordinatePickerMap from './CoordinatePickerMap';

interface LocationDB {
    id: number;
    name: string;
    companyName: string;
    type: string;
    latitude: number;
    longitude: number;
    address: string;
}

export default function LocationManager() {
    const [locations, setLocations] = useState<LocationDB[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [isPickerMapOpen, setIsPickerMapOpen] = useState(false);

    const [name, setName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [type, setType] = useState('WAREHOUSE');
    const [lat, setLat] = useState(52.2297);
    const [lng, setLng] = useState(21.0122);
    const [address, setAddress] = useState('');

    const loadLocations = async () => {
        const res = await fetch('http://localhost:8080/api/locations');
        setLocations(await res.json());
    };

    useEffect(() => { loadLocations(); }, []);

    const resetForm = () => {
        setName(''); setCompanyName(''); setType('WAREHOUSE');
        setLat(52.2297); setLng(21.0122); setAddress('');
        setEditingId(null); setIsFormOpen(false); setIsPickerMapOpen(false);
    };

    const handleEditClick = (loc: LocationDB) => {
        setName(loc.name); setCompanyName(loc.companyName || '');
        setType(loc.type); setLat(loc.latitude); setLng(loc.longitude);
        setAddress(loc.address || '');
        setEditingId(loc.id); setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Czy na pewno chcesz usunąć tę lokalizację?')) return;
        const res = await fetch(`http://localhost:8080/api/locations/${id}`, { method: 'DELETE' });
        if (res.ok) await loadLocations();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { name, companyName, type, latitude: lat, longitude: lng, address };
        const url = editingId ? `http://localhost:8080/api/locations/${editingId}` : 'http://localhost:8080/api/locations';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) { resetForm(); await loadLocations(); }
    };

    const handleLocationPicked = (pickedLat: number, pickedLng: number) => {
        setLat(pickedLat);
        setLng(pickedLng);
        setIsPickerMapOpen(false);
    };

    return (
        <div className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200 relative">

            {/* Nakładka z mapą do wybierania (renderuje się na wierzchu, gdy isPickerMapOpen === true) */}
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
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <MapPin className="text-rose-400" size={32} />
                        Baza Adresowa
                    </h1>
                    <p className="text-slate-400 mt-1">Zarządzaj swoimi bazami, magazynami i punktami docelowymi.</p>
                </div>
                <button onClick={() => isFormOpen ? resetForm() : setIsFormOpen(true)} className="bg-rose-500 hover:bg-rose-400 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition">
                    {isFormOpen ? <X size={20} /> : <Plus size={20} />} {isFormOpen ? 'Anuluj' : 'Dodaj Punkt'}
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 border-l-4 border-l-rose-400">
                    <h2 className="md:col-span-2 text-lg font-bold text-white mb-2">{editingId ? 'Edytuj Lokalizację' : 'Nowa Lokalizacja'}</h2>

                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Nazwa Punktu (np. Baza Centralna)</label><input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400" /></div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Firma / Klient (Opcjonalnie)</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400" /></div>

                    <div>
                        <label className="block text-xs text-slate-400 uppercase mb-1">Typ Obiektu</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400">
                            <option value="BASE">Baza Floty</option>
                            <option value="WAREHOUSE">Magazyn / Centrum Logistyczne</option>
                            <option value="PORT">Port / Terminal</option>
                        </select>
                    </div>
                    <div><label className="block text-xs text-slate-400 uppercase mb-1">Pełny Adres</label><input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400" /></div>

                    {/* SEKCJA KOORDYNATÓW ZE ZMIENIONYM UKŁADEM I PRZYCISKIEM MAPY */}
                    <div className="flex gap-2 md:col-span-2 items-end bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Lat (Szerokość)</label>
                            <input type="number" step="0.000001" required value={lat} onChange={e => setLat(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-400 uppercase mb-1">Lng (Długość)</label>
                            <input type="number" step="0.000001" required value={lng} onChange={e => setLng(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-400" />
                        </div>
                        {/* PRZYCISK "WYBIERZ Z MAPY" */}
                        <button
                            type="button"
                            onClick={() => setIsPickerMapOpen(true)}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/50 px-4 py-2 rounded-lg transition flex items-center gap-2 h-[42px]"
                            title="Kliknij punkt na mapie"
                        >
                            <MapIcon size={18} />
                            <span className="text-sm font-bold whitespace-nowrap">Wybierz z mapy</span>
                        </button>
                    </div>

                    <div className="md:col-span-2 flex justify-end mt-4 pt-4 border-t border-slate-700">
                        <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 px-8 rounded-xl transition">
                            {editingId ? 'Zapisz Zmiany' : 'Dodaj Lokalizację'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase tracking-wider">
                        <th className="p-4 border-b border-slate-700">Nazwa Obiektu</th>
                        <th className="p-4 border-b border-slate-700">Firma</th>
                        <th className="p-4 border-b border-slate-700">Typ</th>
                        <th className="p-4 border-b border-slate-700">Koordynaty</th>
                        <th className="p-4 border-b border-slate-700 text-right">Akcje</th>
                    </tr>
                    </thead>
                    <tbody>
                    {locations.map(loc => (
                        <tr key={loc.id} className="hover:bg-slate-700/50 border-b border-slate-700/50">
                            <td className="p-4 font-bold text-white flex items-center gap-2">
                                <Building2 size={16} className={loc.type === 'BASE' ? 'text-blue-400' : loc.type === 'PORT' ? 'text-cyan-400' : 'text-rose-400'} />
                                {loc.name}
                            </td>
                            <td className="p-4 text-slate-300">{loc.companyName || '-'}</td>
                            <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                                        loc.type === 'BASE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            loc.type === 'PORT' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    }`}>
                                        {loc.type}
                                    </span>
                            </td>
                            <td className="p-4 text-slate-400 text-sm font-mono">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</td>
                            <td className="p-4 flex justify-end gap-2">
                                <button onClick={() => handleEditClick(loc)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition" title="Edytuj"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(loc.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition" title="Usuń"><Trash2 size={18} /></button>
                            </td>
                        </tr>
                    ))}
                    {locations.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Brak zapisanych lokalizacji. Dodaj swój pierwszy punkt!</td></tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}