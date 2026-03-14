import { useDispatch } from "react-redux";
import { performLogout } from "../../utils/auth";
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});
export const ProfileScreenVM = () => {
  const logOut = async () => {
    try {
      await performLogout();
    } catch (error) {
      console.error("Error occured in Logout Profile Screen:", error);
    }
  };
  return {
      logOut,
      styles
  };
};
