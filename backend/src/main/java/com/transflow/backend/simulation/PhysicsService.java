package com.transflow.backend.simulation;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PhysicsService {

    private final Map<String, List<double[]>> polylineCache = Collections.synchronizedMap(
            new LinkedHashMap<String, List<double[]>>(100, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, List<double[]>> eldest) {
                    return size() > 1000;
                }
            }
    );

    public double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double theta = lon1 - lon2;
        double dist = Math.sin(Math.toRadians(lat1)) * Math.sin(Math.toRadians(lat2)) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.cos(Math.toRadians(theta));
        dist = Math.acos(Math.min(1.0, dist));
        dist = Math.toDegrees(dist);
        return dist * 60 * 1.1515 * 1.609344;
    }

    public double[] getPositionAtDistance(String polylineStr, double targetDistance) {
        List<double[]> polyline = decodePolylineCached(polylineStr);
        if (polyline == null || polyline.isEmpty()) return new double[]{0, 0};
        if (polyline.size() == 1 || targetDistance <= 0) return polyline.get(0);

        double currentDist = 0.0;
        for (int i = 0; i < polyline.size() - 1; i++) {
            double[] p1 = polyline.get(i);
            double[] p2 = polyline.get(i + 1);
            double segDist = calculateDistance(p1[0], p1[1], p2[0], p2[1]) * 1000.0;

            if (currentDist + segDist >= targetDistance) {
                double over = targetDistance - currentDist;
                double ratio = over / segDist;
                double lat = p1[0] + (p2[0] - p1[0]) * ratio;
                double lng = p1[1] + (p2[1] - p1[1]) * ratio;
                return new double[]{lat, lng};
            }
            currentDist += segDist;
        }
        return polyline.get(polyline.size() - 1);
    }

    private List<double[]> decodePolylineCached(String encoded) {
        if (encoded == null || encoded.isEmpty()) return new ArrayList<>();
        return polylineCache.computeIfAbsent(encoded, this::decodePolyline);
    }

    private List<double[]> decodePolyline(String encoded) {
        List<double[]> poly = new ArrayList<>();
        int index = 0, len = encoded.length();
        int lat = 0, lng = 0;
        while (index < len) {
            int b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            shift = 0; result = 0;
            do {
                b = encoded.charAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            poly.add(new double[]{(((double) lat / 1E5)), (((double) lng / 1E5))});
        }
        return poly;
    }
}