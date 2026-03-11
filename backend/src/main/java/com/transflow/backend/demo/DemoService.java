package com.transflow.backend.demo;

import com.transflow.backend.fleet.Driver;
import com.transflow.backend.fleet.DriverRepository;
import com.transflow.backend.fleet.Vehicle;
import com.transflow.backend.fleet.VehicleRepository;
import com.transflow.backend.logistics.Location;
import com.transflow.backend.logistics.LocationRepository;
import com.transflow.backend.logistics.OrderCreateRequest;
import com.transflow.backend.logistics.OrderService;
import com.transflow.backend.logistics.RoutingService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class DemoService {

    private final LocationRepository locationRepository;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final EntityManager entityManager;
    private final RoutingService routingService;
    private final OrderService orderService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final Object[][] EU_CAPITALS = {
            {"Warszawa", 52.2297, 21.0122, "BASE"}, {"Berlin", 52.5200, 13.4050, "PORT"},
            {"Paryż", 48.8566, 2.3522, "WAREHOUSE"}, {"Madryt", 40.4168, -3.7038, "WAREHOUSE"},
            {"Rzym", 41.9028, 12.4964, "PORT"}, {"Praga", 50.0755, 14.4378, "BASE"},
            {"Wiedeń", 48.2082, 16.3738, "WAREHOUSE"}, {"Budapeszt", 47.4979, 19.0402, "WAREHOUSE"},
            {"Bratysława", 48.1486, 17.1077, "WAREHOUSE"}, {"Amsterdam", 52.3676, 4.9041, "PORT"},
            {"Bruksela", 50.8503, 4.3517, "WAREHOUSE"}, {"Sztokholm", 59.3293, 18.0686, "PORT"},
            {"Oslo", 59.9139, 10.7522, "PORT"}, {"Helsinki", 60.1695, 24.9354, "PORT"},
            {"Kopenhaga", 55.6761, 12.5683, "PORT"}, {"Lizbona", 38.7223, -9.1393, "PORT"},
            {"Dublin", 53.3498, -6.2603, "PORT"}, {"Ateny", 37.9838, 23.7275, "PORT"},
            {"Sofia", 42.6977, 23.3219, "WAREHOUSE"}, {"Bukareszt", 44.4268, 26.1025, "WAREHOUSE"},
            {"Zagrzeb", 45.8150, 15.9819, "WAREHOUSE"}, {"Lublana", 46.0569, 14.5058, "WAREHOUSE"},
            {"Wilno", 54.6872, 25.2797, "BASE"}, {"Ryga", 56.9496, 24.1052, "PORT"},
            {"Tallinn", 59.4370, 24.7536, "PORT"}
    };

    private static final String[] FIRST_NAMES = {"Jan", "Piotr", "Krzysztof", "Andrzej", "Tomasz", "Paweł", "Kamil", "Michał", "Marcin", "Jakub", "Marek", "Maciej", "Łukasz", "Mateusz", "Dawid", "Szymon", "Adam", "Patryk", "Karol", "Artur"};
    private static final String[] LAST_NAMES = {"Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Krawczyk", "Kaczmarek", "Piotrowski", "Grabowski", "Zając"};
    private static final String[] BRANDS = {"Scania", "Volvo", "MAN", "DAF", "Mercedes-Benz"};
    private static final String[] MODELS = {"R450", "FH16", "TGX", "XF", "Actros"};

    @Transactional
    public Map<String, Integer> seedLocations() {
        int added = 0;
        int skipped = 0;
        for (Object[] capital : EU_CAPITALS) {
            String name = (String) capital[0] + " Central Hub";
            if (!locationRepository.existsByName(name)) {
                Location loc = new Location();
                loc.setName(name);
                loc.setCompanyName("TransFlow Europe");
                loc.setLatitude((Double) capital[1]);
                loc.setLongitude((Double) capital[2]);
                loc.setType((String) capital[3]);
                loc.setAddress("Logistics Park 1, " + capital[0]);
                locationRepository.save(loc);
                added++;
            } else {
                skipped++;
            }
        }
        return Map.of("added", added, "skipped", skipped);
    }

    @Transactional
    public Map<String, Integer> seedFleetAndStaff() {
        long currentCount = vehicleRepository.count();
        int toAdd = 50 - (int) currentCount;
        if (toAdd <= 0) return Map.of("added", 0, "skipped", (int) currentCount);

        List<Location> locations = locationRepository.findAll();
        List<Location> bases = locations.stream().filter(l -> "BASE".equals(l.getType())).toList();
        Random random = new Random();

        for (int i = 0; i < Math.min(5, toAdd); i++) {
            Vehicle msu = new Vehicle();
            msu.setPlateNumber("MSU" + String.format("%04d", random.nextInt(10000)));
            msu.setBrand("Volvo");
            msu.setModel("FMX Recovery");
            msu.setBaseFuelConsumption(35.0);
            msu.setFuelCapacity(1000.0);
            msu.setStatus("AVAILABLE");
            msu.setIsServiceUnit(true);
            msu.setCurrentOdometer(random.nextDouble() * 100000.0);

            Location loc = bases.isEmpty() ? (!locations.isEmpty() ? locations.get(0) : null) : bases.get(random.nextInt(bases.size()));
            if (loc != null) {
                msu.setCurrentLat(loc.getLatitude() + (random.nextDouble() - 0.5) * 0.01);
                msu.setCurrentLng(loc.getLongitude() + (random.nextDouble() - 0.5) * 0.01);
            } else {
                msu.setCurrentLat(52.2297); msu.setCurrentLng(21.0122);
            }

            Vehicle saved = vehicleRepository.save(msu);
            Driver driver = new Driver();
            driver.setFirstName("Serwisant"); driver.setLastName(LAST_NAMES[random.nextInt(LAST_NAMES.length)]);
            driver.setPhoneNumber("+48 800" + random.nextInt(999999));
            driver.setStatus("AVAILABLE");
            driver.setAssignedVehicle(saved);
            driverRepository.save(driver);
        }

        for (int i = 5; i < toAdd; i++) {
            Vehicle vehicle = new Vehicle();
            String plate = (char)(random.nextInt(26) + 'A') + "" + (char)(random.nextInt(26) + 'A') + String.format("%05d", random.nextInt(100000));
            vehicle.setPlateNumber(plate);
            int brandIndex = random.nextInt(BRANDS.length);
            vehicle.setBrand(BRANDS[brandIndex]);
            vehicle.setModel(MODELS[brandIndex]);
            vehicle.setBaseFuelConsumption(24.0 + random.nextDouble() * 6.0);
            vehicle.setFuelCapacity(600.0 + random.nextInt(4) * 100.0);
            vehicle.setStatus("AVAILABLE");
            vehicle.setCurrentOdometer(random.nextDouble() * 500000.0);
            vehicle.setIsServiceUnit(false);

            if (!locations.isEmpty()) {
                Location randomLoc = locations.get(random.nextInt(locations.size()));
                vehicle.setCurrentLat(randomLoc.getLatitude() + (random.nextDouble() - 0.5) * 0.01);
                vehicle.setCurrentLng(randomLoc.getLongitude() + (random.nextDouble() - 0.5) * 0.01);
            } else {
                vehicle.setCurrentLat(52.2297 + (random.nextDouble() - 0.5) * 5.0);
                vehicle.setCurrentLng(21.0122 + (random.nextDouble() - 0.5) * 5.0);
            }

            Vehicle savedVehicle = vehicleRepository.save(vehicle);

            Driver driver = new Driver();
            driver.setFirstName(FIRST_NAMES[random.nextInt(FIRST_NAMES.length)]);
            driver.setLastName(LAST_NAMES[random.nextInt(LAST_NAMES.length)]);
            driver.setPhoneNumber("+48 " + (500000000 + random.nextInt(400000000)));
            driver.setStatus("AVAILABLE");
            driver.setTotalDrivingTime(random.nextDouble() * 1000.0);
            driver.setAssignedVehicle(savedVehicle);

            driverRepository.save(driver);
        }
        return Map.of("added", toAdd, "skipped", (int) currentCount);
    }

    @Transactional
    public void clearAllData() {
        entityManager.createNativeQuery("TRUNCATE TABLE fuel_logs, orders, drivers, vehicles, locations RESTART IDENTITY CASCADE").executeUpdate();
    }

    @Async
    public void autoDispatch(int count) {
        List<Long> availableVehicleIds = vehicleRepository.findAll().stream()
                .filter(v -> "AVAILABLE".equals(v.getStatus()) && !Boolean.TRUE.equals(v.getIsServiceUnit()))
                .filter(v -> driverRepository.findAll().stream().anyMatch(d -> d.getAssignedVehicle() != null && d.getAssignedVehicle().getId().equals(v.getId()) && "AVAILABLE".equals(d.getStatus())))
                .map(Vehicle::getId)
                .toList();

        List<Location> locations = locationRepository.findAll();
        if (locations.size() < 2 || availableVehicleIds.isEmpty()) return;

        Random random = new Random();
        int dispatched = 0;

        for (Long vId : availableVehicleIds) {
            if (dispatched >= count) break;

            Vehicle vehicle = vehicleRepository.findById(vId).orElse(null);
            if (vehicle == null || !"AVAILABLE".equals(vehicle.getStatus())) continue;

            Location startLoc = locations.get(random.nextInt(locations.size()));
            Location endLoc = locations.get(random.nextInt(locations.size()));

            while (startLoc.getId().equals(endLoc.getId())) {
                endLoc = locations.get(random.nextInt(locations.size()));
            }

            RoutingService.RouteInfo approachRoute = routingService.getRoute(vehicle.getCurrentLat(), vehicle.getCurrentLng(), startLoc.getLatitude(), startLoc.getLongitude());

            try {
                Thread.sleep(600);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            RoutingService.RouteInfo transitRoute = routingService.getRoute(startLoc.getLatitude(), startLoc.getLongitude(), endLoc.getLatitude(), endLoc.getLongitude());

            if (approachRoute != null && transitRoute != null) {
                OrderCreateRequest req = new OrderCreateRequest(
                        vehicle.getId(), startLoc.getId(), endLoc.getId(),
                        approachRoute.polyline(), approachRoute.distance(),
                        transitRoute.polyline(), transitRoute.distance()
                );

                try {
                    orderService.createOrder(req);
                    messagingTemplate.convertAndSend("/topic/updates", "ORDERS");
                    messagingTemplate.convertAndSend("/topic/updates", "VEHICLES");
                    messagingTemplate.convertAndSend("/topic/updates", "DRIVERS");
                    dispatched++;
                } catch (Exception e) {}
            }

            try {
                Thread.sleep(1200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}