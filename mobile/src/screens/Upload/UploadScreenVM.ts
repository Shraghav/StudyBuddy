import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import "react-native-get-random-values";
import { useDispatch, useSelector } from "react-redux";

import { apiClient } from "../../services/api/api_client";
import { RootState } from "../../store";
import {
  addFiles,
  removeFile,
  setFiles,
  updateFileName,
} from "../../store/slices/FileSlice";
import { removeFiles } from "../../store/slices/ChatSlice";

export const UploadScreenVM = () => {
  // hooks
  const dispatch = useDispatch();
  const uploadedFiles = useSelector((state: RootState) => state.files.files);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [docName, setdocName] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch existing files from Postgres on load
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await apiClient.get("/documents/");
        dispatch(setFiles(response.data));
      } catch (error) {
        console.error("Error fetching files from API:", error);
      }
    };
    fetchFiles();
  }, []);

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

  // Model function to open, close modal
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

  // Confirming rename with backend and updating UI
  const confirmRename = async () => {
    try {
      if (currentFileId && docName.trim()) {
        const finalName = docName.trim().endsWith(".pdf")
          ? docName.trim()
          : `${docName.trim()}.pdf`;

        await apiClient.patch(`/documents/${currentFileId}/rename`, {
          new_name: finalName,
        });

        dispatch(updateFileName({ id: currentFileId, newName: finalName }));
        closeModal();
      }
    } catch (error) {
      console.error("Error in confirmRename:", error);
    }
  };

  const handleDocName = (name: string) => {
    try {
      setdocName(name);
    } catch (error) {
      console.error("Error in setDocName:", error);
    }
  };

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

  // deleting selected files and exiting selection
  const deleteSelectedFiles = async () => {
    try {
      dispatch(removeFiles(selectedIds));
      selectedIds.forEach((id) => dispatch(removeFile(id)));
      await apiClient.delete("/documents/batch", { data: selectedIds });
      
      exitSelection();
    } catch (error) {
      console.error("Error in deleteSelectedFiles:", error);
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

  // Picking documents and storing the embeddings
  const pickDocuments = async () => {
    try {
      // Document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setIsUploading(true);
        for (const asset of result.assets) {
          // Append the data
          const formData = new FormData();
          const cleanName = decodeURIComponent(
            asset.name || `upload_${Date.now()}.pdf`,
          );
          formData.append("file", {
            uri: asset.uri,
            name: cleanName,
            type: "application/pdf",
          } as any);

          // Callling backend to store the data
          const response = await apiClient.post(
            `/documents/upload`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );
          const localFileWithServerId = {
            ...response.data,
            uri: asset.uri,
          };

          dispatch(addFiles([localFileWithServerId]));
        }
      }
    } catch (err) {
      console.error("Error picking/uploading document:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadedFiles,
    pickDocuments,
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
    isUploading,
  };
};;
