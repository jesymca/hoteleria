// API Client Wrapper - Centralized HTTP client for Serverless Functions
import { State } from './state.js';

export const API = {
    async request(endpoint, options = {}) {
        const url = `/api/${endpoint.replace(/^\//, '')}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = State.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 401 && !url.includes('/auth/login')) {
                    // Session expired
                    State.clearSession();
                    window.location.hash = '#login';
                    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
                }
                throw new Error(data.error || `Error ${response.status}: Ocurrió un fallo en la solicitud.`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
