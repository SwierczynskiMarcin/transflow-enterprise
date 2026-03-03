package com.transflow.backend.logistics;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RoutingService {

    private final RestTemplate restTemplate = new RestTemplate();

    public RouteInfo getRoute(double startLat, double startLng, double endLat, double endLng) {
        String url = String.format(Locale.US,
                "http://router.project-osrm.org/route/v1/driving/%f,%f;%f,%f?overview=full&geometries=polyline",
                startLng, startLat, endLng, endLat);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response != null && "Ok".equals(response.get("code"))) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> routes = (List<Map<String, Object>>) response.get("routes");
                if (routes != null && !routes.isEmpty()) {
                    Map<String, Object> route = routes.get(0);
                    String geometry = (String) route.get("geometry");
                    Double distance = ((Number) route.get("distance")).doubleValue();
                    return new RouteInfo(geometry, distance);
                }
            }
        } catch (Exception e) {
            System.err.println("Błąd pobierania trasy z OSRM: " + e.getMessage());
        }
        return null;
    }

    public record RouteInfo(String polyline, Double distance) {}
}