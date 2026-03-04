import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Database, Globe, Users, Trash2, Loader2, Rocket } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { seedLocations, seedFleet, autoDispatch, clearAllData } from '../../api/demoApi';
import { useToast } from '../../context/ToastContext';

export default function SettingsManager() {
    const { trucks, refreshLocations, refreshVehicles, refreshRoutes, refreshOrders } = useSimulation();
    const { showToast } = useToast();

    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const[dispatchStatus, setDispatchStatus] = useState<{ active: boolean, requested: number, initialMax: number } | null>(null);

    const availableTrucksWithDrivers = Array.from(trucks.values()).filter(t => t.status === 'AVAILABLE' && t.driverName && t.driverName !== 'Brak przypisania');
    const maxDispatch = availableTrucksWithDrivers.length;

    const[dispatchCount, setDispatchCount] = useState(1);

    useEffect(() => {
        if (!dispatchStatus?.active) {
            if (dispatchCount > maxDispatch && maxDispatch > 0) {
                setDispatchCount(maxDispatch);
            } else if (maxDispatch === 0) {
                setDispatchCount(0);
            }
        }
    },[maxDispatch, dispatchStatus]);

    const handleAction = async (actionId: string, actionFn: () => Promise<any>, successText: string) => {
        if (actionId === 'clear' && !confirm("UWAGA! Ta operacja wywoła polecenie SQL TRUNCATE CASCADE. Bezpowrotnie usunie wszystkie dane, pojazdy, zlecenia i bazy z systemu oraz wyzeruje identyfikatory (ID). Kontynuować?")) {
            return;
        }

        setLoadingAction(actionId);

        if (actionId === 'dispatch') {
            setDispatchStatus({ active: true, requested: dispatchCount, initialMax: maxDispatch });
        }

        try {
            const res = await actionFn();
            await Promise.all([refreshLocations(), refreshVehicles(), refreshRoutes(), refreshOrders()]);

            let finalSuccessText = successText;
            if (res && res.added !== undefined) {
                if (res.added === 0) {
                    finalSuccessText = `Zsynchronizowano. Brak nowych rekordów (Pominięto: ${res.skipped}).`;
                } else {
                    finalSuccessText = `${successText} (Dodano: ${res.added}, Pominięto: ${res.skipped})`;
                }
            }
            showToast(finalSuccessText, 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoadingAction(null);
            if (actionId === 'dispatch') setDispatchStatus(null);
        }
    };

    const dispatchedCount = dispatchStatus ? Math.max(0, dispatchStatus.initialMax - maxDispatch) : 0;
    const progressPercent = dispatchStatus ? Math.min(100, (dispatchedCount / dispatchStatus.requested) * 100) : 0;

    return (
        <div className="p-8 h-full w-full overflow-y-auto bg-slate-900 text-slate-200">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <SettingsIcon className="text-cyan-400" size={32} />
                        Ustawienia Systemu
                    </h1>
                    <p className="text-slate-400 mt-1">Narzędzia developerskie, zasilanie bazy danych i symulacja obciążenia.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Globe size={150} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="p-3 bg-blue-500/20 rounded-xl"><Globe className="text-blue-400" size={24} /></div>
                            <h2 className="text-xl font-bold text-white">Europejska Sieć Logistyczna</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-8 relative z-10 leading-relaxed">
                            Zainicjuj 25 kluczowych stolic europejskich. System sprawdzi istniejące rekordy i pominie duplikaty. Otrzymają one odpowiednie tagi operacyjne oraz koordynaty GPS.
                        </p>
                    </div>
                    <button
                        onClick={() => handleAction('locations', seedLocations, 'Sieć hubów została pomyślnie zsynchronizowana z bazą danych!')}
                        disabled={loadingAction !== null}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingAction === 'locations' ? <><Loader2 className="animate-spin" size={20} /> Generowanie mapy...</> : 'Rozwiń sieć w Europie'}
                    </button>
                </div>

                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden group flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Users size={150} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="p-3 bg-cyan-500/20 rounded-xl"><Users className="text-cyan-400" size={24} /></div>
                            <h2 className="text-xl font-bold text-white">Generator Floty i Kadr (50)</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-8 relative z-10 leading-relaxed">
                            System wygeneruje kierowców oraz nowe ciężarówki.
                        </p>
                    </div>
                    <button
                        onClick={() => handleAction('fleet', seedFleet, 'Zasoby floty i kadr zostały zsynchronizowane.')}
                        disabled={loadingAction !== null}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingAction === 'fleet' ? <><Loader2 className="animate-spin" size={20} /> Przygotowywanie pojazdów...</> : 'Zatrudnij Kadrę i Flotę'}
                    </button>
                </div>

                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden group lg:col-span-2">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Rocket size={150} />
                    </div>
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-3 bg-amber-500/20 rounded-xl"><Rocket className="text-amber-400" size={24} /></div>
                        <h2 className="text-xl font-bold text-white">Auto-Dispatcher</h2>
                    </div>
                    <p className="text-slate-400 text-sm mb-6 relative z-10 leading-relaxed max-w-3xl">
                        Losowo wybiera punkty docelowe i wysyła po kolei ciężarówki do ruchu. Służy do przeprowadzania testów obciążeniowych UI i mapy.
                    </p>

                    <div className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700 relative z-10 min-h-[90px] flex flex-col justify-center">
                        {loadingAction === 'dispatch' && dispatchStatus ? (
                            <div className="w-full flex flex-col gap-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                                    <span className="flex items-center gap-2"><Loader2 className="animate-spin text-amber-400" size={14}/> Trwa dysponowanie floty...</span>
                                    <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{dispatchedCount} / {dispatchStatus.requested}</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                                    <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Liczba pojazdów do wysłania w trasę</span>
                                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">{maxDispatch === 0 ? 0 : dispatchCount} / {maxDispatch}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max={maxDispatch > 0 ? maxDispatch : 1}
                                    value={dispatchCount}
                                    onChange={(e) => setDispatchCount(Number(e.target.value))}
                                    disabled={maxDispatch === 0 || loadingAction !== null}
                                    className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                                />
                                {maxDispatch === 0 && (
                                    <span className="text-[10px] text-rose-400 mt-2 block font-bold">Brak dostępnych zasobów (Pojazd z przypisanym kierowcą w statusie AVAILABLE).</span>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => handleAction('dispatch', () => autoDispatch(dispatchCount), `Dyspozytor pomyślnie wysłał ${dispatchCount} pojazdów w trasy.`)}
                        disabled={maxDispatch === 0 || loadingAction !== null}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    >
                        {loadingAction === 'dispatch' ? <><Loader2 className="animate-spin" size={20} /> Negocjowanie tras z serwerem OSRM...</> : 'Uruchom Masowy Dispatch'}
                    </button>
                </div>

                <div className="bg-rose-950/20 rounded-2xl border border-rose-900/50 p-6 shadow-xl relative overflow-hidden group lg:col-span-2">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none text-rose-500">
                        <Database size={150} />
                    </div>
                    <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-3 bg-rose-500/20 rounded-xl"><Trash2 className="text-rose-400" size={24} /></div>
                        <h2 className="text-xl font-bold text-rose-100">Reset Systemu</h2>
                    </div>
                    <p className="text-rose-300/70 text-sm mb-6 relative z-10 max-w-3xl">
                        UWAGA: Operacja krytyczna i nieodwracalna. Uruchomienie tej procedury spowoduje natychmiastowe i bezpowrotne wymazanie wszystkich danych z systemu. Wszystkie liczniki i identyfikatory zostaną całkowicie wyzerowane, przywracając bazę do absolutnego stanu surowego. Po wykonaniu tego kroku nie ma możliwości cofnięcia zmian ani odzyskania utraconych informacji.
                    </p>
                    <button
                        onClick={() => handleAction('clear', clearAllData, 'System zresetowany. ID sekwencji wyzerowane.')}
                        disabled={loadingAction !== null}
                        className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-8 rounded-xl transition flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed border border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)] w-full md:w-auto"
                    >
                        {loadingAction === 'clear' ? <><Loader2 className="animate-spin" size={20} /> Czyszczenie kaskadowe bazy...</> : 'Wyczyść wszystkie dane systemu'}
                    </button>
                </div>

            </div>
        </div>
    );
}