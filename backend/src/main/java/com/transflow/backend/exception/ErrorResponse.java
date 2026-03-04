package com.transflow.backend.exception;

public record ErrorResponse(int status, String message) {}