import { useDispatch, useSelector } from "react-redux";

import { QuizScreenNavigationProp } from "../../navigation/types";
import { RootState } from "../../store";
import {
  createNewQuiz,
  setDocumentForQuiz,
  startQuiz,
  updateSetupParams,
} from "../../store/slices/QuizSlice";

import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

export const QuizSetupVM = () => {
  // Hooks
  const navigation = useNavigation<QuizScreenNavigationProp>();
  const [isDocModalVisible, setDocModalVisible] = useState(false);
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  const currentSession = useSelector((state: RootState) =>
    state.quiz.sessions.find((s) => s.id === currentSessionId),
  );
  const availableDocs = useSelector((state: RootState) => state.files.files);
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (currentSession?.status === "completed") {
        handleCreateNew();
      }
    });

    return unsubscribe;
  }, [navigation, currentSession?.status]);
  const dispatch = useDispatch();

  const styles = StyleSheet.create({
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
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: "#263238",
      marginBottom: 8,
    },
    emptyText: { color: "#546E7A", fontSize: 16 },
    container: { flex: 1, backgroundColor: "#F0F4F8" },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F0F4F8",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: "#FFF",
      borderBottomWidth: 1,
      borderColor: "#E1E8ED",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#00796B",
      flex: 1,
      textAlign: "center",
      paddingHorizontal: 10,
    },
    content: { padding: 20 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: "#FFF",
      padding: 20,
      borderRadius: 15,
      maxHeight: "50%",
    },
    modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
    docItem: {
      padding: 15,
      borderBottomWidth: 1,
      backgroundColor: "#E1E8ED",
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
    pdfName: { color: "#4b4545", fontSize: 14 },
    emptyMainContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },
  });

  // handling modal
  const handleModel = (val: boolean) => {
    try {
      setDocModalVisible(val);
    } catch (error) {
      console.error("Error in handleModel:", error);
    }
  };

  // Redux functionalities
  const handleCreateNew = () => {
    try {
      return dispatch(createNewQuiz(Date.now().toString()));
    } catch (error) {
      console.error("Error occured in handleCreateNew:", error);
    }
  };
  const documentSelect = (doc: { id: string; name: string }) => {
    try {
      return dispatch(setDocumentForQuiz(doc));
    } catch (error) {
      console.error("Error in documentSelect:", error);
    }
  };
  const updateSetup = (params: any) => {
    try {
      return dispatch(updateSetupParams(params));
    } catch (error) {
      console.error("Error in updateSetup:", error);
    }
  };
  // Generating quiz
  const generateAndStartQuiz = async () => {
    if (!currentSession) return;

    const mockQuestions = Array.from({
      length: parseInt(currentSession.setupParams.numQuestions) || 5,
    }).map(
      (_, i) =>
        ({
          id: `q_${i}`,
          text: `Mock AI Question ${i + 1} for ${currentSession.documentName}?`,
          type: currentSession.setupParams.format,
          options:
            currentSession.setupParams.format === "mcq"
              ? ["A", "B", "C", "D"]
              : undefined,
          correctAnswer:
            currentSession.setupParams.format === "mcq"
              ? "A"
              : "Mock AI Answer",
        }) as any,
    );

    dispatch(startQuiz(mockQuestions));
    navigation.navigate("ActiveQuiz");
  };

  return {
    currentSession,
    availableDocs,
    handleCreateNew,
    updateSetup,
    documentSelect,
    generateAndStartQuiz,
    styles,
    isDocModalVisible,
    handleModel,
  };
};
