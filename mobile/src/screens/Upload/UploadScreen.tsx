import React from 'react';
import { FlatList, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import { FileCard } from '../../components/FileCard/FileCard';
import { Images } from '../../utils/Images';
import { UploadScreenVM } from './UploadScreenVM';


export const UploadScreen = () => {
  const vm = UploadScreenVM();
  const styles = vm.styles
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom - 10 }]}>
      {/* Header to upload pdf files */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Study Material</Text>
        <Text style={styles.subtitle}>Upload PDFs to get started</Text>
      </View>

      {/* To display the selected files */}
      <View style={styles.content}>
        {!vm.isSelectionMode && (
          <CustomButton title="Upload PDF Files" onPress={vm.pickDocuments} viewstyle={styles.uploadBtn} />
        )}

        <View style={styles.listContainer}>
          <View style={styles.rowHeader}>
            <Text style={styles.listHeader}>
              {vm.isSelectionMode && vm.selectedIds.length > 0 ? `${vm.selectedIds.length} Selected` : "Recently Uploaded"}
            </Text>

            {/* selected files to delete */}
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
          </View>

          <FlatList
            data={vm.uploadedFiles}
            keyExtractor={(item, index) => item.uri + index}
            renderItem={({ item }) => {
              const isSelected = vm.selectedIds.includes(item.id);
              return (
                <FileCard
                  name={item.name}
                  onPress={() => vm.isSelectionMode ? vm.toggleSelection(item.id) : vm.viewFile(item.uri)}
                  onLongPress={() => !vm.isSelectionMode && vm.openModal(item.id, item.name)}
                  style={isSelected ? styles.selectedCard : styles.unselectedCard}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No files uploaded yet.</Text>
                <Text style={styles.emptySubText}>Select multiple PDFs to see them here.</Text>
              </View>
            }
            contentContainerStyle={styles.flatListContent}
          />
        </View>
      </View>

      {/* Modal to rename and select file */}
      <Modal visible={vm.isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Study Material</Text>

            <CustomInput
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

