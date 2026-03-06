import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import {
  addMessage,
  attachDocumentToSession,
} from "../../store/slices/ChatSlice";
import { FileDetail } from "../../store/slices/FileSlice";

export const ChatScreenVM = () => {
  const dispatch = useDispatch();

  // Select Modal in Drawer and other setters
  const flatListRef = useRef<FlatList>(null);
  const [isDocModalVisible, setIsDocModalVisible] = useState(false);

  //Session and docs
  const sessions = useSelector((state: RootState) => state.chat.sessions);
  const currentSessionId = useSelector(
    (state: RootState) => state.chat.currentSessionId,
  );
  const currentSession = sessions.find((s) => s.id == currentSessionId);
  const availableDocs = useSelector((state: RootState) => state.files.files);
  const [inputText, setInputText] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [dots, setDots] = useState(".");

  const attachedFile = useSelector((state: RootState) =>
    state.files.files.find((f) => f.id === currentSession?.attachedDocId),
  );
  ("");
  const styles = StyleSheet.create({
    overallContainer: { flex: 1, backgroundColor: "#FFFFFF" },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F0F4F8",
    },
    subContainer: { flex: 1 },
    emptyText: { color: "#546E7A", fontSize: 16 },
    attachedFileContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    customHeader: {
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

    docBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#E0F2F1",
      paddingHorizontal: 15,
      paddingVertical: 10,
    },
    attachBtn: {
      backgroundColor: "#004D40",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
      marginBottom: 6,
    },
    attachBtnText: { color: "#FFF", fontSize: 8, fontWeight: "bold" },

    messageList: { padding: 20, paddingBottom: 20 },
    bubble: {
      padding: 15,
      borderRadius: 20,
      marginBottom: 15,
      maxWidth: "85%",
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: "#00796B",
      borderBottomRightRadius: 5,
    },
    aiBubble: {
      alignSelf: "flex-start",
      backgroundColor: "#F0F4F8",
      borderBottomLeftRadius: 5,
    },
    userText: { color: "#FFF", fontSize: 16 },
    aiText: { color: "#263238", fontSize: 16, lineHeight: 22 },

    inputContainer: {
      flexDirection: "row",
      padding: 15,
      backgroundColor: "#FFF",
      borderTopWidth: 1,
      borderColor: "#E1E8ED",
      alignItems: "center",
    },
    input: {
      flex: 1,
      backgroundColor: "#F5F7F9",
      borderRadius: 25,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      maxHeight: 100,
      fontSize: 16,
    },
    sendIcon: { color: "#FFF", fontSize: 20 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: "#FFF",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 25,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#004D40",
      marginBottom: 15,
    },
    emptyModalText: {
      fontSize: 14,
      color: "#546E7A",
      textAlign: "center",
      marginVertical: 20,
    },
    docItem: {
      padding: 15,
      backgroundColor: "#F0F4F8",
      borderRadius: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E1E8ED",
    },
    docItemText: { fontSize: 16, color: "#263238", fontWeight: "500" },
    closeModalBtn: {
      marginTop: 10,
      padding: 15,
      backgroundColor: "#5ba6cb",
      borderRadius: 10,
      alignItems: "center",
    },
    closeModalBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
    docText: {
      flex: 1,
      // Note: Removed color/fontSize from here to let children handle it
    },
    fileNameText: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#00796B", // Study Buddy Teal
    },
    tapToViewText: {
      fontSize: 12,
      color: "#90A4AE", // Gray color
      marginTop: 2,
    },
  });

  useEffect(() => {
    let interval: any;
    if (isChatLoading) {
      interval = setInterval(
        () => setDots((p) => (p.length < 3 ? p + "." : ".")),
        400,
      );
    }
    return () => clearInterval(interval);
  }, [isChatLoading]);

  // Chat Scenarios
  const selectDocForChat = async (doc: FileDetail) => {
    try {
      if (!currentSessionId) {
        console.error("No session available to attach");
        return;
      }
      await apiClient.patch(`/chat/${currentSessionId}/attach/${doc.id}`);
      dispatch(
        attachDocumentToSession({
          sessionId: currentSessionId,
          docName: doc.name,
          docId: doc.id,
        }),
      );
      setIsDocModalVisible(false);
    } catch (error) {
      console.error("Attachment failed:", error);
    }
  };

  // Sending AI response and handling the user and ai messages
  const sendMessage = async () => {
    try {
      if (!inputText.trim() || !currentSessionId) return;
      const userText = inputText.trim();

      // Displaying user message
      dispatch(
        addMessage({
          sessionId: currentSessionId,
          message: {
            id: Date.now().toString(),
            text: userText,
            sender: "user",
            timestamp: new Date().toISOString(),
          },
        }),
      );
      setInputText("");

      // Ensuring a document is attached
      const attachedDoc = availableDocs.find(
        (d) => d.name === currentSession?.attachedDocName,
      );
      if (!attachedDoc || !attachedDoc.id) {
        dispatch(
          addMessage({
            sessionId: currentSessionId,
            message: {
              id: Date.now().toString(),
              text: "Please attach a PDF document from the menu to ask questions about it.",
              sender: "ai",
              timestamp: new Date().toISOString(),
            },
          }),
        );
        return;
      }

      // Calling FastAPI backend
      setIsChatLoading(true);
      const response = await apiClient.post(
        `/chat/${currentSessionId}/${attachedDoc.id}`,
        {
          question: userText,
        },
      );
      const aiText = response.data.content.answer;

      // Displaying AI Response
      dispatch(
        addMessage({
          sessionId: currentSessionId,
          message: {
            id: Date.now().toString(),
            text: aiText,
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      console.error("Error sending message to backend:", error);
      dispatch(
        addMessage({
          sessionId: currentSessionId!,
          message: {
            id: Date.now().toString(),
            text: "StudyBuddy encountered an error retrieving the answer. Please try again.",
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  // Setting state variables
  const changeInputText = (text: string) => {
    try {
      setInputText(text);
    } catch (error) {
      console.error("Error occured in changeInputText:", error);
    }
  };

  const openDocModal = () => {
    try {
      setIsDocModalVisible(true);
    } catch (error) {
      console.error("Error occured in openDocModal:", error);
    }
  };
  const closeDocModal = () => {
    try {
      setIsDocModalVisible(false);
    } catch (error) {
      console.error("Error occured in closeModal:", error);
    }
  };

  return {
    inputText,
    changeInputText,
    sessions,
    currentSession,
    currentSessionId,
    availableDocs,
    sendMessage,
    openDocModal,
    closeDocModal,
    selectDocForChat,
    isDocModalVisible,
    styles,
    flatListRef,
    isChatLoading,
    dots,
    attachedFile,
  };
};
