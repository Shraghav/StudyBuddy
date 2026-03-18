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
import { AppTheme } from "../../utils/themes";
import { useTheme } from "react-native-paper";

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    drawerContainer: {  backgroundColor: theme.colors.surface },
    drawerHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginBottom: 10,
    },
    logoText: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.primary,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 15,
    },
    actionIcons: { flexDirection: "row", alignItems: "center" },
    newBtnContainer: { paddingHorizontal: 15, marginBottom: 20 },
    newQuizBtn: { backgroundColor: theme.colors.primary },
    selectedItem: {
      borderWidth: 2,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.errorContainer,
    },
    iconBtn: { marginLeft: 15 },
    statusSubtext: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      marginLeft: 22,
    },
    historyLabel: {
      paddingHorizontal: 20,
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.onSurfaceVariant,
      marginBottom: 10,
    },
    historyItem: {
      padding: 15,
      marginHorizontal: 10,
      borderRadius: 10,
      marginBottom: 5,
    },
    historyItemActive: { backgroundColor: theme.colors.primaryContainer },
    historyText: { fontSize: 16, color: theme.colors.onSurface },
    historyTextActive: {
      fontWeight: "bold",
      color: theme.colors.onPrimaryContainer,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 25,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 20,
      color: theme.colors.onSurface,
    },
    selectBtn: { backgroundColor: theme.colors.secondary, marginBottom: 15 },
    modalActions: { flexDirection: "row", justifyContent: "space-between" },
    cancelBtn: { flex: 0.45, backgroundColor: theme.colors.surfaceVariant },
    saveBtn: { flex: 0.45 },
    deleteCancelIcon: { height: 25, width: 20 },
  });
export const QuizDrawerVM = (props: DrawerContentComponentProps) => {
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

  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
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
      console.error("Error occured in handleCancel:", error);
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
