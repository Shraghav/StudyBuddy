import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { StyleSheet } from "react-native";
import FileViewer from "react-native-file-viewer";
import "react-native-get-random-values";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";

import { RootState } from "../../store";
import {
  addFiles,
  removeFile,
  updateFileName,
} from "../../store/slices/FileSlice";

export const UploadScreenVM = () => {
  // hooks
  const dispatch = useDispatch();
  const uploadedFiles = useSelector((state: RootState) => state.files.files);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [docName, setdocName] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#ffffff" },
    header: { padding: 30, backgroundColor: "#f0f0f0", borderRadius: 30 },
    title: { fontSize: 24, fontWeight: "bold", color: "#01212b" },
    subtitle: { fontSize: 14, color: "#546E7A", marginTop: 5 },
    content: { flex: 1, paddingHorizontal: 20 },
    uploadBtn: { marginVertical: 20 },
    listContainer: { flex: 1 },
    listHeader: { fontSize: 18, fontWeight: "700", color: "#263238" },
    emptyState: { alignItems: "center", marginTop: 50 },
    emptyText: { fontSize: 16, fontWeight: "600", color: "#90A4AE" },
    emptySubText: { fontSize: 14, color: "#B0BEC5", marginTop: 5 },
    flatListContent: { paddingBottom: 20 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: "#fff",
      borderRadius: 20,
      padding: 25,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      color: "#01212b",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    cancelBtn: { flex: 0.45, backgroundColor: "#90A4AE" },
    saveBtn: { flex: 0.45 },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginVertical: 15,
    },
    actionIcons: { flexDirection: "row", alignItems: "center" },
    iconBtn: { marginLeft: 20 },
    selectedCard: {
      borderColor: "#ff1616",
      borderWidth: 2,
      backgroundColor: "#efc2c2",
    },
    unselectedCard: {
      borderColor: "#00796B",
      borderWidth: 2,
      backgroundColor: "#E0F2F1",
    },
    selectBtn: { backgroundColor: "#263238", marginBottom: 20 },
    iconDimensions: { height: 20, width: 20 },
  });

  // Model function to open, close modal and confirming rename
  const openModal = (id: string, currentName: string) => {
    try {
      setCurrentFileId(id);
      setdocName(currentName.replace(".pdf", ""));
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error occured in openModel:", error);
    }
  };
  const closeModal = () => {
    try {
      setIsModalVisible(false);
      setCurrentFileId(null);
      setdocName("");
    } catch (error) {
      console.error("Error occured in closeModal:", error);
    }
  };
  const confirmRename = () => {
    try {
      if (currentFileId && docName.trim()) {
        const finalName = docName.trim() + ".pdf";
        dispatch(updateFileName({ id: currentFileId, newName: finalName }));
        closeModal();
      }
    } catch (error) {
      console.error("Error occured in confirmRename:", error);
    }
  };
  const handleDocName = (name:string) => {
    try {
      setdocName(name)
    } catch (error) {
      console.error("Error in setDocName:", error)
    }
  }

  // selecting files and toggling the selected files
  const enterSelectionMode = () => {
    try {
      if (currentFileId) {
        setSelectedIds([currentFileId]);
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
        const isAlreadySelected = prev.includes(id);
        let updatedList;

        if (isAlreadySelected) {
          updatedList = prev.filter((item) => item !== id);
        } else {
          updatedList = [...prev, id];
        }
        if (updatedList.length === 0) {
          setIsSelectionMode(false);
        }
        return updatedList;
      });
    } catch (error) {
      console.error("Error occured in toggleSelection:", error);
    }
  };

  // deleting selected files and cancelling scenario
  const deleteSelectedFiles = () => {
    try {
      selectedIds.forEach((id) => dispatch(removeFile(id)));
      exitSelection();
    } catch (error) {
      console.error("Error occured in deleteSelectedFiles:", error);
    }
  };
  const exitSelection = () => {
    try {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in exit selection:", error);
    }
  };

  // Picking up pdfs from mobile files
  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const newFiles = result.assets.map((asset) => ({
          id: uuidv4(),
          uri: asset.uri,
          name: asset.name,
          uploadDate: new Date().toISOString(),
        }));
        dispatch(addFiles(newFiles));
      }
    } catch (err) {
      console.error("Error picking documents:", err);
    }
  };

  // Viewing and renaming file
  const viewFile = async (uri: string) => {
    try {
      await FileViewer.open(uri, {
        showOpenWithDialog: true,
        showAppsSuggestions: true,
      });
    } catch (error) {
      console.error("Error occured in viewFile:", error);
    }
  };
  const renameFile = async (id: string, newName: string) => {
    try {
      const docName = newName.endsWith(".pdf") ? newName : `${newName}.pdf`;
      dispatch(updateFileName({ id, newName: docName }));
      return true;
    } catch (error) {
      console.error("Error occured in rename File:", error);
      return false;
    }
  };

  return {
    uploadedFiles,
    pickDocuments,
    viewFile,
    renameFile,
    openModal,
    closeModal,
    isModalVisible,
    docName,
    handleDocName,
    confirmRename,
    deleteSelectedFiles,
    exitSelection,
    enterSelectionMode,
    toggleSelection,
    isSelectionMode,
    selectedIds,
    styles,
  };
};
