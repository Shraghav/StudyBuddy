import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { DrawerActions } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import {
  addSession,
  removeSessions,
  renameSession,
  setSessions,
  switchSession,
} from "../../store/slices/ChatSlice";

export const ChatDrawerVM = (props: DrawerContentComponentProps) => {
  // hooks
  const dispatch = useDispatch();
  const currentSessionId = useSelector(
    (state: RootState) => state.chat.currentSessionId,
  );
  const sessions = useSelector((state: RootState) => state.chat.sessions);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [docName, setDocName] = useState("");

  const styles = StyleSheet.create({
    drawerContainer: { flex: 1, backgroundColor: "#F0F4F8" },
    drawerHeader: {
      padding: 20,
      borderBottomWidth: 1,
      borderColor: "#E1E8ED",
      marginBottom: 10,
    },
    logoText: { fontSize: 20, fontWeight: "bold", color: "#00796B" },
    newChatContainer: { paddingHorizontal: 15, marginBottom: 20 },
    newChatBtn: { backgroundColor: "#263238" },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      marginBottom: 10,
      alignItems: "center",
    },
    historyLabel: { fontSize: 14, fontWeight: "700", color: "#546E7A" },
    actionIcons: { flexDirection: "row", alignItems: "center" },
    iconBtn: { marginLeft: 15 },
    historyItem: {
      padding: 15,
      marginHorizontal: 10,
      borderRadius: 10,
      marginBottom: 5,
      borderColor: "transparent",
      borderWidth:2
    },
    historyItemActive: { backgroundColor: "#E0F2F1" },
    selectedItem: {
      borderWidth: 2,
      borderColor: "#D32F2F",
      backgroundColor: "#ffd4db",
    },
    historyText: { fontSize: 16, color: "#263238" },
    historyTextActive: { fontWeight: "bold", color: "#004D40" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: { backgroundColor: "#fff", borderRadius: 20, padding: 25 },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      color: "#01212b",
    },
    selectChatContainer: { backgroundColor: "#263238", marginBottom: 15 },
    closeModalContainer: { flex: 0.45, backgroundColor: "#90A4AE" },
    saveModalContainer: { flex: 0.45 },
    modalContainer: { flexDirection: "row", justifyContent: "space-between" },
    chatDrawer: { width: "60%" },
  });

  // To fetch all the chats
  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    try {
      const response = await apiClient.get("/chat/sessions/all");
      if (response.data.status === "success") {
        dispatch(setSessions(response.data.sessions));
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };
  // Modal functionalities
  const openModal = (id: string, currentTitle: string) => {
    try {
      setTargetSessionId(id);
      setDocName(currentTitle);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Erro occured in openModal:", error);
    }
  };
  const closeModal = () => {
    try {
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error in Close Modal:", error);
    }
  };
  const confirmRename = async () => {
    try {
      if (targetSessionId && docName.trim()) {
        const newTitle = docName.trim();
        await apiClient.patch(`/chat/sessions/${targetSessionId}/rename`, {
          title: newTitle,
        });
        dispatch(renameSession({ id: targetSessionId, newTitle: newTitle }));
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in confirmName:", error);
    }
  };
  const handleDocName = (text: string) => {
    try {
      setDocName(text);
    } catch (error) {
      console.error("Error in handleDocName:", error);
    }
  };

  // Selecting, toggling, deleting and cancelling chats in drawer
  const enterSelectionMode = () => {
    try {
      if (targetSessionId) {
        setSelectedIds([targetSessionId]);
        setIsSelectionMode(true);
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in enterSelectionMode:", error);
    }
  };
  const toggleSelection = (id: string) => {
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
  };
  const deleteSelectedChats = async () => {
    try {
      if (selectedIds.length === 0) return;
      const payload = { session_ids: selectedIds };

      await apiClient.post("/chat/sessions/bulk-delete", payload);
      
      dispatch(removeSessions(selectedIds));
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in deleteSelectionChats:", error);
    }
  };
  const cancelSelection = () => {
    try {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error in createNewChat:", error);
    }
  };

  // Creating newchat, closeing drawer and chat session change
  const createNewChat = async () => {
    try {
      const title = `Study Session ${sessions.length + 1}`;
      const response = await apiClient.post("/chat/sessions", { title });
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
    }
  };
  const createNewChatAndCloseDrawer = () => {
    try {
      createNewChat();
      props.navigation.dispatch(DrawerActions.closeDrawer());
    } catch (error) {
      console.error("Error in CreateNewChatAndCloseDrawer:", error);
    }
  };
  const changeSession = (id: string) => {
    try {
      props.navigation.closeDrawer();
      return dispatch(switchSession(id));
    } catch (error) {
      console.error(error);
    }
  };

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
  };
};

export type ChatDrawerType = ReturnType<typeof ChatDrawerVM>;
