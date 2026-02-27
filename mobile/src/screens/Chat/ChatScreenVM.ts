import { useRef, useState } from "react";
import { Alert, FlatList, StyleSheet } from "react-native";
import FileViewer from "react-native-file-viewer";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "../../store";
import {
  addMessage,
  addSession,
  attachDocumentToSession,
} from "../../store/slices/ChatSlice";

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

  // Chat Scenarios
  const selectDocForChat = (docName: string) => {
    try {
      if (currentSessionId) {
        dispatch(
          attachDocumentToSession({ sessionId: currentSessionId, docName }),
        );
        setIsDocModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in selectDocForChat:", error);
    }
  };
  const createNewChat = () => {
    try {
      dispatch(
        addSession({
          id: Date.now().toString(),
          title: `Study Session ${sessions.length + 1}`,
          messages: [],
        }),
      );
    } catch (error) {
      console.error("Error occured in createNewChat:", error);
    }
  };
  const sendMessage = () => {
    try {
      if (!inputText.trim() || !currentSessionId) return;
      dispatch(
        addMessage({
          sessionId: currentSessionId,
          message: {
            id: Math.random().toString(),
            text: inputText.trim(),
            sender: "user",
            timestamp: new Date().toISOString(),
          },
        }),
      );

      setInputText("");
      setTimeout(() => {
        dispatch(
          addMessage({
            sessionId: currentSessionId,
            message: {
              id: Math.random().toString(),
              text: "That's an interesting point! Based on standard principles, here is how I would explain it. What else would you like to know?",
              sender: "ai",
              timestamp: new Date().toISOString(),
            },
          }),
        );
      }, 1200);
    } catch (error) {
      console.error("Error occured in sendMessage:", error);
    }
  };

  // Viewing attached file
  const viewAttachedFile = async () => {
    try {
      const fileToView = availableDocs.find(
        (f) => f.name === currentSession?.attachedDocName,
      );

      if (fileToView && fileToView.uri) {
        try {
          await FileViewer.open(fileToView.uri, {
            showOpenWithDialog: true,
          });
        } catch (error) {
          Alert.alert(
            "Error",
            "Could not open this file. Make sure you have a PDF viewer installed.",
          );
        }
      }
    } catch (error) {
      console.error("Error occured in view attached file:", error);
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
      setIsDocModalVisible(true)
    } catch (error) {
      console.error("Error occured in openDocModal:", error)
    }
  }

  const closeDocModal = () => {
    try {
      setIsDocModalVisible(false)
    } catch (error) {
      console.error("Error occured in closeModal:", error)
    }
  }
  return {
    inputText,
    changeInputText,
    sessions,
    currentSession,
    currentSessionId,
    availableDocs,
    createNewChat,
    sendMessage,
    attachDocumentToSession,
    openDocModal,
    closeDocModal,
    selectDocForChat,
    viewAttachedFile,
    isDocModalVisible,
    styles,
    flatListRef,
  };
};
