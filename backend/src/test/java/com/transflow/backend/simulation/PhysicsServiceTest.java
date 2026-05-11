package com.transflow.backend.simulation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PhysicsServiceTest {

    private final PhysicsService physicsService = new PhysicsService();

    @Test
    void shouldCalculateDistanceAccurately() {
        double lat1 = 52.2297;
        double lon1 = 21.0122;
        double lat2 = 50.0647;
        double lon2 = 19.9450;

        double distance = physicsService.calculateDistance(lat1, lon1, lat2, lon2);

        assertTrue(distance > 240.0 && distance < 260.0);
    }

    @Test
    void shouldReturnZeroDistanceForSameCoordinates() {
        double distance = physicsService.calculateDistance(52.2297, 21.0122, 52.2297, 21.0122);

        assertEquals(0.0, distance, 0.001);
    }

    @Test
    void shouldReturnZeroCoordinatesForNullOrEmptyPolyline() {
        double[] posNull = physicsService.getPositionAtDistance(null, 100.0);
        double[] posEmpty = physicsService.getPositionAtDistance("", 100.0);

        assertEquals(0.0, posNull[0]);
        assertEquals(0.0, posNull[1]);
        assertEquals(0.0, posEmpty[0]);
        assertEquals(0.0, posEmpty[1]);
    }

    @Test
    void shouldReturnFirstPointIfDistanceIsZeroOrNegative() {
        String polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

        double[] posZero = physicsService.getPositionAtDistance(polyline, 0.0);
        double[] posNegative = physicsService.getPositionAtDistance(polyline, -50.0);

        assertTrue(posZero[0] != 0.0 && posZero[1] != 0.0);
        assertEquals(posZero[0], posNegative[0]);
        assertEquals(posZero[1], posNegative[1]);
    }

    @Test
    void shouldReturnLastPointIfDistanceExceedsPolylineLength() {
        String polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

        double[] posExact = physicsService.getPositionAtDistance(polyline, 9999999.0);

        assertTrue(posExact[0] != 0.0 && posExact[1] != 0.0);
    }

    @Test
    void shouldInterpolatePositionCorrectlyWithinSegment() {
        String polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

        double[] posStart = physicsService.getPositionAtDistance(polyline, 0.0);
        double[] posMid = physicsService.getPositionAtDistance(polyline, 100.0);

        assertTrue(posMid[0] != posStart[0] || posMid[1] != posStart[1]);
    }
}