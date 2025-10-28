import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { showToast } from '@/lib/toast';

// Types for error handling
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

// Create axios instance with base configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const retryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Utility function to get user-friendly error messages
const getErrorMessage = (error: AxiosError): string => {
  if (!error.response) {
    // Network error or timeout
    if (!navigator.onLine) {
      return 'You appear to be offline. Please check your internet connection and try again.';
    }
    return 'Network error. Please check your connection and try again.';
  }

  const status = error.response.status;
  const data = error.response.data as any;

  switch (status) {
    case 400:
      return data?.message || 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return data?.message || 'A conflict occurred. Please try again.';
    case 422:
      return data?.message || 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return data?.message || 'An unexpected error occurred. Please try again.';
  }
};

// Exponential backoff delay calculation
const getRetryDelay = (attempt: number, config: RetryConfig): number => {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay + Math.random() * 1000, config.maxDelay); // Add jitter
};

// Check if error is retryable
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) return true; // Network errors are retryable

  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.response.status);
};

// Retry mechanism with exponential backoff
const retryRequest = async (config: AxiosRequestConfig, attempt: number = 0): Promise<AxiosResponse> => {
  try {
    return await axios(config);
  } catch (error) {
    const axiosError = error as AxiosError;

    if (attempt < retryConfig.maxRetries && isRetryableError(axiosError)) {
      const delay = getRetryDelay(attempt, retryConfig);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(config, attempt + 1);
    }

    throw error;
  }
};

// Request interceptor for adding auth token and organization ID
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    const organizationId = localStorage.getItem('organizationId');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (organizationId && config.headers) {
      config.headers['X-Organization-ID'] = organizationId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors with user feedback
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const apiError: ApiError = {
      message: getErrorMessage(error),
      status: error.response?.status,
      code: error.code,
      details: error.response?.data,
    };

    // Handle specific error cases
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      showToast.error('Your session has expired. Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 2000);
    } else if (error.response?.status === 403) {
      showToast.error(apiError.message);
    } else if (error.response?.status === 429) {
      showToast.warning('Too many requests. Please wait before trying again.');
    } else if (error.response && error.response.status >= 500) {
      showToast.error('Server error occurred. Please try again later.');
    } else if (!error.response) {
      // Network error
      if (!navigator.onLine) {
        showToast.error('You appear to be offline. Please check your connection.');
      } else {
        showToast.error('Network error. Please check your connection and try again.');
      }
    } else {
      // Show user-friendly error message for other errors
      showToast.error(apiError.message);
    }

    return Promise.reject(apiError);
  }
);

// Enhanced request method with retry logic
export const apiRequest = async <T = any>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  // For critical requests, use retry mechanism
  if (config.method && ['GET', 'HEAD', 'OPTIONS'].includes(config.method.toUpperCase())) {
    return retryRequest(config);
  }

  return apiClient.request(config);
};

export default apiClient;