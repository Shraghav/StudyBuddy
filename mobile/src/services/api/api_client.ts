import axios from "axios";


export const apiClient = axios.create({
  baseURL: "https://studybuddy-backend-qq6l.onrender.com/",
  // baseURL: "http://192.168.31.74:8000",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
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
