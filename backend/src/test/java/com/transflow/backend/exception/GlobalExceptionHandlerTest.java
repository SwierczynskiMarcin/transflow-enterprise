package com.transflow.backend.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler exceptionHandler = new GlobalExceptionHandler();

    @Test
    @DisplayName("Should verify that GlobalExceptionHandler is annotated with RestControllerAdvice")
    void shouldHaveProperAnnotation() {
        assertTrue(GlobalExceptionHandler.class.isAnnotationPresent(RestControllerAdvice.class));
    }

    @Test
    @DisplayName("Should return 400 Bad Request for IllegalArgumentException")
    void handleIllegalArgumentException() {
        String errorMessage = "Invalid input parameter";
        IllegalArgumentException exception = new IllegalArgumentException(errorMessage);

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgument(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(400, Objects.requireNonNull(response.getBody()).status());
        assertEquals(errorMessage, response.getBody().message());
    }

    @Test
    @DisplayName("Should handle IllegalArgumentException with null message")
    void handleIllegalArgumentExceptionNullMessage() {
        IllegalArgumentException exception = new IllegalArgumentException((String) null);

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgument(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNull(Objects.requireNonNull(response.getBody()).message());
    }

    @Test
    @DisplayName("Should return 409 Conflict for ObjectOptimisticLockingFailureException")
    void handleOptimisticLockingFailure() {
        ObjectOptimisticLockingFailureException exception = new ObjectOptimisticLockingFailureException("Vehicle", 1L);
        String expectedMessage = "Konflikt wersji: Obiekt został zmodyfikowany w tle przez inny proces. Odśwież dane i spróbuj ponownie.";

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleOptimisticLocking(exception);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(409, Objects.requireNonNull(response.getBody()).status());
        assertEquals(expectedMessage, response.getBody().message());
    }

    @Test
    @DisplayName("Should return 500 Internal Server Error for general RuntimeException")
    void handleGeneralRuntimeException() {
        String secretErrorMessage = "Database connection timed out";
        RuntimeException exception = new RuntimeException(secretErrorMessage);

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleRuntime(exception);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(500, Objects.requireNonNull(response.getBody()).status());
        assertEquals(secretErrorMessage, response.getBody().message());
    }

    @Test
    @DisplayName("Should handle specialized RuntimeExceptions like NullPointerException")
    void handleNullPointerException() {
        NullPointerException exception = new NullPointerException("Null reference encountered");

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleRuntime(exception);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(500, Objects.requireNonNull(response.getBody()).status());
        assertEquals("Null reference encountered", response.getBody().message());
    }

    @Test
    @DisplayName("Should handle very long error messages without truncation")
    void handleStressMessageLength() {
        String longMessage = "A".repeat(10000);
        IllegalArgumentException exception = new IllegalArgumentException(longMessage);

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgument(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(longMessage, Objects.requireNonNull(response.getBody()).message());
    }

    @Test
    @DisplayName("Should handle empty error messages")
    void handleEmptyMessage() {
        RuntimeException exception = new RuntimeException("");

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleRuntime(exception);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("", Objects.requireNonNull(response.getBody()).message());
    }
}