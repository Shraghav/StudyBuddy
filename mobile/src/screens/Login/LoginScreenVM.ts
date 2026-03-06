import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { useDispatch } from "react-redux";

import { AuthNavigationProp } from "../../navigation/types";
import { loginSuccess } from "../../store/slices/AuthSlice";

export const LoginScreenVM = () => {
  // Hooks
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const navigation = useNavigation<AuthNavigationProp>();

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        setError("Please fill in all fields");
        return;
      }
      setIsLoading(true);
      setError(null);

      //Simulating the login process
      await new Promise((resolve) => setTimeout(resolve, 1500));
      dispatch(
        loginSuccess({
          user: { email: email },
          token: "mock-jwt-token-from-fastapi",
        }),
      );
    } catch (err: any) {
      console.error("Error occured in handleLogin:", err);
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignUp = () => {
    try {
      navigation.navigate("Signup");
    } catch (error) {
      console.error("Error occured in navigateToSignup:", error);
    }
  };

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
    }
  });
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
  };
};
