import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { store } from "../store";
import { logout } from "../store/slices/AuthSlice";
import { useDispatch } from "react-redux";

export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const decoded: any = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch {
    return false;
  }
};

export const performLogout = async () => {
  try {
    await SecureStore.deleteItemAsync("auth_token");
  } catch {
    return false;
  } finally {
    store.dispatch(logout());
  }
};
