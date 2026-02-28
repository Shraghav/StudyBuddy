import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../../store";
import {
  createNewQuiz,
  removeQuizzes,
  renameQuiz,
  switchQuizSession,
} from "../../store/slices/QuizSlice";

export const QuizDrawerVM = (props: DrawerContentComponentProps) => {
  const styles = StyleSheet.create({
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 15,
    },
    actionIcons: { flexDirection: "row", alignItems: "center" },
    newBtnContainer: { paddingHorizontal: 15, marginBottom: 20 },
    selectedItem: {
      borderWidth: 2,
      borderColor: "#00796B",
      backgroundColor: "#E0F2F1",
    },
    iconBtn: { marginLeft: 15 },
    statusSubtext: {
      fontSize: 11,
      color: "#90A4AE",
      marginTop: 4,
      marginLeft: 22,
    },
    drawerContainer: { flex: 1, backgroundColor: "#F0F4F8" },
    drawerHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: "#E1E8ED",
      marginBottom: 10,
    },
    logoText: { fontSize: 20, fontWeight: "bold", color: "#00796B" },
    newQuizContainer: { paddingHorizontal: 15, marginBottom: 20 },
    newQuizBtn: { backgroundColor: "#263238" },
    historyLabel: {
      paddingHorizontal: 20,
      fontSize: 14,
      fontWeight: "700",
      color: "#546E7A",
      marginBottom: 10,
    },
    historyItem: {
      padding: 15,
      marginHorizontal: 10,
      borderRadius: 10,
      marginBottom: 5,
    },
    historyItemActive: { backgroundColor: "#E0F2F1" },
    historyText: { fontSize: 16, color: "#263238" },
    historyTextActive: { fontWeight: "bold", color: "#004D40" },
    statusText: {
      fontSize: 12,
      color: "#90A4AE",
      marginTop: 4,
      marginLeft: 22,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: { backgroundColor: "#FFF", borderRadius: 20, padding: 25 },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 20,
      color: "#01212b",
    },
    selectBtn: { backgroundColor: "#263238", marginBottom: 15 },
    modalActions: { flexDirection: "row", justifyContent: "space-between" },
    cancelBtn: { flex: 0.45, backgroundColor: "#90A4AE" },
    saveBtn: { flex: 0.45 },
    deleteCancelIcon: { height: 25, width: 20 },
  });
  // Hooks
  const dispatch = useDispatch();
  const sessions = useSelector((state: RootState) => state.quiz.sessions);
  const currentSessionId = useSelector(
    (state: RootState) => state.quiz.currentSessionId,
  );
  // Local UI states for the Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [quizName, setQuizName] = useState("");

  // States for Batch Selection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handling quiz and history
  const handleNewQuiz = () => {
    try {
      const newId = Date.now().toString();
      dispatch(createNewQuiz(newId));
      props.navigation.navigate("QuizStack", { screen: "QuizSetup" });
      props.navigation.closeDrawer();
    } catch (error) {
      console.error("Error occured in handleNewQuiz:", error);
    }
  };
  const handleSelectHistory = (id: string, status: string) => {
    try {
      dispatch(switchQuizSession(id));
      let targetScreen = "QuizSetup";
      if (status === "active") targetScreen = "ActiveQuiz";
      if (status === "completed") targetScreen = "QuizResult";
      props.navigation.navigate("QuizStack", { screen: targetScreen });
      props.navigation.closeDrawer();
    } catch (error) {
      console.error("Error occured in handleSelectHistory:", error);
    }
  };
  // To show options or not
  const openOptions = (id: string, title: string) => {
    try {
      setTargetId(id);
      setQuizName(title);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error occured in openOptions:", error);
    }
  };

  // To toggle and start the selection
  const toggleSelect = (id: string) => {
    try {
      setSelectedIds((prev) => {
        const updated = prev.includes(id)
          ? prev.filter((i) => i !== id)
          : [...prev, id];
        if (updated.length === 0) setIsSelectionMode(false);
        return updated;
      });
    } catch (error) {
      console.error("Erroc occured in toggleSelect:", error);
    }
  };

  const startSelection = () => {
    try {
      if (targetId) {
        setSelectedIds([targetId]);
        setIsSelectionMode(true);
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in start selection:", error);
    }
  };

  // Handling deleting scenario
  const handleDelete = () => {
    try {
      dispatch(removeQuizzes(selectedIds));
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in handleDelete:", error);
    }
  };

  // Modal Actions
  const handleCancel = () => {
    try {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in handleCancel:", error)
    }
  };
  const handleQuizName = (text: string) => {
    try {
      setQuizName(text);
    } catch (error) {
      console.error("Error in handleQuizName:", error);
    }
  };
  const closeModal = () => {
    try {
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error in handleQuizName:", error);
    }
  };
  const renameQuizModal = () => {
    try {
      if (targetId) dispatch(renameQuiz({ id: targetId, newTitle: quizName }));
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error in handleQuizName:", error);
    }
  };
  
  return {
    styles,
    isSelectionMode,
    isModalVisible,
    sessions,
    selectedIds,
    currentSessionId,
    toggleSelect,
    handleSelectHistory,
    openOptions,
    quizName,
    startSelection,
    handleQuizName,
    handleDelete,
    handleCancel,
    handleNewQuiz,
    closeModal,
    renameQuizModal,
  };
};
export type QuizDrawerType = ReturnType<typeof QuizDrawerVM>;
