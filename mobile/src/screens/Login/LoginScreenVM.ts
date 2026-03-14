import { useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { useDispatch } from "react-redux";

import { LoginScreenNavigationProp } from "../../navigation/types";
import { supabase } from "../../services/db/superbase";
import { loginSuccess } from "../../store/slices/AuthSlice";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  innerContainer: { flex: 1, justifyContent: "center", padding: 30 },
  header: { marginBottom: 50, alignItems: "center" },
  logoText: { fontSize: 32, fontWeight: "bold", color: "#00796B" },
  subtitle: { fontSize: 16, color: "#546E7A", marginTop: 10 },
  form: {
    backgroundColor: "#FFF",
    padding: 25,
    borderRadius: 20,
    elevation: 5,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
  },
  footerText: { textAlign: "center", marginTop: 30, color: "#546E7A" },
  signUpLink: { color: "#00796B", fontWeight: "bold" },
  loginButtonOverride: {
    marginTop: 10,
  },
});
export const LoginScreenVM = () => {
  // Hooks
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    try {
      if (!validateInputs()) {
        return;
      }
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (data.session) {
        dispatch(
          loginSuccess({
            token: data.session.access_token,
          }),
        );
        await SecureStore.setItemAsync("auth_token", data.session.access_token);
      } else {
        if (error) setError(error.message);
      }
    } catch (err: any) {
      console.error("Error occured in handleLogin:", err);
      setError("An error occured. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  const validateInputs = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }

    return true;
  };
  const navigateToSignUp = () => {
    try {
      navigation.navigate("Signup");
    } catch (error) {
      console.error("Error occured in navigateToSignup:", error);
    }
  };

  const passwordIconVisible = (visible: boolean) => {
    try {
      setPasswordVisible(!visible);
    } catch (error) {
      console.error("Error occured in password Icon:", error);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    handleLogin,
    navigateToSignUp,
    styles,
    passwordIconVisible,
    passwordVisible,
  };
};
