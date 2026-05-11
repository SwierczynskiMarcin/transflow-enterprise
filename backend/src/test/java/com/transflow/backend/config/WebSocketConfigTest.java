package com.transflow.backend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketConfigTest {

    @InjectMocks
    private WebSocketConfig webSocketConfig;

    @Mock
    private MessageBrokerRegistry messageBrokerRegistry;

    @Mock
    private StompEndpointRegistry stompEndpointRegistry;

    @Mock
    private StompWebSocketEndpointRegistration registration;

    @Test
    @DisplayName("Should have required Spring annotations for WebSocket configuration")
    void shouldHaveRequiredAnnotations() {
        Class<WebSocketConfig> configClass = WebSocketConfig.class;

        assertTrue(configClass.isAnnotationPresent(Configuration.class));
        assertTrue(configClass.isAnnotationPresent(EnableWebSocketMessageBroker.class));
    }

    @Test
    @DisplayName("Should configure message broker with correct prefixes and broker")
    void shouldConfigureMessageBrokerSuccessfully() {
        webSocketConfig.configureMessageBroker(messageBrokerRegistry);

        verify(messageBrokerRegistry).enableSimpleBroker("/topic");
        verify(messageBrokerRegistry).setApplicationDestinationPrefixes("/app");
        verifyNoMoreInteractions(messageBrokerRegistry);
    }

    @Test
    @DisplayName("Should register STOMP endpoints with SockJS and allowed origins")
    void shouldRegisterStompEndpointsSuccessfully() {
        when(stompEndpointRegistry.addEndpoint("/ws-trucks")).thenReturn(registration);
        when(registration.setAllowedOriginPatterns("*")).thenReturn(registration);

        webSocketConfig.registerStompEndpoints(stompEndpointRegistry);

        InOrder inOrder = inOrder(stompEndpointRegistry, registration);
        inOrder.verify(stompEndpointRegistry).addEndpoint("/ws-trucks");
        inOrder.verify(registration).setAllowedOriginPatterns("*");
        inOrder.verify(registration).withSockJS();
    }

    @Test
    @DisplayName("Should verify specific path strings through direct verification")
    void shouldVerifySpecificPathStrings() {
        webSocketConfig.configureMessageBroker(messageBrokerRegistry);

        verify(messageBrokerRegistry).enableSimpleBroker("/topic");
        verify(messageBrokerRegistry).setApplicationDestinationPrefixes("/app");
    }
}