import axios from 'axios';

const API_KEY_STORAGE_KEY = 'deepseek-api-key';

export const apiClient = axios.create({
  baseURL: 'https://api.deepseek.com',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：从 localStorage 动态读取 API Key
apiClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (apiKey) {
    config.headers.Authorization = `Bearer ${apiKey}`;
  }
  return config;
});

// 响应拦截器：401 时清除无效 key
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    return Promise.reject(error);
  },
);
