import { decode } from "base64-arraybuffer";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import "react-native-get-random-values";
import { useDispatch, useSelector } from "react-redux";

import { useTheme } from "react-native-paper";
import { apiClient } from "../../services/api/api_client";
import { supabase } from "../../services/db/superbase";
import { RootState } from "../../store";
import { removeFiles } from "../../store/slices/ChatSlice";
import {
  addFiles,
  removeMultipleFiles,
  setFiles,
  updateFileName,
} from "../../store/slices/FileSlice";
import { AppTheme } from "../../utils/themes";

export const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      padding: 30,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.onSurfaceVariant,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 5,
    },
    content: { flex: 1, paddingHorizontal: 20 },
    uploadBtn: {
      padding: 15,
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    listContainer: { flex: 1 },
    listHeader: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.onSurface,
    },
    emptyState: { alignItems: "center", marginTop: 50 },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.onSurfaceVariant,
    },
    errorText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.error,
    },
    emptySubText: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 5,
    },
    flatListContent: { paddingBottom: 20 },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      justifyContent: "center",
      padding: 25,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 25,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
      color: theme.colors.onSurface,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    cancelBtn: { flex: 0.45 },
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
      borderColor: theme.colors.error,
      borderWidth: 2,
      backgroundColor: theme.colors.errorContainer,
    },
    unselectedCard: {
      borderColor: theme.colors.primary,
      borderWidth: 1,
      backgroundColor: theme.colors.primaryContainer,
    },
    selectBtn: { backgroundColor: theme.colors.secondary },
    iconDimensions: { height: 20, width: 20 },
    initialLoadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    deleteloading: { position: "absolute", right: 65 },
    analyzingPdfText: {
      marginTop: 8,
      color: theme.colors.primary,
      fontWeight: "bold",
    },
    uploadDocText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });

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
  const [isCooldown, setIsCooldown] = useState(true);
  const [error, setError] = useState<String>();
  const theme = useTheme<AppTheme>();
  const styles = makeStyles(theme);
  const COOLDOWN_TIME_MS = 7000;

  // Fetch existing files from Postgres on load
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await apiClient.get(`/documents/`);
        dispatch(setFiles(response.data));
      } catch (error) {
        setError("An unknown error occured, please try again");
        console.error("Error fetching files from API:", error);
      } finally {
        setIsLoadingInitial(false);
        setIsCooldown(false);
      }
    };
    fetchFiles();
  }, [dispatch]);

  // Model function to open, close modal
  const openModal = useCallback((id: string, currentName: string) => {
    try {
      setCurrentFileId(id);
      setdocName(currentName.replace(".pdf", ""));
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error occured in openModel:", error);
    }
  }, []);
  const closeModal = useCallback(() => {
    try {
      setIsModalVisible(false);
      setCurrentFileId(null);
      setdocName("");
    } catch (error) {
      console.error("Error occured in closeModal:", error);
    }
  }, []);

  // Confirming rename with backend and updating UI
  const confirmRename = useCallback(async () => {
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
  }, [currentFileId, docName, dispatch, closeModal]);

  const handleDocName = useCallback((name: string) => {
    try {
      setdocName(name);
    } catch (error) {
      console.error("Error in setDocName:", error);
    }
  }, []);

  // selecting files and toggling the selected files
  const enterSelectionMode = useCallback(() => {
    try {
      if (currentFileId) {
        setSelectedIds([currentFileId]);
        setIsSelectionMode(true);
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error("Error occured in enterSelectionMode:", error);
    }
  }, [currentFileId]);
  const toggleSelection = useCallback((id: string) => {
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
  }, []);

  // deleting selected files and exiting selection
  const exitSelection = useCallback(() => {
    try {
      setIsSelectionMode(false);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error occured in exit selection:", error);
    }
  }, []);
  const deleteSelectedFiles = useCallback(async () => {
    try {
      setIsDeleteLoading(true);
      await apiClient.delete(`/documents/batch`, {
        data: selectedIds,
      });
      dispatch(removeFiles(selectedIds));
      dispatch(removeMultipleFiles(selectedIds));
      exitSelection();
    } catch (error) {
      console.error("Error in deleteSelectedFiles:", error);
    } finally {
      setIsDeleteLoading(false);
    }
  }, [selectedIds, dispatch, exitSelection]);

  // Picking documents and storing the embeddings
  const pickDocuments = useCallback(async () => {
    try {
      if (isUploading || isCooldown) return;
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
      console.log("Pick up docs:", result.assets)
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
          // 4. Calling backend with JSON
          const response = await apiClient.post(`/documents/upload`, {
            name: asset.name,
            file_url: publicUrl,
            size: asset.size,
          });
          console.log("Doc after response from backend");
          const localFileWithServerId = {
            ...response.data,
            uri: asset.uri,
          };

          dispatch(addFiles([localFileWithServerId]));
        }
      }
      console.log("Data after loading doc")
    } catch (err) {
      console.error("Error picking/uploading document:", err);
    } finally {
      setIsUploading(false);
      setIsCooldown(true);
      setTimeout(() => {
        setIsCooldown(false);
      }, COOLDOWN_TIME_MS);
    }
  }, [isUploading, isCooldown, dispatch]);

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
    theme,
    error,
  };
};
