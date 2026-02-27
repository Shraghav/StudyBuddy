import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { AuthNavigationProp } from "../../navigation/types";

export const SignupVM = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigation = useNavigation<AuthNavigationProp>();

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
      if (password !== confirmPassword) {
        alert("Passwords don't match!");
        return;
      }
      navigation.navigate("SignIn");
      setIsLoading(true);
    } catch (error) {
      console.log("Error occured in handleSignup:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    try {
      navigation.goBack()
    } catch (error) {
      console.error("Error occured in handleLogin")
    }
  }

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
  };
};
