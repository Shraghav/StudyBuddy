import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { BackHandler, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React from "react";
import { QuizScreenNavigationProp } from "../../navigation/types";

export const ResultScreenVM = () => {
  // Hooks
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  const currentSession = useSelector((state: RootState) =>
    state.quiz.sessions.find((s) => s.id === currentSessionId),
  );
  const navigation = useNavigation<QuizScreenNavigationProp>();
 
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("QuizSetup");
        return true;
      };
      BackHandler.addEventListener("hardwareBackPress", onBackPress);
    }, [navigation]),
  );

  const styles = StyleSheet.create({
    // Results UI
    scoreHeader: {
      alignItems: "center",
      padding: 30,
      backgroundColor: "#00796B",
    },
    scoreText: { fontSize: 48, fontWeight: "bold", color: "#FFF" },
    feedbackText: {
      color: "#E0F2F1",
      marginTop: 10,
      textAlign: "center",
      fontSize: 16,
    },
    cardCorrect: { borderLeftWidth: 5, borderLeftColor: "#4CAF50" }, // Green strip for correct
    cardWrong: { borderLeftWidth: 5, borderLeftColor: "#F44336" }, // Red strip for wrong
    resultText: { fontSize: 14, color: "#546E7A", marginBottom: 5 },
    correctText: { fontSize: 14, color: "#4CAF50", fontWeight: "bold" },
    questionCard: {
      backgroundColor: "#FFF",
      padding: 20,
      borderRadius: 15,
      marginBottom: 15,
      elevation: 2,
    },
    questionText: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#263238",
      marginBottom: 15,
    },
    optionBtn: {
      padding: 15,
      borderRadius: 10,
      backgroundColor: "#F5F7F9",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E1E8ED",
    },
    container: { flex: 1, backgroundColor: "#F0F4F8" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      backgroundColor: "#FFF",
      borderBottomWidth: 1,
      borderColor: "#E1E8ED",
    },
    headerTitle: { fontSize: 18, fontWeight: "bold", color: "#00796B" },
    pendingText: {
      fontSize: 12,
      color: "#00796B",
      fontStyle: "italic",
      marginTop: 10,
    },
  });
  
  return {
    currentSession,
    styles,
    navigation,
  };
};
