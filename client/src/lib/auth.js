import { api } from './api.js';

export const auth = {
  login: async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    if (data.success) localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  logout: async () => {
    try { await api.post('/api/auth/logout', {}); } catch {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  },

  getUser: () => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated: () => !!localStorage.getItem('user'),
};
