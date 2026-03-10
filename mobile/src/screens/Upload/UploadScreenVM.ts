import { decode } from "base64-arraybuffer";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import "react-native-get-random-values";
import { useDispatch, useSelector } from "react-redux";

import { apiClient } from "../../services/api/api_client";
import { supabase } from "../../services/db/superbase";
import { RootState } from "../../store";
import { removeFiles } from "../../store/slices/ChatSlice";
import {
  addFiles,
  removeFile,
  setFiles,
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
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const COOLDOWN_TIME_MS = 10000;

  // Fetch existing files from Postgres on load
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await apiClient.get("/documents/");
        dispatch(setFiles(response.data));
      } catch (error) {
        console.error("Error fetching files from API:", error);
      } finally {
        setIsLoadingInitial(false);
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
    uploadBtn: { marginVertical: 20, opacity: isCooldown ? 0.5 : 1 },
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
    uploadBtnTxt: { color: isCooldown ? "#262f33" :"white"},
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
      setIsDeleteLoading(true);
      await apiClient.delete("/documents/batch", { data: selectedIds });
      dispatch(removeFiles(selectedIds));
      selectedIds.forEach((id) => dispatch(removeFile(id)));
      exitSelection();
    } catch (error) {
      console.error("Error in deleteSelectedFiles:", error);
    } finally {
      setIsDeleteLoading(false);
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
      if (isUploading || isCooldown) return;
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        setIsUploading(true);
        for (const asset of result.assets) {
          // 1. Prepare File for Supabase (React Native needs an ArrayBuffer)
          const file = new FileSystem.File(asset.uri);

          // 2. Read the base64 content
          const base64 = await file.base64();

          const fileName = `${Date.now()}_${asset.name}`;
          const filePath = `uploads/${fileName}`;
          const { data: uploadData, error: uploadError } =
            await supabase.storage
              .from("study-buddy-docs")
              .upload(filePath, decode(base64), {
                contentType: "application/pdf",
              });
          if (uploadError) throw uploadError;

          // 3. Get the Public URL from Supabase
          const { data: urlData } = supabase.storage
            .from("study-buddy-docs")
            .getPublicUrl(filePath);

          const publicUrl = urlData.publicUrl;
          // 4. Calling backend with JSON (No more formData!)
          const response = await apiClient.post(`/documents/upload`, {
            name: asset.name,
            file_url: publicUrl,
            size: asset.size!,
          });
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
      setIsCooldown(true);
      setTimeout(() => {
        setIsCooldown(false);
      }, COOLDOWN_TIME_MS);
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
    isLoadingInitial,
    isDeleteLoading,
    isCooldown,
  };
};
