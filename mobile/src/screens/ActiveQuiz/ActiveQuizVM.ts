import { CommonActions, useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { QuizScreenNavigationProp } from "../../navigation/types";
import { RootState } from "../../store";
import { answerQuestion, submitQuiz } from "../../store/slices/QuizSlice";

export const ActiveQuizVM = () => {
  // Hooks
  const dispatch = useDispatch();
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  const currentSession = useSelector((state: RootState) =>
    state.quiz.sessions.find((s) => s.id === currentSessionId),
  );

  const styles = StyleSheet.create({
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
    content: { padding: 20 },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: "#263238",
      marginBottom: 8,
    },
    docSelector: {
      backgroundColor: "#E0F2F1",
      padding: 15,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#B2DFDB",
    },
    docSelectorText: { color: "#00796B", fontWeight: "bold" },

    // Pill Selectors
    pillContainer: { flexDirection: "row", gap: 10 },
    pill: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: "#E1E8ED",
    },
    pillActive: { backgroundColor: "#00796B" },
    pillText: { color: "#546E7A", fontWeight: "600" },
    pillTextActive: { color: "#FFF" },

    // Active Quiz Cards
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
    optionSelected: { backgroundColor: "#E0F2F1", borderColor: "#00796B" },
    optionText: { color: "#546E7A" },
    optionTextSelected: { color: "#00796B", fontWeight: "bold" },

    // Fixed Bottom Button
    fixedBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "#FFF",
      padding: 20,
      borderTopWidth: 1,
      borderColor: "#E1E8ED",
    },

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

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: { backgroundColor: "#FFF", padding: 20, borderRadius: 15 },
    modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
    docItem: { padding: 15, borderBottomWidth: 1, borderColor: "#E1E8ED" },
    flatListConatiner: { padding: 20, paddingBottom: 100 },
  });

  // Submission scenarios
  const answerQuestionAI = (qId: string, ans: string) => {
    try {
      return dispatch(answerQuestion({ questionId: qId, answer: ans }));
    } catch (error) {
      console.error("Error occured in answerQuestion:", error);
    }
  };
  const isAllAnswered = () => {
    try {
      if (!currentSession || !currentSession.questions) return false;
      return currentSession.questions.every(
        (q) =>
          currentSession.userAnswers[q.id] &&
          currentSession.userAnswers[q.id].trim() !== "",
      );
    } catch (error) {
      console.error("Error occured in isAllAnswered:", error);
    }
  };
  const handleSubmission = async () => {
    try {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: "QuizSetup" }, { name: "QuizResult" }],
        }),
      );
      dispatch(submitQuiz());
    } catch (error) {
      console.error("Error occured in handleSubmission:", error);
    }
  };

  return {
    currentSession,
    answerQuestionAI,
    isAllAnswered,
    handleSubmission,
    styles,
  };
};
