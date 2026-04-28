import axios from 'axios';

// In dev: VITE_API_URL is not set → Vite proxy rewrites /api → localhost:4000
// In prod: VITE_API_URL = https://stockpro-backend.onrender.com
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Only auto-logout on 401 for protected routes, NOT for the login route itself
    const url = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
