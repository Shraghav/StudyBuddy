import { useDispatch, useSelector } from "react-redux";

import { QuizScreenNavigationProp } from "../../navigation/types";
import { RootState } from "../../store";
import {
  createNewQuiz,
  setDocumentForQuiz,
  setQuizStatus,
  startQuiz,
  updateSetupParams,
  // updateSetupParams,
} from "../../store/slices/QuizSlice";

import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { apiClient } from "../../services/api/api_client";
import { FileDetail } from "../../store/slices/FileSlice";
import { useTheme } from "react-native-paper";
import { AppTheme } from "../../utils/themes";

export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    emptyMainContainer: {
      flex: 1,
      paddingHorizontal: 20,
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
    pillContainer: {
      flexDirection: "row",
      gap: 10,
    },
    pill: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.colors.onSurfaceVariant,
    },
    pillActive: {
      backgroundColor: theme.colors.success,
    },
    pillText: {
      color: theme.colors.onPrimary,
      fontWeight: "600",
    },
    pillTextActive: {
      color: theme.colors.onPrimary, // Assuming onPrimary works well on success
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
    optionBtn: {
      padding: 15,
      borderRadius: 10,
      backgroundColor: theme.colors.elevation.level1,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      fontWeight: "600",
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
      maxHeight: "50%",
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
      borderBottomColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceVariant,
    },
    docSelector: {
      backgroundColor: theme.colors.surfaceVariant,
      padding: 15,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    docSelectorText: {
      color: theme.colors.onSuccessContainer,
      fontWeight: "bold",
    },
    pdfName: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    questionsInp: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.onSurface,
      marginBottom: 10,
    },
    sessionLoaderContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: { color: theme.colors.error },
    closebtn: { backgroundColor: theme.colors.onSurfaceVariant },
    emptyModalText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginVertical: 20,
    },
  });
export const QuizSetupVM = () => {
  // Hooks
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const [isDocModalVisible, setDocModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submittingDocId, setSubmittingDocId] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState({
    numQuestions: "",
    difficulty: "",
    format: "",
  });
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  const currentSession = useSelector((state: RootState) =>
    state.quiz.sessions.find((s) => s.id === currentSessionId),
  );
  const sessionLoading = useSelector(
    (state: RootState) => state.quiz.isLoading,
  );
  const isGenerating = currentSession?.status === "generating";
  const availableDocs = useSelector((state: RootState) => state.files.files);
  // useEffect(() => {
  //   const unsubscribe = navigation.addListener("focus", () => {
  //     if (currentSession?.status === "completed") {
  //       handleCreateNew();
  //     }
  //   });
  //   return unsubscribe;
  // }, [navigation, currentSession?.status]);

  const cleanupPolling = useCallback(() => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    if (initialTimeout.current) clearTimeout(initialTimeout.current);
  }, []);

  useEffect(() => {
    return cleanupPolling;
  }, [cleanupPolling]);

  const dispatch = useDispatch();

  // handling modal
  const handleModel = (val: boolean) => {
    try {
      setDocModalVisible(val);
    } catch (error) {
      console.error("Error in handleModel:", error);
    }
  };

  // Redux functionalities
  const handleCreateNew = async () => {
    try {
      if (isLoading) return;
      setIsLoading(true);
      const response = await apiClient.post("/quiz/setup");
      const newSessionId = response.data.session_id;
      return dispatch(createNewQuiz(newSessionId));
    } catch (error) {
      console.error("Error occured in handleCreateNew:", error);
      Alert.alert("Setup Error", "Failed to initialize a new quiz session.");
    } finally {
      setIsLoading(false);
    }
  };

  const documentSelect = async (doc: FileDetail) => {
    try {
      if (!currentSessionId || submittingDocId !== null) return;
      setSubmittingDocId(doc.id);
      await apiClient.patch(`/quiz/${currentSessionId}/attach/${doc.id}`);
      dispatch(
        setDocumentForQuiz({
          sessionId: currentSessionId,
          docId: doc.id,
          docName: doc.name,
        }),
      );
    } catch (error) {
      console.error("Error in documentSelect:", error);
      Alert.alert(
        "Attachment Error",
        "Failed to attach the document to this session.",
      );
    } finally {
      setSubmittingDocId(null);
      handleModel(false);
    }
  };

  const updateNumQuestions = useCallback(
    (val: string) => {
      try {
        setFieldErrors((prev) => ({ ...prev, numQuestions: "" }));

        const cleanVal = val.replace(/[^0-9]/g, "");
        if (cleanVal === "") {
          dispatch(updateSetupParams({ numQuestions: "" }));
          return;
        }

        const num = parseInt(val, 10);
        dispatch(updateSetupParams({ numQuestions: num.toString() }));
      } catch (error) {
        console.error("Error occured in update num questions");
      }
    },
    [dispatch],
  );

  const updateDifficulty = useCallback(
    (val: "Easy" | "Medium" | "Hard") => {
      try {
        setFieldErrors((prev) => ({ ...prev, difficulty: "" }));
        dispatch(updateSetupParams({ difficulty: val }));
      } catch (error) {
        console.error("Error occured in updateDifficulty");
      }
    },
    [dispatch],
  );

  const updateFormat = useCallback(
    (val: "mcq") => {
      try {
        setFieldErrors((prev) => ({ ...prev, format: "" }));
        dispatch(updateSetupParams({ format: val }));
      } catch (error) {
        console.error("Error occured in updateFormat", error);
      }
    },
    [dispatch],
  );

  const updateCustomPrompt = useCallback(
    (val: string) => {
      try {
        dispatch(updateSetupParams({ customPrompt: val }));
      } catch (error) {
        console.error("Error occured in  updateCustomPrompt:", error);
      }
    },
    [dispatch],
  );

  const pollQuizStatus = async () => {
    if (!currentSessionId) return;

    try {
      const response = await apiClient.get(`/quiz/${currentSessionId}`);
      const fetchedSession = response.data;

      console.log("Fetched session", fetchedSession);
      if (fetchedSession.status === "active") {
        cleanupPolling();
        dispatch(startQuiz(fetchedSession.questions));
        navigation.navigate("ActiveQuiz"); 
      } else if (fetchedSession.status === "error") {
        cleanupPolling();
        Alert.alert("Oops!", "An unknown error occured.")
        dispatch(setQuizStatus({ id: currentSessionId, status: "setup" }));
      }
    } catch (error) {
      console.error("Polling network hiccup, retrying on next tick:", error);
    }
  };

  const generateAndStartQuiz = async () => {
    try {
      if (!currentSession || !currentSession.setupParams) return;

      const { numQuestions, difficulty, format, customPrompt } =
        currentSession.setupParams;
      let errors = { numQuestions: "", difficulty: "", format: "" };
      let hasError = false;

      const parsedNum = parseInt(numQuestions, 10);
      if (
        !numQuestions ||
        isNaN(parsedNum) ||
        parsedNum < 1 ||
        parsedNum > 25
      ) {
        errors.numQuestions = "Please enter a valid number between 1 and 25.";
        hasError = true;
      }
      if (!difficulty) {
        errors.difficulty = "Please select a difficulty level.";
        hasError = true;
      }
      if (!format) {
        errors.format = "Please select a quiz format.";
        hasError = true;
      }

      if (hasError) {
        setFieldErrors(errors);
        return;
      }

      setFieldErrors({ numQuestions: "", difficulty: "", format: "" });
      dispatch(setQuizStatus({ id: currentSession.id, status: "generating" }));

      const payload = {
        numQuestions: parsedNum,
        difficulty,
        format,
        customPrompt: customPrompt || "",
      };

      await apiClient.post(`/quiz/${currentSession.id}/generate`, payload);

      initialTimeout.current = setTimeout(() => {
        pollInterval.current = setInterval(pollQuizStatus, 3000);
      }, 8000);
    } catch (error) {
      console.error("Failed to trigger generation:", error);
      if (currentSession)
        dispatch(setQuizStatus({ id: currentSession.id, status: "setup" }));
    }
  };
  
  return {
    currentSession,
    availableDocs,
    documentSelect,
    generateAndStartQuiz,
    isDocModalVisible,
    handleModel,
    submittingDocId,
    styles,
    sessionLoading,
    theme,
    updateNumQuestions,
    updateCustomPrompt,
    updateDifficulty,
    updateFormat,
    fieldErrors,
    isGenerating,
  };
};
