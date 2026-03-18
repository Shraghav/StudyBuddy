import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { useTheme } from "react-native-paper";
import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import {
  addMessage,
  attachDocumentToSession,
} from "../../store/slices/ChatSlice";
import { FileDetail } from "../../store/slices/FileSlice";
import { AppTheme } from "../../utils/themes";

export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overallContainer: { flex: 1, backgroundColor: theme.colors.background },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    subContainer: { flex: 1 },
    emptyText: { color: theme.colors.onSurfaceVariant, fontSize: 16 },
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
    docBanner: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    attachBtn: {
      backgroundColor: theme.colors.onSurfaceVariant,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
      marginBottom: 6,
    },
    attachBtnText: {
      color: theme.colors.onSecondary,
      fontSize: 8,
      fontWeight: "bold",
    },
    messageList: { padding: 20, paddingBottom: 20 },
    bubble: {
      padding: 12,
      borderRadius: 20,
      marginBottom: 15,
      maxWidth: "85%",
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.onPrimaryContainer,
      borderBottomRightRadius: 5,
      borderWidth: 1,
      borderColor: theme.colors.onPrimary,
    },
    aiBubble: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.surfaceVariant,
      borderBottomLeftRadius: 5,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    userText: { color: theme.colors.onPrimary, fontSize: 16 },
    aiText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 22,
    },
    inputContainer: {
      flexDirection: "row",
      padding: 5,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderColor: theme.colors.outlineVariant,
      alignItems: "center",
    
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      color: theme.colors.onSurface, 
      borderRadius: 25,
      paddingHorizontal: 20,
      maxHeight: 100,
      fontSize: 16,
      marginRight: 5,
      paddingVertical:20
    },
    sendIcon: { color: theme.colors.onPrimary, fontSize: 20 },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 25,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.primary,
      marginBottom: 15,
    },
    emptyModalText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginVertical: 20,
    },
    docItem: {
      padding: 15,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    docItemText: {
      fontSize: 16,
      color: theme.colors.onSurfaceVariant,
      fontWeight: "500",
    },
    closeModalBtn: {
      marginTop: 10,
      padding: 15,
      backgroundColor: theme.colors.onSurfaceVariant,
      borderRadius: 10,
      alignItems: "center",
    },
    closeModalBtnText: {
      color: theme.colors.onSecondary,
      fontWeight: "bold",
      fontSize: 16,
    },
    docText: {
      flex: 1,
      color: theme.colors.primary,
    },
    fileNameText: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.colors.primary,
    },
    tapToViewText: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
  });

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

  const [error,setError] = useState<String>()
  const theme = useTheme<AppTheme>()
  const styles = makeStyles(theme)


  const attachedFile = useSelector((state: RootState) =>
    state.files.files.find((f) => f.id === currentSession?.attachedDocId),
  );

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
  const selectDocForChat = useCallback(
    async (doc: FileDetail) => {
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
    },
    [currentSessionId, dispatch],
  );

  // Sending AI response and handling the user and ai messages
  const sendMessage = useCallback(async () => {
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
  }, [inputText, currentSessionId, currentSession, availableDocs, dispatch]);

  // Setting state variables
  const changeInputText = useCallback((text: string) => {
    try {
      setInputText(text);
    } catch (error) {
      console.error("Error occured in changeInputText:", error);
    }
  }, []);

  const openDocModal = useCallback(() => {
    try {
      setIsDocModalVisible(true);
    } catch (error) {
      console.error("Error occured in openDocModal:", error);
    }
  }, []);
  const closeDocModal = useCallback(() => {
    try {
      setIsDocModalVisible(false);
    } catch (error) {
      console.error("Error occured in closeModal:", error);
    }
  }, []);

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
    theme
  };
};
