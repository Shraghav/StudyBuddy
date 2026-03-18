import { useDispatch, useSelector } from "react-redux";
import { performLogout } from "../../utils/auth";
import { StyleSheet } from "react-native";
import { AppDispatch, RootState } from "../../store";
import { toggleTheme } from "../../store/slices/ThemeSlice";
import { useState } from "react";
import { useTheme } from "react-native-paper";
import { AppTheme } from "../../utils/themes";

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    header: {
      marginBottom: 30,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.colors.primary,
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 25,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      // Soft elevation for a card-like appearance
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.secondary,
      marginBottom: 15,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 5,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.onSurface,
    },
    logoutButton: {
      backgroundColor: theme.colors.errorContainer, // Softer red background
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    logoutText: {
      color: theme.colors.error
    }
  });
export const ProfileScreenVM = () => {
  const dispatch = useDispatch();
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const logOut = async () => {
    try {
      await performLogout();
    } catch (error) {
      console.error("Error occured in Logout Profile Screen:", error);
    }
  };
  const toggleThemeProfile = () => {
    try {
      dispatch(toggleTheme());
    } catch (error) {
      console.error("Error occured in toggle theme profile:", error)
    }
  };
  return {
    logOut,
    styles,
    toggleThemeProfile,
    isDark,
    theme
  };
};
