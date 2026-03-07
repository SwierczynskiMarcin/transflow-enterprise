TransFlow TMS Enterprise
Real-Time Digital Twin and Transport Management System

    Project Overview and Vision

TransFlow TMS is an enterprise-grade Digital Twin platform designed for real-time fleet monitoring, logistics planning, and transport process simulation. Unlike standard management systems, TransFlow utilizes a high-throughput simulation engine that maps physical transport cycles onto a virtual data model. The system is engineered for extreme performance, capable of handling hundreds of active units simultaneously while maintaining a clean, modular architecture.

    Getting Started: Installation and Setup

To run the TransFlow environment locally, ensure you have the following prerequisites installed:

    Java Development Kit (JDK) 17 or higher

    Node.js 20 or higher and npm

    Docker and Docker Compose

Step 1: Database Infrastructure
The system uses PostgreSQL with the PostGIS extension. Start the database container using the provided configuration:

    Command: docker-compose up -d

    Default credentials: User 'postgres', Password 'password', Database 'transflow'

Step 2: Backend Application
The backend handles the simulation logic and REST API. Navigate to the backend directory and execute:

    Compilation: mvn clean install

    Execution: mvn spring-boot:run

    Access: The API will be available at http://localhost:8080

Step 3: Frontend Web Interface
The interface is built with React 19 and Vite. Navigate to the frontend-web directory and execute:

    Dependency Installation: npm install

    Development Server: npm run dev

    Access: The dashboard will be available at http://localhost:5173

    Backend Architecture: Java 17 and Spring Boot

The backend is structured using Domain-Driven Design principles, ensuring that each business domain remains independent and scalable.

Domain breakdown:

    Fleet Domain: Manages the lifecycle of vehicles and drivers. It handles technical specifications and implements soft-unlinking logic to protect historical data.

    Logistics Domain: Responsible for order processing, hub management, and integration with the Open Source Routing Machine (OSRM).

    Simulation Core: The mathematical heart of the platform. It processes vehicle physics and motion independently of business logic.

    Infrastructure: Manages global configurations, WebSocket streaming via STOMP, and unified error handling through a global exception handler.

    The Simulation Engine: Digital Twin Mechanics

The engine calculates vehicle positions based on actual road geometries rather than simple linear interpolation.

Kinematics and Physics:

    Polyline Decoding: The engine transforms encoded road geometries from OSRM into precise geographical coordinates.

    Distance Interpolation: During each two-second simulation tick, the system calculates the distance covered based on the current time multiplier. It then traverses the polyline to find the exact coordinate matching that distance.

    Virtual Clock: The system operates on a synchronized virtual time. Speed can be adjusted from x1 to x600, allowing for multi-day logistics stress tests to be completed in minutes.

    Frontend Architecture: React 19 and TypeScript

The frontend utilizes a layered rendering architecture to ensure high performance and a smooth user experience.

State Management and Rendering:

    Context Splitting: UI state management is divided into MapContext (for transient interactions like hovers and selections) and SimulationContext (for global data).

    Layered Map Rendering: Static hub markers and dynamic vehicle markers are rendered in separate layers. This isolation allows the browser to maintain 60 FPS even as the fleet size grows.

    Path Isolation: To prevent memory leaks, road geometries are rendered exclusively for the selected or hovered vehicle.

User Experience (UX):

    Heads-Up Display (HUD): A modern information panel in the bottom-right corner replaces traditional map popups. This provides a clear view of telemetry data without obstructing the map.

    Non-blocking Notifications: System alerts use a Toast notification system instead of blocking modal windows.

    Collapsible Interface: Secondary panels can be minimized to provide a clear view of the continental logistics map.

    Intelligent Logistics Features

Smart Hub Docking:
Using the Haversine formula, the system automatically detects when a vehicle is within 500 meters of a logistics hub. Static vehicles are automatically "docked" and displayed within the terminal's operational panel.

Auto-Dispatcher:
A specialized tool for stress testing. It manages asynchronous route negotiations with routing servers and provides real-time progress feedback as it dispatches large numbers of vehicles into the simulation.

TransFlow TMS - Engineering a smarter flow of logistics.