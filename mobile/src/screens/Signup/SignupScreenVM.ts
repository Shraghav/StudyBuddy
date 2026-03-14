import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { LoginScreenNavigationProp } from "../../navigation/types";
import { supabase } from "../../services/db/superbase";

export const SignupVM = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigation = useNavigation<LoginScreenNavigationProp>();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F4F8" },
    subContainer: { padding: 25, justifyContent: "center", flexGrow: 1 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#004D40",
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: "#546E7A",
      textAlign: "center",
      marginBottom: 30,
    },
    card: {
      backgroundColor: "#FFF",
      padding: 20,
      borderRadius: 20,
      elevation: 4,
    },
    footer: { textAlign: "center", marginTop: 20, color: "#546E7A" },
    link: { color: "#00796B", fontWeight: "bold" },
  });
  const handleSignup = async () => {
    try {
      if (!validateInputs()) {
        return;
      }
      const { error, data } = await supabase.auth.signUp({
        email: email,
        password: password,
      });
      if (error) {
        setError(error.message);
      }
      navigation.navigate("SignIn");
      setIsLoading(true);
    } catch (error) {
      console.error("Error occured in handleSignup:", error);
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
  const handleLogin = () => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error("Error occured in handleLogin");
    }
  };
  const passwordIconVisible = (visible: boolean) => {
    try {
      setPasswordVisible(!visible);
    } catch (error) {
      console.error("Error occured in password Icon:", error);
    }
  };
  const confirmPasswordIconVisible = (visible: boolean) => {
    try {
      setConfirmPasswordVisible(!visible);
    } catch (error) {
      console.error("Error occured in confirm password Icon:", error);
    }
  };
  return {
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    handleSignup,
    handleLogin,
    styles,
    passwordIconVisible,
    passwordVisible,
    confirmPasswordVisible,
    confirmPasswordIconVisible
  };
};
