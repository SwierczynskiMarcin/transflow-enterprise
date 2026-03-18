# TransFlow TMS

**Real-Time Digital Twin & Transport Management System**

TransFlow TMS to platforma klasy enterprise przeznaczona do zarządzania flotą pojazdów ciężarowych w czasie rzeczywistym. System łączy silnik symulacji fizyki ruchu z interaktywną mapą live, pozwalając na monitorowanie, planowanie i stress-testowanie operacji logistycznych na skalę europejską.

---

## Spis treści

- [Przegląd systemu](#przegląd-systemu)
- [Stos technologiczny](#stos-technologiczny)
- [Architektura projektu](#architektura-projektu)
- [Instalacja i uruchomienie](#instalacja-i-uruchomienie)
- [Funkcjonalności](#funkcjonalności)
- [REST API — przegląd endpointów](#rest-api--przegląd-endpointów)
- [Komunikacja w czasie rzeczywistym](#komunikacja-w-czasie-rzeczywistym)
- [Silnik symulacji](#silnik-symulacji)
- [System misji ratunkowych (Rescue Radar)](#system-misji-ratunkowych-rescue-radar)
- [Tryb Demo](#tryb-demo)
- [Struktura katalogów](#struktura-katalogów)

---

## Przegląd systemu

TransFlow TMS działa jako **cyfrowy bliźniak** (Digital Twin) floty transportowej. Każdy pojazd w systemie jest reprezentowany przez wirtualny model aktualizowany w czasie rzeczywistym za pośrednictwem WebSocket (STOMP). Pozycje pojazdów są obliczane przez silnik fizyki na podstawie rzeczywistych geometrii dróg pobranych z serwera OSRM, a nie przez prostą interpolację liniową.

System obsługuje pełny cykl życia zlecenia transportowego: od przypisania pojazdu i kierowcy, przez fazę dojazdu do punktu załadunku, załadunek, transport, aż po rozładunek i powrót pojazdu do stanu `AVAILABLE`. Dodatkowo platforma oferuje moduł misji ratunkowych MSU, który automatycznie koordynuje holowanie uszkodzonych pojazdów przez dedykowane jednostki serwisowe.

---

## Stos technologiczny

### Backend
| Technologia | Wersja | Zastosowanie |
|---|---|---|
| Java | 17 | Język podstawowy |
| Spring Boot | 4.0.3 | Framework aplikacji |
| Spring Data JPA | — | Warstwa persystencji |
| Spring WebSocket (STOMP) | — | Streaming danych w czasie rzeczywistym |
| PostgreSQL + PostGIS | 15 | Baza danych |
| Lombok | — | Redukcja boilerplate |
| Maven | 3.9.12 | Build tool |

### Frontend
| Technologia | Wersja | Zastosowanie |
|---|---|---|
| React | 19.2.0 | Framework UI |
| TypeScript | 5.9.3 | Typowanie statyczne |
| Vite | 7.3.1 | Bundler i dev server |
| Tailwind CSS | 4.2.0 | Stylowanie |
| React Leaflet | 5.0.0 | Interaktywna mapa |
| @stomp/stompjs | 7.3.0 | Klient WebSocket |
| SockJS | 1.6.1 | Fallback WebSocket |
| Lucide React | 0.575.0 | Ikony |

### Infrastruktura
| Technologia | Zastosowanie |
|---|---|
| Docker Compose | Baza danych + pgAdmin |
| OSRM (Open Source Routing Machine) | Wyznaczanie tras drogowych |

---

## Architektura projektu

System jest podzielony na trzy warstwy domenowe zgodne z zasadami Domain-Driven Design:

```
transflow/
├── backend/                          # Spring Boot API
│   └── src/main/java/com/transflow/backend/
│       ├── fleet/                    # Domena: Pojazdy i Kierowcy
│       ├── logistics/                # Domena: Zlecenia, Lokalizacje, Routing
│       ├── simulation/               # Rdzeń: Silnik symulacji i fizyka
│       │   └── strategy/             # Strategy Pattern: obsługa stanów zleceń
│       ├── finance/                  # Domena: Logi tankowania
│       ├── demo/                     # Narzędzia seedowania i auto-dispatch
│       ├── config/                   # Konfiguracja WebSocket
│       └── exception/                # Globalny handler błędów
└── frontend-web/                     # React + TypeScript SPA
    └── src/
        ├── api/                      # Klienty HTTP (apiClient, fleetApi, etc.)
        ├── components/
        │   ├── map/                  # Mapa Live (Canvas, Layers, Overlays)
        │   ├── drivers/              # Panel zarządzania kierowcami
        │   ├── vehicles/             # Panel zarządzania flotą
        │   ├── locations/            # Panel sieci logistycznej
        │   ├── orders/               # Panel zleceń
        │   └── settings/             # Ustawienia i tryb Demo
        └── context/                  # SimulationContext + MapContext
```

### Wzorzec Strategy w silniku symulacji

Obsługa stanów zleceń jest zaimplementowana za pomocą wzorca **Strategy**. Każdy stan (`APPROACHING`, `IN_TRANSIT`, `RESCUE_APPROACHING`, `TOWING` itd.) ma dedykowany handler implementujący interfejs `OrderStateHandler`. Pozwala to na dodawanie nowych trybów operacyjnych bez modyfikacji rdzenia silnika.

### Podział kontekstu frontendowego

Frontend stosuje podział stanu na dwa niezależne konteksty:
- **`SimulationContext`** — globalny stan danych (pojazdy, zlecenia, lokalizacje, trasy)
- **`MapContext`** — stan interakcji z mapą (zaznaczenia, podgląd trasy, kreator zleceń)

Izolacja renderowania warstw mapy (statyczne huby vs. dynamiczne pojazdy) zapewnia płynność 60 FPS nawet przy dużej flocie.

---

## Instalacja i uruchomienie

### Wymagania wstępne
- **JDK 17+**
- **Node.js 20+** i npm
- **Docker** i Docker Compose
- Działający serwer **OSRM** (domyślnie: `http://router.project-osrm.org`)

### Krok 1: Baza danych

Uruchom PostgreSQL z rozszerzeniem PostGIS za pomocą Docker Compose:

```bash
docker-compose up -d
```

Baza danych będzie dostępna na porcie `5432`.  
pgAdmin będzie dostępny pod adresem `http://localhost:5050` (login: `admin@transflow.com`, hasło: `admin`).

### Krok 2: Backend

```bash
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

API będzie dostępne pod adresem: `http://localhost:8080`

Schemat bazy danych jest tworzony automatycznie przez Hibernate (`spring.jpa.hibernate.ddl-auto`).

### Krok 3: Frontend

```bash
cd frontend-web
npm install
npm run dev
```

Interfejs będzie dostępny pod adresem: `http://localhost:5173`

### Opcjonalnie: Zasilenie danymi początkowymi

Po uruchomieniu systemu możesz skorzystać z panelu **Ustawienia → Demo**, aby jednym kliknięciem:
1. Dodać 25 hubów logistycznych (europejskie stolice)
2. Wygenerować flotę 50 pojazdów z kierowcami (w tym jednostki MSU)
3. Automatycznie wyekspediować wybrane pojazdy na losowe trasy

---

## Funkcjonalności

### Mapa Live
- Widok mapy całej Europy z pozycjami wszystkich pojazdów aktualizowanymi w czasie rzeczywistym
- Kolorowe linie tras: żółta (dojazd do załadunku), niebieska (transit), fioletowa (misja ratunkowa), pomarańczowa (holowanie)
- HUD (Heads-Up Display) z telemetrią pojazdu lub danymi hubu po najechaniu kursorem
- Kreator zleceń inline: kliknij hub → ustaw Punkt A → kliknij drugi hub → ustaw Punkt B → wybierz pojazd

### Zarządzanie flotą
- Pełny CRUD pojazdów i kierowców z walidacją po stronie backendu
- Blokada edycji dla pojazdów i kierowców aktywnych w trakcie trasy
- Optymistyczne blokowanie wersji (`@Version`) chroniące przed wyścigami danych
- Symulacja awarii pojazdu przyciskiem z panelu HUD

### Zarządzanie zleceniami
- Podgląd wszystkich zleceń z filtrowaniem po statusie
- Pełny cykl: `APPROACHING → LOADING → IN_TRANSIT → HANDOVER → COMPLETED`
- Trasy obliczane przez OSRM i przechowywane jako zakodowane poliline

### Sieć logistyczna (Huby)
- CRUD punktów logistycznych z typami: `BASE` (Baza Floty), `PORT` (Terminal), `WAREHOUSE` (Magazyn)
- Wybór lokalizacji przez klikanie na mapę (CoordinatePickerMap)
- Automatyczne dokowanie pojazdów do hubów w promieniu 500 metrów (formuła Haversine'a)

### Silnik symulacji
- Regulacja prędkości czasu od **x1** do **x600**
- Wirtualny zegar startujący od zadanej daty
- Start/Stop symulacji bez utraty stanu

---

## REST API — przegląd endpointów

### Pojazdy — `/api/vehicles`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/vehicles` | Pobierz wszystkie pojazdy |
| `POST` | `/api/vehicles` | Dodaj pojazd |
| `PUT` | `/api/vehicles/{id}` | Zaktualizuj pojazd |
| `DELETE` | `/api/vehicles/{id}` | Usuń pojazd |
| `POST` | `/api/vehicles/{id}/breakdown` | Symuluj awarię pojazdu |

### Kierowcy — `/api/drivers`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/drivers` | Pobierz wszystkich kierowców |
| `POST` | `/api/drivers` | Dodaj kierowcę |
| `PUT` | `/api/drivers/{id}` | Zaktualizuj kierowcę |
| `DELETE` | `/api/drivers/{id}` | Usuń kierowcę |

### Lokalizacje — `/api/locations`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/locations` | Pobierz wszystkie huby |
| `POST` | `/api/locations` | Dodaj hub |
| `PUT` | `/api/locations/{id}` | Zaktualizuj hub |
| `DELETE` | `/api/locations/{id}` | Usuń hub |

### Zlecenia — `/api/orders`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/orders` | Pobierz wszystkie zlecenia |
| `POST` | `/api/orders` | Utwórz zlecenie |
| `GET` | `/api/orders/active-routes` | Pobierz aktywne trasy (polyline) |

### Misje ratunkowe — `/api/rescue-radar`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/rescue-radar/{vehicleId}` | Pobierz kandydatów do misji ratunkowej |
| `POST` | `/api/rescue-radar/assign` | Przypisz jednostkę MSU ręcznie |
| `POST` | `/api/rescue-radar/{vehicleId}/auto-assign` | Automatycznie przypisz najlepszą MSU |

### Symulacja — `/api/simulation`
| Metoda | Endpoint | Opis |
|---|---|---|
| `GET` | `/api/simulation/status` | Pobierz stan silnika (running, multiplier) |
| `POST` | `/api/simulation/toggle` | Uruchom / zatrzymaj symulację |
| `POST` | `/api/simulation/speed?multiplier={n}` | Ustaw mnożnik czasu (1–600) |

### Logi paliwowe — `/api/fuel`
| Metoda | Endpoint | Opis |
|---|---|---|
| `POST` | `/api/fuel` | Zarejestruj tankowanie (z walidacją anomalii) |

### Demo — `/api/demo`
| Metoda | Endpoint | Opis |
|---|---|---|
| `POST` | `/api/demo/seed-locations` | Dodaj 25 europejskich hubów |
| `POST` | `/api/demo/seed-fleet` | Wygeneruj flotę 50 pojazdów + kierowców |
| `POST` | `/api/demo/auto-dispatch?count={n}` | Automatycznie wyekspediuj n pojazdów |
| `POST` | `/api/demo/clear-all` | Wyczyść wszystkie dane (TRUNCATE) |

---

## Komunikacja w czasie rzeczywistym

Backend emituje zdarzenia do tematu WebSocket `/topic/updates` przy każdej zmianie stanu. Frontend subskrybuje ten kanał i reaguje na konkretne typy zdarzeń:

| Zdarzenie | Akcja frontendowa |
|---|---|
| `VEHICLES` | Odświeżenie danych pojazdów z backendu |
| `ORDERS` | Odświeżenie listy zleceń |
| `DRIVERS` | Odświeżenie listy kierowców |
| `LOCATIONS` | Odświeżenie listy hubów |
| `ROUTES` | Odświeżenie aktywnych tras (polilinie) |

Silnik symulacji emituje ponadto ticki pozycji w `SimulationStateDTO` co **2 sekundy**, zawierające zaktualizowane współrzędne wszystkich pojazdów oraz aktualny czas wirtualny. Frontend stosuje mechanizm **anty-migotania**: pozycje z WebSocket są priorytetyzowane nad danymi z REST przez 3 sekundy od ostatniego odbioru pakietu kinetycznego.

Endpoint WebSocket: `ws://localhost:8080/ws-trucks`  
Protokół: STOMP over SockJS

---

## Silnik symulacji

Silnik uruchomiony jest jako zaplanowane zadanie (`@Scheduled`) wykonywane co 2 sekundy. W każdym ticku:

1. **Pobiera aktywne zlecenia** ze wszystkich obsługiwanych stanów
2. **Oblicza dystans** pokonany w danym ticku: `v = (speedMultiplier × 80 km/h) × Δt`
3. **Dekoduje polilinie** OSRM i interpoluje dokładną pozycję geograficzną pojazdu wzdłuż geometrii drogi
4. **Deleguje logikę biznesową** do odpowiedniego `OrderStateHandler` (wzorzec Strategy)
5. **Emituje zaktualizowany stan** przez STOMP do wszystkich podłączonych klientów
6. **Przesuwa wirtualny zegar** o `realSecondsPassed × multiplier` sekund

### Wirtualny zegar

`VirtualClock` startuje od `2026-03-03 08:00`. Przy mnożniku **x600** jedna sekunda rzeczywista odpowiada 10 minutom wirtualnym, co pozwala symulować wielodniowe trasy europejskie w kilka minut.

### Stany pojazdu

```
AVAILABLE → BUSY (zlecenie przypisane)
BUSY → BROKEN (awaria)
BROKEN → WAITING_FOR_TOW (MSU przypisana)
WAITING_FOR_TOW → BEING_TOWED (MSU w drodze)
BEING_TOWED → AVAILABLE (pojazd odholowany do bazy)
```

---

## System misji ratunkowych (Rescue Radar)

Po zgłoszeniu awarii pojazdu (`/breakdown`) system uruchamia algorytm doboru jednostki MSU (Mobile Service Unit):

1. **Filtruje** wszystkie pojazdy oznaczone jako `isServiceUnit = true`
2. **Szacuje dystans** każdej MSU do miejsca awarii, uwzględniając jej aktualny stan (`AVAILABLE`, `BUSY` — po zakończeniu obecnego zadania)
3. **Oblicza rzeczywistą trasę** przez OSRM dla top 3 kandydatów
4. **Wybiera MSU** o najkrótszym rzeczywistym dystansie całkowitym
5. **Tworzy zlecenie techniczne** `RESCUE_APPROACHING` lub kolejkuje misję (`nextTowTargetId`)

MSU obsługuje kolejkowanie — może mieć zaplanowaną następną misję już w trakcie realizacji bieżącej.

---

## Tryb Demo

Panel **Ustawienia** oferuje zestaw narzędzi do szybkiego zasilenia systemu danymi:

- **Seed Locations** — dodaje 25 hubów logistycznych w europejskich stolicach z typami BASE / PORT / WAREHOUSE
- **Seed Fleet** — generuje 50 pojazdów (w tym 5 jednostek MSU Volvo FMX Recovery) z automatycznie przypisanymi kierowcami
- **Auto-Dispatch** — asynchronicznie negocjuje trasy z OSRM i wyekspediowuje wybraną liczbę pojazdów; postęp wyświetlany jest w czasie rzeczywistym
- **Clear All** — czyści wszystkie tabele (`TRUNCATE ... RESTART IDENTITY CASCADE`)

---

## Struktura katalogów

```
transflow/
├── docker-compose.yml              # PostgreSQL + pgAdmin
├── Query.sql                       # Przykładowe dane startowe (INSERT)
├── test.http                       # Przykładowe żądania HTTP do testów
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/transflow/backend/
│       ├── BackendApplication.java
│       ├── config/
│       │   └── WebSocketConfig.java
│       ├── fleet/
│       │   ├── Driver.java / DriverController.java / DriverDTO.java / DriverRepository.java
│       │   └── Vehicle.java / VehicleController.java / VehicleDTO.java / VehicleRepository.java
│       ├── logistics/
│       │   ├── Location.java / LocationController.java / LocationRepository.java
│       │   ├── Order.java / OrderController.java / OrderService.java / OrderRepository.java
│       │   ├── RoutingService.java
│       │   ├── RescueRadarController.java / RescueRadarService.java
│       │   └── (DTO records...)
│       ├── simulation/
│       │   ├── SimulationEngine.java
│       │   ├── PhysicsService.java
│       │   ├── VirtualClock.java
│       │   ├── SimulationController.java
│       │   └── strategy/
│       │       ├── OrderStateHandler.java (interface)
│       │       ├── CommercialTransportHandler.java
│       │       ├── RescueOperationHandler.java
│       │       ├── TowingOperationHandler.java
│       │       └── SimulationUpdateContext.java
│       ├── finance/
│       │   └── FuelLog.java / FuelLogController.java / FuelLogService.java
│       ├── demo/
│       │   └── DemoController.java / DemoService.java
│       └── exception/
│           ├── ErrorResponse.java
│           └── GlobalExceptionHandler.java
└── frontend-web/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── api/
        │   ├── apiClient.ts
        │   ├── fleetApi.ts
        │   ├── logisticsApi.ts
        │   ├── simulationApi.ts
        │   └── demoApi.ts
        ├── context/
        │   ├── SimulationContext.tsx
        │   ├── useSimulationData.ts
        │   ├── useSimulationSocket.ts
        │   └── ToastContext.tsx
        ├── components/
        │   ├── MainLayout.tsx
        │   ├── map/
        │   │   ├── MapCanvas.tsx
        │   │   ├── MapContext.tsx
        │   │   ├── MapResizer.tsx
        │   │   ├── SimulationControls.tsx
        │   │   ├── layers/
        │   │   │   ├── VehicleLayer.tsx
        │   │   │   ├── LocationLayer.tsx
        │   │   │   └── RouteLayer.tsx
        │   │   └── overlays/
        │   │       ├── InfoHUD.tsx
        │   │       ├── ActiveOrdersPanel.tsx
        │   │       └── OrderBuilder.tsx
        │   ├── drivers/DriverManager.tsx
        │   ├── vehicles/VehicleManager.tsx
        │   ├── locations/
        │   │   ├── LocationManager.tsx
        │   │   └── CoordinatePickerMap.tsx
        │   ├── orders/OrderManager.tsx
        │   └── settings/SettingsManager.tsx
        └── utils/
            └── mapUtils.ts
```

---

*TransFlow TMS — Engineering a smarter flow of logistics.*