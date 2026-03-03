import { useState } from "react";
import MainLayout from "./components/MainLayout";
import MapCanvas from "./components/map/MapCanvas";
import VehicleManager from "./components/vehicles/VehicleManager";
import DriverManager from "./components/drivers/DriverManager";
import LocationManager from "./components/locations/LocationManager";
import OrderManager from "./components/orders/OrderManager";
import SettingsManager from "./components/settings/SettingsManager";
import { SimulationProvider } from "./context/SimulationContext";
import { ToastProvider } from "./context/ToastContext";

function AppContent() {
    const [currentView, setCurrentView] = useState("map");

    return (
        <MainLayout currentView={currentView} onNavigate={setCurrentView}>
            {currentView === "map" && <MapCanvas />}
            {currentView === "orders" && <OrderManager />}
            {currentView === "vehicles" && <VehicleManager />}
            {currentView === "drivers" && <DriverManager />}
            {currentView === "locations" && <LocationManager />}
            {currentView === "settings" && <SettingsManager />}
        </MainLayout>
    );
}

export default function App() {
    return (
        <ToastProvider>
            <SimulationProvider>
                <AppContent />
            </SimulationProvider>
        </ToastProvider>
    );
}