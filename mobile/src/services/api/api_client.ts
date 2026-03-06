import axios from "axios";
import { Platform } from "react-native";

const getBaseUrl = () => {
  if (__DEV__) {
    // FOR PHYSICAL DEVICE (Both Android & iOS)
    const pcIpAddress = "192.168.31.74";
    return `http://${pcIpAddress}:8000`;
  }
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000
});

// Saample code to inject the bearer token
apiClient.interceptors.request.use(async (config) => {
  const token = "your_auth_token_here";
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response, 
  async (error) => {
    const config = error.config;
    const MAX_RETRIES = 3;
    const isNetworkOrTimeout =
      !error.response || // no response = network error / timeout
      error.code === "ECONNABORTED" || // axios timeout
      error.code === "ERR_NETWORK";

    if (!config || !isNetworkOrTimeout) {
      return Promise.reject(error);
    }

    config._retryCount = config._retryCount ?? 0;

    if (config._retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    config._retryCount += 1;
    const delay = 500 * 2 ** (config._retryCount - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return apiClient(config);
  },
);
