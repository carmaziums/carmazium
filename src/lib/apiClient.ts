import { getAccessToken } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com';

export async function apiClient<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAccessToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
        const error = await response.json().catch(() => ({ message: 'Unauthorized' }));
        console.error('Frontend API 401 Detail:', error);

        if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/auth/login';
            }
        }
        throw new Error(error.message || 'Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API Error' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}
