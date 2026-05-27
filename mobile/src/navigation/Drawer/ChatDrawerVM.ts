import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { DrawerActions } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import {
  addSession,
  removeSessions,
  renameSession,
  setSessions,
  setSessionsLoading,
  switchSession,
} from "../../store/slices/ChatSlice";
import { AppTheme } from "../../utils/themes";
import { useTheme } from "react-native-paper";

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    drawerContainer: { backgroundColor: theme.colors.surface, flex: 1 },
    drawerHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginBottom: 10,
    },
    logoText: { fontSize: 20, fontWeight: "bold", color: theme.colors.primary },
    newChatContainer: { paddingHorizontal: 15, marginBottom: 20 },
    newChatBtn: { backgroundColor: theme.colors.primary },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginBottom: 10,
      alignItems: "center",
    },
    historyLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.onSurfaceVariant,
    },
    actionIcons: { flexDirection: "row", alignItems: "center" },
    iconBtn: { marginLeft: 15 },
    historyItem: {
      padding: 15,
      marginHorizontal: 10,
      marginBottom: 5,
      borderColor: "transparent",
      borderRadius: 10,
    },
    historyItemActive: {
      backgroundColor: theme.colors.primaryContainer,
    },
    selectedItem: {
      borderWidth: 2,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 15,
    },
    historyText: {
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    historyTextActive: {
      color: theme.colors.onPrimaryContainer,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      justifyContent: "center",
      padding: 15,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      color: theme.colors.onSurface,
    },
    selectChatContainer: {
      backgroundColor: theme.colors.secondary,
    },
    closeModalContainer: {
      flex: 0.45,
    },
    saveModalContainer: { flex: 0.45 },
    modalContainer: { flexDirection: "row", justifyContent: "space-between" },
    chatDrawer: { width: "60%" },
    actionBtn: { color: theme.colors.onSurface },
    centeredState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    dontCreateText: { marginBottom: 15, color: theme.colors.onBackground },
    renameTextContent: {
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.surface,
    },
    noSessionText: { color: theme.colors.onSurfaceVariant },
    deleteIcon: { height: 20, width: 20 },
    cancelIcon: { height: 25, width: 20 },
    deleteLoader: { position: "absolute", right: 83 },
    errorText: { color: theme.colors.error },
  });

export const ChatDrawerVM = (props: DrawerContentComponentProps) => {
  // hooks
  const dispatch = useDispatch();
  const currentSessionId = useSelector(
    (state: RootState) => state.chat.currentSessionId,
  );
  const isSessionLoading = useSelector(
    (state: RootState) => state.chat.isLoading,
  );
  const sessions = useSelector((state: RootState) => state.chat.sessions);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [docName, setDocName] = useState("");
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [createChatLoading, setCreateChatLoading] = useState(false);
  const [error, setError] = useState<String>();
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
 
  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = useCallback(async () => {
    try {
      dispatch(setSessionsLoading(true));
      const response = await apiClient.get(`/chat/sessions/all`);
      if (!response.data.sessions) {
        return;
      }
      if (response.data.status === "success") {
        dispatch(setSessions(response.data.sessions));
      }
    } catch (error) {
      setError("Failed to Load Chat history");
      console.error("Failed to load chat history:", error);
    } finally {
      setError("");
      dispatch(setSessionsLoading(false));
    }
  }, [dispatch]);

  // Modal functionalities
  const openModal = useCallback((id: string, currentTitle: string) => {
    try {
      setTargetSessionId(id);
      setDocName(currentTitle);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error occured in openModal:", error);
    }
  }, []);
  const closeModal = useCallback(() => {
    try {
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error in Close Modal:", error);
    }
  }, []);
  const confirmRename = useCallback(async () => {
    try {
      setSaveLoading(true);
      if (targetSessionId && docName.trim()) {
        const newTitle = docName.trim();
        await apiClient.patch(`/chat/sessions/${targetSessionId}/rename`, {
          title: newTitle,
        });
        dispatch(renameSession({ id: targetSessionId, newTitle: newTitle }));
      }
    } catch (error) {
      console.error("Error occured in confirmName:", error);
    } finally {
      setSaveLoading(false);
      setIsModalVisible(false);
    }
  }, [targetSessionId, docName, dispatch]);
  const handleDocName = useCallback((text: string) => {
    try {
      setDocName(text);
    } catch (error) {
      console.error("Error in handleDocName:", error);
    }
  }, []);

  // Selecting, toggling, deleting and cancelling chats in drawer
  const enterSelectionMode = useCallback(() => {
    try {
      if (targetSessionId) {
        setSelectedIds([targetSessionId]);
        setIsSelectionMode(true);
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in enterSelectionMode:", error);
    }
  }, [targetSessionId]);
  const toggleSelection = useCallback((id: string) => {
    try {
      setSelectedIds((prev) => {
        const updated = prev.includes(id)
          ? prev.filter((i) => i !== id)
          : [...prev, id];
        if (updated.length === 0) setIsSelectionMode(false);
        return updated;
      });
    } catch (error) {
      console.error("Errod occured in toggleSelection:", error);
    }
  }, []);
  const deleteSelectedChats = useCallback(async () => {
    try {
      if (selectedIds.length === 0) return;
      setIsDeleteLoading(true);
      await apiClient.delete(`/chat/sessions/bulk-delete`, {
        data: selectedIds,
      });

      dispatch(removeSessions(selectedIds));
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in deleteSelectionChats:", error);
    } finally {
      setIsDeleteLoading(false);
    }
  }, [selectedIds, dispatch]);
  const cancelSelection = useCallback(() => {
    try {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error in cancel selection:", error);
    }
  }, []);

  // Creating newchat, closeing drawer and chat session change
  const createNewChat = useCallback(async () => {
    try {
      setCreateChatLoading(true);
      const title = `Study Session ${sessions.length + 1}`;
      const response = await apiClient.post(`/chat/sessions`, { title });
      const newSession = response.data.session;
      dispatch(
        addSession({
          ...newSession,
          messages: [],
        }),
      );
      return newSession.id;
    } catch (error) {
      console.error("Error occured in chat drawer:", error);
    } finally {
      setCreateChatLoading(false);
    }
  }, [sessions.length, dispatch]);

  const createNewChatAndCloseDrawer = useCallback(async () => {
    try {
      await createNewChat();
      props.navigation.dispatch(DrawerActions.closeDrawer());
    } catch (error) {
      setError("Cannot create a new chat");
      console.error("Error in CreateNewChatAndCloseDrawer:", error);
    }
  }, [createNewChat, props.navigation]);
  const changeSession = useCallback(
    (id: string) => {
      try {
        props.navigation.closeDrawer();
        return dispatch(switchSession(id));
      } catch (error) {
        console.error(error);
      }
    },
    [dispatch, props.navigation],
  );

  return {
    isSelectionMode,
    toggleSelection,
    deleteSelectedChats,
    createNewChat,
    selectedIds,
    cancelSelection,
    sessions,
    currentSessionId,
    changeSession,
    openModal,
    isModalVisible,
    docName,
    handleDocName,
    enterSelectionMode,
    confirmRename,
    closeModal,
    styles,
    createNewChatAndCloseDrawer,
    isDeleteLoading,
    theme,
    error,
    isSessionLoading,
    saveLoading,
    createChatLoading,
  };
};

export type ChatDrawerType = ReturnType<typeof ChatDrawerVM>;
