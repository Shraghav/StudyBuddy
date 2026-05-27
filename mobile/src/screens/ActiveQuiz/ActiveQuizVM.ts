import { CommonActions, useNavigation } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { useState } from "react";
import { useTheme } from "react-native-paper";
import { QuizScreenNavigationProp } from "../../navigation/types";
import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import { answerQuestion, completeQuiz } from "../../store/slices/QuizSlice";
import { AppTheme } from "../../utils/themes";

export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.primary,
      flex: 1,
      textAlign: "center",
      paddingHorizontal: 10,
    },
    content: {
      padding: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    docSelector: {
      backgroundColor: theme.colors.successContainer,
      padding: 15,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    docSelectorText: {
      color: theme.colors.onSuccessContainer,
      fontWeight: "bold",
    },

    pillContainer: {
      flexDirection: "row",
      gap: 10,
    },
    pill: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceVariant,
    },
    pillActive: {
      backgroundColor: theme.colors.success,
    },
    pillText: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: "600",
    },
    pillTextActive: {
      color: theme.colors.onPrimary,
    },

    questionCard: {
      backgroundColor: theme.colors.surfaceVariant,
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
    optionBtn: {
      padding: 15,
      borderRadius: 10,
      backgroundColor: theme.colors.elevation.level1,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.onSurfaceVariant,
    },
    optionSelected: {
      backgroundColor: theme.colors.successContainer,
      borderColor: theme.colors.success,
    },
    optionText: {
      color: theme.colors.onSurface,
    },
    optionTextSelected: {
      color: theme.colors.success,
      fontWeight: "bold",
    },

    fixedBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },

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
    cardCorrect: {
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.success,
    },
    cardWrong: {
      borderLeftWidth: 5,
      borderLeftColor: theme.colors.error,
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

    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderRadius: 15,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 15,
      color: theme.colors.onSurface,
    },
    docItem: {
      padding: 15,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },
    flatListConatiner: {
      padding: 20,
      paddingBottom: 100,
    },
  });

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
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      const answers = currentSession.userAnswers || {};

      return currentSession.questions.every((q) => {
        const answer = answers[q.id];
        return answer !== undefined && answer !== null && answer.trim() !== "";
      });
    } catch (error) {
      console.error("Error occured in isAllAnswered:", error);
    }
  };
  const handleSubmission = async () => {
    try {
      if (!currentSessionId || !currentSession?.userAnswers) return;

      setIsSubmitting(true);

      //  Map the dictionary to the array format required by backend
      const formattedAnswers = Object.entries(currentSession.userAnswers).map(
        ([questionId, answer]) => ({
          question_id: questionId,
          user_answer: answer,
        }),
      );

      await apiClient.post(
        `/quiz/${currentSessionId}/submit`,
        formattedAnswers,
      );

      const mcq_ans = await apiClient.get(`/quiz/${currentSessionId}`);
      const fetchedData = mcq_ans.data;

      // Map the graded questions for our frontend Redux state
      const mappedQuestions = fetchedData.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        type: "mcq",
        options: q.options,
        correctAnswer: q.correct_answer,
        userAnswer: q.user_answer,
        evaluationScore: q.evaluation_score,
        evaluationFeedback: q.evaluation_feedback || "", 
      }));

      dispatch(
        completeQuiz({
          score: fetchedData.score,
          feedback: fetchedData.feedback,
          questions: mappedQuestions,
        }),
      );

      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [{ name: "QuizResult" }],
        }),
      );
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
    isSubmitting,
  };
};
