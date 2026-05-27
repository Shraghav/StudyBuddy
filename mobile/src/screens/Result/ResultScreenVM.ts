import { useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";
import { useSelector } from "react-redux";
import { QuizScreenNavigationProp } from "../../navigation/types";
import { RootState } from "../../store";
import { AppTheme } from "../../utils/themes";
export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.primary,
    },

    // Results UI
    scoreHeader: {
      alignItems: "center",
      padding: 30,
      backgroundColor: theme.colors.success,
    },
    scoreText: {
      fontSize: 48,
      fontWeight: "bold",
      color: theme.colors.onPrimary,
    },
    feedbackText: {
      color: theme.colors.onSuccessContainer,
      marginTop: 10,
      textAlign: "center",
      fontSize: 16,
    },
    questionCard: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderRadius: 15,
      marginBottom: 15,
      elevation: 2,
      shadowColor: theme.colors.shadow,
    },
    questionText: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.onSurface,
      marginBottom: 15,
    },
    resultText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 5,
    },
    correctText: {
      fontSize: 14,
      color: theme.colors.success,
      fontWeight: "bold",
    },
    pendingText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontStyle: "italic",
      marginTop: 10,
    },

    // Dynamic grading markers using theme success/error colors
    cardCorrect: { borderLeftWidth: 5, borderLeftColor: theme.colors.success },
    cardWrong: { borderLeftWidth: 5, borderLeftColor: theme.colors.error },
  });
export const ResultScreenVM = () => {
  // Hooks
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  const currentSession = useSelector((state: RootState) =>
    state.quiz.sessions.find((s) => s.id === currentSessionId),
  );

  console.log("Current session:", currentSession);
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);

  return {
    currentSession,
    styles,
    navigation,
  };
};
