import { useState } from "react";
import MainLayout from "./components/MainLayout";
import TruckMap from "./components/TruckMap";
import { SimulationProvider } from "./context/SimulationContext";

function AppContent() {
    const [currentView, setCurrentView] = useState("map");

    const renderPlaceholder = (title: string) => (
        <div className="flex h-full items-center justify-center text-slate-400 text-2xl font-light">
            {title} (Wkrótce)
        </div>
    );

    return (
        <MainLayout currentView={currentView} onNavigate={setCurrentView}>
            {currentView === "map" && <TruckMap />}
            {currentView === "orders" && renderPlaceholder("Widok Zarządzania Zleceniami")}
            {currentView === "vehicles" && renderPlaceholder("Widok Zarządzania Pojazdami")}
            {currentView === "drivers" && renderPlaceholder("Widok Kierowców i Tachografów")}
            {currentView === "settings" && renderPlaceholder("Ustawienia Systemu")}
        </MainLayout>
    );
}

export default function App() {
    return (
        <SimulationProvider>
            <AppContent />
        </SimulationProvider>
    );
}