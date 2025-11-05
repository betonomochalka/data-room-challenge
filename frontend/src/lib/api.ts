import axios from 'axios';

const API_URL = process.env.PYTHON_API_URL || 'http://localhost:3001/api';

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
    } else {
      // If no token, reject the request to avoid 401 errors
      // This is handled by the calling code
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors with comprehensive logging
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // API issues - log to console
    if (error.response) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const data = error.response?.data;
      
      // Database errors (usually 500 or 503)
      if (status === 500 || status === 503) {
        const errorMessage = data?.message || data?.error || 'Server error';
        const isDatabaseError = 
          errorMessage.includes('database') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('OperationalError') ||
          errorMessage.includes('server closed the connection');
        
        if (isDatabaseError) {
          console.error('[API Error] Database connection error:', {
            status,
            statusText,
            message: errorMessage,
            url: error.config?.url,
            method: error.config?.method,
          });
        } else {
          console.error('[API Error] Server error:', {
            status,
            statusText,
            data,
            url: error.config?.url,
            method: error.config?.method,
          });
        }
      } else {
        // Other API errors
        console.error('[API Error] Request failed:', {
          status,
          statusText,
          data,
          url: error.config?.url,
          method: error.config?.method,
        });
      }
    } else if (error.code === 'ERR_NETWORK') {
      // Network errors
      console.error('[API Error] Network error:', {
        code: error.code,
        message: error.message,
        url: error.config?.url,
      });
    } else {
      // Unexpected errors
      console.error('[Unexpected Error] API request failed:', {
        error,
        url: error.config?.url,
        method: error.config?.method,
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

