import React from 'react';
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DrawerMenu from '../../components/Drawer/Drawer';
import { ChatScreenVM } from './ChatScreenVM';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import { Images } from '../../utils/Images';

export const ChatScreen = () => {
  const vm = ChatScreenVM();
  const styles = vm.styles
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.overallContainer, { paddingTop: insets.top - 10 }]}>
      <KeyboardAvoidingView
        style={styles.subContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.customHeader}>
          <DrawerMenu />
          <Text style={styles.headerTitle} numberOfLines={1}>{vm.currentSession?.title}</Text>
        </View>

        {
          !vm.currentSession ? <View style={[styles.emptyContainer]}>
            <Text style={styles.emptyText}>Open the drawer to create a chat.</Text>
          </View> :
            <View style={styles.subContainer}>
              <View style={styles.docBanner}>
                <TouchableOpacity
                  onPress={vm.viewAttachedFile}
                  style={styles.attachedFileContainer}
                >
                  <Text style={styles.docText}>
                    {vm.currentSession?.attachedDocName ? (
                      <>
                        <Text style={styles.fileNameText}>
                          📄 {vm.currentSession.attachedDocName}
                        </Text>
                        {"\n\t\t "}
                        <Text style={styles.tapToViewText}>
                          Tap to view
                        </Text>
                      </>
                    ) : (
                      "No document attached"
                    )}
                  </Text>
                </TouchableOpacity>
                <CustomButton onPress={vm.openDocModal} viewstyle={styles.attachBtn} textStyle={styles.attachBtnText} title='+ Attach PDF' />
              </View>

              <FlatList
                ref={vm.flatListRef}
                data={vm.currentSession?.messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => vm.flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => (
                  <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                    <Text style={item.sender === 'user' ? styles.userText : styles.aiText}>{item.text}</Text>
                  </View>
                )}
              />

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask a question..."
                  placeholderTextColor={"gray"}
                  value={vm.inputText}
                  onChangeText={vm.changeInputText}
                  multiline
                />
                <TouchableOpacity onPress={vm.sendMessage}>
                  <Image source={Images.send} style={{ width: 30, height: 30 }} resizeMode='contain' />
                </TouchableOpacity>
              </View>
            </View>
        }
      </KeyboardAvoidingView>

      <Modal visible={vm.isDocModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Study Material</Text>
            {vm.availableDocs.length === 0 ? (
              <Text style={styles.emptyModalText}>No PDF files uploaded yet. Go to the Upload first!</Text>
            ) : (
              <FlatList
                data={vm.availableDocs}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.docItem} onPress={() => vm.selectDocForChat(item.name)}>
                    <Text style={styles.docItemText}>📄 {item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={vm.closeDocModal}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

