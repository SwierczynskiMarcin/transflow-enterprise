package com.transflow.backend.logistics;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoutingServiceTest {

    @InjectMocks
    private RoutingService routingService;

    @Mock
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(routingService, "restTemplate", restTemplate);
    }

    @Test
    @DisplayName("Should successfully parse and return route info from OSRM response")
    void shouldReturnRouteInfoOnSuccess() {
        Map<String, Object> route = Map.of(
                "geometry", "encoded_polyline",
                "distance", 15000.5
        );
        Map<String, Object> response = Map.of(
                "code", "Ok",
                "routes", List.of(route)
        );

        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertEquals("encoded_polyline", result.polyline());
        assertEquals(15000.5, result.distance());
    }

    @Test
    @DisplayName("Should return null and not crash when RestClientException is thrown (e.g., Timeout)")
    void shouldReturnNullOnRestClientException() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenThrow(new RestClientException("Connection Timeout"));

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }

    @Test
    @DisplayName("Should return null when OSRM API returns an error code like NoRoute")
    void shouldReturnNullOnInvalidResponseCode() {
        Map<String, Object> response = Map.of(
                "code", "NoRoute",
                "routes", Collections.emptyList()
        );

        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }

    @Test
    @DisplayName("Should return null when external API response is completely null")
    void shouldReturnNullWhenResponseIsNull() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(null);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }

    @Test
    @DisplayName("Should return null when the routes array is present but empty")
    void shouldReturnNullWhenRoutesListIsEmpty() {
        Map<String, Object> response = Map.of(
                "code", "Ok",
                "routes", Collections.emptyList()
        );

        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }

    @Test
    @DisplayName("Should return null when the routes key exists but the value is null")
    void shouldReturnNullWhenRoutesListIsNull() {
        Map<String, Object> response = Collections.singletonMap("code", "Ok");

        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }

    @Test
    @DisplayName("Should catch internal ClassCastException/NullPointerException and return null if external API changes structure")
    void shouldHandleMalformedResponseWithoutCrashing() {
        Map<String, Object> malformedRoute = Collections.singletonMap("geometry", "encoded_polyline");
        Map<String, Object> response = Map.of(
                "code", "Ok",
                "routes", List.of(malformedRoute)
        );

        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(response);

        RoutingService.RouteInfo result = routingService.getRoute(52.0, 21.0, 51.0, 20.0);

        assertNull(result);
    }
}