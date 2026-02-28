import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Unwrap ApiResponse data if present
api.interceptors.response.use(
    (response) => {
        // If the response body has the ApiResponse structure { ok: true, data: ... }
        if (response.data && typeof response.data === 'object' && 'ok' in response.data) {
            if (response.data.ok) {
                return { ...response, data: response.data.data };
            }
        }
        return response;
    },
    (error) => {
        // Handle API errors consistently
        return Promise.reject(error);
    }
);

export default api;

export const tenantsService = {
    getAll: () => api.get('/admin/tenants'),
    create: (data: any) => api.post('/admin/tenants', data),
    update: (id: string, data: any) => api.patch(`/admin/tenants/${id}`, data),
    resetPin: (id: string, data?: { pin: string }) => api.post(`/admin/tenants/${id}/pin-reset`, data),
    getBatches: (id: string) => api.get(`/admin/tenants/${id}/premium-batches`),
    getBatchDetails: (id: string, batchId: string) => api.get(`/admin/tenants/${id}/premium-batches/${batchId}`),
    createBatch: (id: string, data: { quantity: number; label?: string }) =>
        api.post(`/admin/tenants/${id}/premium-batches`, data),
    delete: (id: string) => api.delete(`/admin/tenants/${id}`),
    exportBatch: (id: string, batchId: string) => api.get(`/admin/tenants/${id}/premium-batches/${batchId}/export`, { responseType: 'blob' }),
    getDevices: (id: string) => api.get(`/admin/tenants/${id}/devices`),
    createDevice: (id: string, data: { name: string; mode: string; telegram_chat_id?: string; responsible_name?: string }) => api.post(`/admin/tenants/${id}/devices`, data),
    updateDevice: (tenantId: string, deviceId: string, data: Partial<{ name: string; mode: string; telegram_chat_id: string; responsible_name: string }>) => api.put(`/admin/tenants/${tenantId}/devices/${deviceId}`, data),
    deleteDevice: (id: string, deviceId: string) => api.delete(`/admin/tenants/${id}/devices/${deviceId}`),
    getGlobalMetrics: () => api.get('/admin/metrics'),
};

export const contactsService = {
    getAll: (params?: any) => api.get('/client/contacts', { params }),
    create: (data: any) => api.post('/client/contacts', data),
    update: (id: string, data: any) => api.patch(`/client/contacts/${id}`, data),
    delete: (id: string) => api.delete(`/client/contacts/${id}`),
};

export const loyaltyService = {
    getSettings: () => api.get('/client/loyalty/settings'),
    updateSettings: (data: any) => api.patch('/client/loyalty/settings', data),
    getHistory: (params?: any) => api.get('/client/loyalty/history', { params }),
};

export const terminalService = {
    getInfo: (slug: string, uid?: string | null, token?: string | null) => uid
        ? api.get(`/public/terminal/${slug}/${uid}`, { params: { token } })
        : api.get(`/public/p/${slug}`, { params: { token } }),
    lookup: (slug: string, uid: string | null, phone: string, token?: string | null) => uid
        ? api.post(`/public/terminal/${slug}/${uid}/lookup`, { phone, token })
        : api.post(`/public/p/${slug}/lookup`, { phone, token }),
    validatePin: (slug: string, uid: string) =>
        api.post(`/public/terminal/${slug}/${uid}/validate-pin`),
    earn: (slug: string, uid: string | null, phone: string, token?: string | null) => uid
        ? api.post(`/public/terminal/${slug}/${uid}/earn`, { phone, token })
        : api.post(`/public/p/${slug}/earn`, { phone, token }),
    autoEarn: (slug: string, uid: string) =>
        api.post(`/public/terminal/${slug}/${uid}/auto-earn`),
    redeem: (slug: string, uid: string | null, phone: string, token?: string | null) => uid
        ? api.post(`/public/terminal/${slug}/${uid}/redeem`, { phone, token })
        : api.post(`/public/p/${slug}/redeem`, { phone, token }),
    register: (slug: string, uid: string | null, data: { name: string, phone: string, email?: string, city?: string, province?: string, postal_code?: string, address?: string, birthday?: string }) => uid
        ? api.post(`/public/terminal/${slug}/${uid}/register`, data)
        : api.post(`/public/p/${slug}/register`, data),
    linkVip: (slug: string, uid: string, data: { phone: string, target_uid: string }) =>
        api.post(`/public/terminal/${slug}/${uid}/link-vip`, data),
    getRequestStatus: (slug: string, uid: string | null, requestId: string) => uid
        ? api.get(`/public/terminal/${slug}/${uid}/point-requests/${requestId}/status`)
        : api.get(`/public/p/${slug}/point-requests/${requestId}/status`),
};
