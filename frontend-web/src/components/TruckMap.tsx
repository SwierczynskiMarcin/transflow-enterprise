import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const truckIcon = L.divIcon({
    className: 'custom-icon',
    html: '<div style="font-size: 30px;">🚛</div>', // Ikonka ciężarówki
    iconSize: [30, 30],
    iconAnchor: [15, 15] // Punkt zakotwiczenia (środek)
});

interface VehicleData {
    id: number;
    vehicle: {
        plateNumber: string;
        brand: string;
        model: string;
    };
    currentLat: number;
    currentLng: number;
    gpsDistance: number;
    progress: number;
}

export default function TruckMap() {
    const [trucks, setTrucks] = useState<Map<number, VehicleData>>(new Map());

    useEffect(() => {
        const socket = new SockJS('http://localhost:8080/ws-trucks');
        const stompClient = Stomp.over(socket);

        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            console.log("Połączono z WebSocketem!");

            stompClient.subscribe('/topic/trucks', (message) => {
                const truckData: VehicleData = JSON.parse(message.body);

                setTrucks((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(truckData.id, truckData);
                    return newMap;
                });
            });
        }, (error: any) => {
            console.error("❌ Błąd połączenia z WS:", error);
        });

        return () => {
            if (stompClient.connected) stompClient.disconnect();
        };
    }, []);

    return (
        <div className="h-screen w-full flex flex-col">
            <div className="bg-slate-800 text-white p-4 shadow-lg z-10">
                <h1 className="text-2xl font-bold">TransFlow Enterprise 🌍</h1>
                <p className="text-sm text-slate-400">Aktywne pojazdy: {trucks.size}</p>
            </div>

            <MapContainer center={[52.0, 19.0]} zoom={6} className="flex-grow z-0">
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />

                {Array.from(trucks.values()).map((truck) => (
                    <Marker
                        key={truck.id}
                        position={[truck.currentLat || 0, truck.currentLng || 0]}
                        icon={truckIcon}
                    >
                        <Popup>
                            <div className="text-sm">
                                <strong>{truck.vehicle.brand} {truck.vehicle.model}</strong><br/>
                                Rejestracja: {truck.vehicle.plateNumber}<br/>
                                Postęp trasy: {(truck.progress * 100).toFixed(1)}%<br/>
                                Przejechane: {truck.gpsDistance.toFixed(1)} km
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}