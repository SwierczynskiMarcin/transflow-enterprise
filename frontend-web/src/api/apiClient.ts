const BASE_URL = 'http://localhost:8080/api';

export const apiClient = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        let errorMessage = 'Wystąpił nieoczekiwany błąd serwera.';
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch {
            try {
                const textError = await response.text();
                errorMessage = textError || errorMessage;
            } catch {}
        }
        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};