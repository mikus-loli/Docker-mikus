import { create } from 'zustand';

const API_BASE = '/api';

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach((cb) => cb(newToken));
    refreshSubscribers = [];
}

async function refreshToken() {
    const refreshToken = localStorage.getItem('mikus_refresh_token');
    if (!refreshToken) {
        throw new ApiError('No refresh token', 401);
    }
    const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
        throw new ApiError('Refresh failed', 401);
    }
    return res.json();
}

async function request(path, options = {}) {
    const token = useAuthStore.getState().token;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && token) {
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                const data = await refreshToken();
                localStorage.setItem('mikus_token', data.token);
                localStorage.setItem('mikus_refresh_token', data.refreshToken);
                useAuthStore.getState().setTokens(data.token, data.refreshToken);
                isRefreshing = false;
                onTokenRefreshed(data.token);
            } catch {
                isRefreshing = false;
                refreshSubscribers = [];
                useAuthStore.getState().logout();
                window.location.href = '/login';
                throw new ApiError('Session expired', 401);
            }
        }

        return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newToken) => {
                const retryHeaders = {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${newToken}`,
                    ...options.headers,
                };
                fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders })
                    .then((retryRes) => {
                        if (!retryRes.ok) {
                            retryRes.json().then((d) => reject(new ApiError(d.error || 'Request failed', retryRes.status))).catch(() => reject(new ApiError('Request failed', retryRes.status)));
                        } else {
                            retryRes.json().then(resolve).catch(() => resolve(null));
                        }
                    })
                    .catch(reject);
            });
        });
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(data.error || 'Request failed', res.status);
    }

    return res.json();
}

export const useAuthStore = create((set, get) => ({
    token: localStorage.getItem('mikus_token') || null,
    refreshToken: localStorage.getItem('mikus_refresh_token') || null,
    user: null,
    loading: false,
    error: null,

    setTokens: (token, refreshToken) => set({ token, refreshToken }),

    login: async (username, password) => {
        set({ loading: true, error: null });
        try {
            const data = await request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
            localStorage.setItem('mikus_token', data.token);
            localStorage.setItem('mikus_refresh_token', data.refreshToken);
            set({ token: data.token, refreshToken: data.refreshToken, user: data.user, loading: false });
            return data;
        } catch (err) {
            set({ error: err.message, loading: false });
            throw err;
        }
    },

    logout: async () => {
        const token = get().token;
        const refreshToken = get().refreshToken;
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ refreshToken }),
            });
        } catch {}
        localStorage.removeItem('mikus_token');
        localStorage.removeItem('mikus_refresh_token');
        set({ token: null, refreshToken: null, user: null });
    },

    fetchUser: async () => {
        if (!get().token) return;
        try {
            const user = await request('/auth/me');
            set({ user });
        } catch {
            get().logout();
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        const data = await request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (data.token) {
            localStorage.setItem('mikus_token', data.token);
            localStorage.setItem('mikus_refresh_token', data.refreshToken);
            set({ token: data.token, refreshToken: data.refreshToken });
        }
        return data;
    },
}));

export const useStackStore = create((set) => ({
    stacks: [],
    loading: false,
    error: null,
    currentStack: null,

    fetchStacks: async () => {
        set({ loading: true, error: null });
        try {
            const stacks = await request('/stacks');
            set({ stacks, loading: false });
        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },

    fetchStack: async (name) => {
        set({ loading: true, error: null });
        try {
            const stack = await request(`/stacks/${name}`);
            set({ currentStack: stack, loading: false });
        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },

    createStack: async (name, compose, env) => {
        const stack = await request('/stacks', {
            method: 'POST',
            body: JSON.stringify({ name, compose, env }),
        });
        return stack;
    },

    updateStack: async (name, compose, env) => {
        const stack = await request(`/stacks/${name}`, {
            method: 'PUT',
            body: JSON.stringify({ compose, env }),
        });
        return stack;
    },

    deleteStack: async (name) => {
        await request(`/stacks/${name}`, { method: 'DELETE' });
    },

    stackAction: async (name, action, service = null) => {
        return request(`/stacks/${name}/${action}`, {
            method: 'POST',
            body: JSON.stringify({ service }),
        });
    },

    getStackCompose: async (name) => {
        return request(`/stacks/${name}/compose`);
    },

    getStackServices: async (name) => {
        return request(`/stacks/${name}/services`);
    },

    clearCurrentStack: () => set({ currentStack: null }),
}));

export const useContainerStore = create((set) => ({
    containers: [],
    loading: false,

    fetchContainers: async (all = true) => {
        set({ loading: true });
        try {
            const containers = await request(`/containers?all=${all}`);
            set({ containers, loading: false });
        } catch {
            set({ loading: false });
        }
    },

    containerAction: async (id, action) => {
        if (action === 'remove') {
            return request(`/containers/${id}`, { method: 'DELETE' });
        }
        return request(`/containers/${id}/${action}`, { method: 'POST' });
    },

    getContainerLogs: async (id, tail = 200) => {
        return request(`/containers/${id}/logs?tail=${tail}`);
    },
}));

export const useSystemStore = create((set) => ({
    info: null,

    fetchSystemInfo: async () => {
        try {
            const info = await request('/system/info');
            set({ info });
        } catch {}
    },
}));

export { ApiError };
