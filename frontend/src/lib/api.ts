import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

let token: string | null = null;

export const setAuthToken = (newToken: string | null) => {
  token = newToken;
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use a synchronous interceptor that reads the token from the module's scope
api.interceptors.request.use(
  (config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors with comprehensive logging
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [API] Request failed:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }

    // Dynamically import toast to avoid circular dependency
    const { toast } = await import('./toast');

    // Handle different types of errors
    if (error.response?.status === 401) {
      // Logic for handling unauthorized requests is handled by PrivateRoute and AuthContext
    } else if (error.code === 'ERR_NETWORK') {
      toast.error('Unable to connect to the server. Please check your internet connection.');
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      toast.error('The request timed out. Please try again.');
    }

    return Promise.reject(error);
  }
);

export const getFileUrl = (fileId: string) => {
  // We use the api instance here to ensure the auth token is included.
  return api.get(`/files/${fileId}/view`, {
    maxRedirects: 0,
    validateStatus: function (status) {
      return status >= 200 && status < 400;
    },
  });
};

export default api;

