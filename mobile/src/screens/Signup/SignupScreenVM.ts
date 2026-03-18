import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { LoginScreenNavigationProp } from "../../navigation/types";
import { supabase } from "../../services/db/superbase";
import { AppTheme } from "../../utils/themes";
import { useTheme } from "react-native-paper";

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    subContainer: {
      padding: 25,
      justifyContent: "center",
      flexGrow: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.colors.primary, // Using your custom primary color
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginBottom: 30,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderRadius: 20,
      elevation: 4,
      // Add shadow for iOS to match elevation
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    footer: {
      textAlign: "center",
      marginTop: 20,
      color: theme.colors.onSurfaceVariant,
    },
    link: {
      color: theme.colors.primary,
      fontWeight: "bold",
    },
  });
export const SignupVM = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
  const navigation = useNavigation<LoginScreenNavigationProp>();

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
    confirmPasswordIconVisible,
    theme
  };
};
