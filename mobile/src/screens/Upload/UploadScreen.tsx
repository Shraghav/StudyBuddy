import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Image, ListRenderItem, Modal, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { FileCard } from '../../components/FileCard/FileCard';
import { FileDetail } from '../../store/slices/FileSlice';
import { Images } from '../../utils/Images';
import { UploadScreenVM } from './UploadScreenVM';

export const UploadScreen = () => {
  const vm = UploadScreenVM();
  const styles = vm.styles
  const insets = useSafeAreaInsets();

  const renderItem: ListRenderItem<FileDetail> = useCallback(({ item }) => {
    const isSelected = vm.selectedIds.includes(item.id);
    return (
      <FileCard
        name={item.name}
        onPress={() => {
          vm.isSelectionMode ? vm.toggleSelection(item.id) : vm.openModal(item.id, item.name);
        }}
        style={isSelected ? styles.selectedCard : styles.unselectedCard}
      />
    );
  }, [vm.isSelectionMode, vm.selectedIds, vm.toggleSelection, vm.openModal, styles]);

  const keyExtractor = useCallback((item: any, index: number) => {
    return item.id ? String(item.id) : `temp-${index}`;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom - 10 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Study Material</Text>
        <Text style={styles.subtitle}>Upload PDFs to get started</Text>
      </View>

      <View style={styles.content}>
        {!vm.isSelectionMode && (
          vm.isUploading ? (
            <View style={styles.uploadBtn}>
              <ActivityIndicator size="small" color={vm.theme.colors.primary} />
              <Text style={styles.analyzingPdfText}>
                Analyzing & Embedding PDF...
              </Text>
            </View>
          ) : (
            <CustomButton title={vm.isCooldown ? "Just a moment....." : "Upload PDF"} onPress={vm.pickDocuments}
              textStyle={styles.uploadDocText}
              viewstyle={styles.uploadBtn} disabled={vm.isCooldown} />
          )
        )}

        <View style={styles.listContainer}>
          <View style={styles.rowHeader}>
            <Text style={styles.listHeader}>
              {vm.isSelectionMode && vm.selectedIds.length > 0 ? `${vm.selectedIds.length} Selected` : "Recently Uploaded"}
            </Text>

            {vm.isSelectionMode && vm.selectedIds.length > 0 && (
              <View style={styles.actionIcons}>
                <TouchableOpacity onPress={vm.deleteSelectedFiles} style={styles.iconBtn}>
                  <Image source={Images.delete} style={styles.iconDimensions} resizeMode='contain' />
                </TouchableOpacity>
                <TouchableOpacity onPress={vm.exitSelection} style={styles.iconBtn}>
                  <Image source={Images.cancel} style={styles.iconDimensions} resizeMode='contain' />
                </TouchableOpacity>
              </View>
            )}
            {vm.isDeleteLoading && (
              <View style={styles.deleteloading}>
                <ActivityIndicator animating={true} size="small" color={vm.theme.colors.primary} />
              </View>
            )}
          </View>

          {vm.error ? (
            <View style={styles.initialLoadingContainer}>
              <Text style={styles.errorText}>
                {vm.error}
              </Text>
            </View>
          ) : vm.isLoadingInitial ? (
            <View style={styles.initialLoadingContainer}>
              <ActivityIndicator
                animating={true}
                size="large"
                color={vm.theme.colors.primary}
              />
              <Text style={styles.emptyText}>Loading your uploaded documents...</Text>
            </View>
          ) : (
            <FlatList
              data={vm.uploadedFiles}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No files uploaded yet.</Text>
                  <Text style={styles.emptySubText}>
                    Select multiple PDFs to see them here.
                  </Text>
                </View>
              }
              contentContainerStyle={styles.flatListContent}
            />
          )}
        </View>
      </View>

      <Modal visible={vm.isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Study Material</Text>
            <TextInput
              mode="outlined"
              label="Rename File"
              value={vm.docName}
              onChangeText={vm.handleDocName}
              placeholder="Enter new name"
            />
            <CustomButton
              title="Select this file"
              onPress={vm.enterSelectionMode}
              viewstyle={styles.selectBtn}
            />
            <View style={styles.modalActions}>
              <CustomButton
                title="Cancel"
                onPress={vm.closeModal}
                viewstyle={styles.cancelBtn}
              />
              <CustomButton
                title="Save Name"
                onPress={vm.confirmRename}
                viewstyle={styles.saveBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

