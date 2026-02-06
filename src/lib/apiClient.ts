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
        if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            // We don't necessarily want a hard redirect here to avoid looping, 
            // but the user requested it. Let's redirect if not already on login.
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/auth/login';
            }
        }
        const error = await response.json().catch(() => ({ message: 'Unauthorized' }));
        throw new Error(error.message || 'Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'API Error' }));
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}
