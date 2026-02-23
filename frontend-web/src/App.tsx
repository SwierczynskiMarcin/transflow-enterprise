import { useState } from "react";
import MainLayout from "./components/MainLayout";
import TruckMap from "./components/TruckMap";
import VehicleManager from "./components/vehicles/VehicleManager";
import { SimulationProvider } from "./context/SimulationContext";
import DriverManager from "./components/drivers/DriverManager";

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
            {currentView === "vehicles" && <VehicleManager />}
            {currentView === "drivers" && <DriverManager />}
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