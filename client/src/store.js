import { create } from 'zustand';

const API_BASE = '/api';

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(path, options = {}) {
    const token = useAuthStore.getState().token;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(data.error || 'Request failed', res.status);
    }

    return res.json();
}

export const useAuthStore = create((set, get) => ({
    token: localStorage.getItem('mikus_token') || null,
    user: null,
    loading: false,
    error: null,

    login: async (username, password) => {
        set({ loading: true, error: null });
        try {
            const data = await request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
            localStorage.setItem('mikus_token', data.token);
            set({ token: data.token, user: data.user, loading: false });
            return data;
        } catch (err) {
            set({ error: err.message, loading: false });
            throw err;
        }
    },

    logout: () => {
        localStorage.removeItem('mikus_token');
        set({ token: null, user: null });
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
        return request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
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
