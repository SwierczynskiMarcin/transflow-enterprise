import { useState } from "react";
import MainLayout from "./components/MainLayout";
import TruckMap from "./components/TruckMap";
import VehicleManager from "./components/vehicles/VehicleManager";
import DriverManager from "./components/drivers/DriverManager";
import LocationManager from "./components/locations/LocationManager";
import OrderManager from "./components/orders/OrderManager";
import SettingsManager from "./components/settings/SettingsManager";
import { SimulationProvider } from "./context/SimulationContext";

function AppContent() {
    const [currentView, setCurrentView] = useState("map");

    return (
        <MainLayout currentView={currentView} onNavigate={setCurrentView}>
            {currentView === "map" && <TruckMap />}
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
        <SimulationProvider>
            <AppContent />
        </SimulationProvider>
    );
}