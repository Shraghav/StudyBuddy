import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, ListRenderItem, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import DrawerMenu from '../../components/Drawer/Drawer';
import { Message } from '../../store/slices/ChatSlice';
import { FileDetail } from '../../store/slices/FileSlice';
import { Images } from '../../utils/Images';
import { ChatScreenVM } from './ChatScreenVM';

export const ChatScreen = () => {
  const vm = ChatScreenVM();
  const styles = vm.styles
  const insets = useSafeAreaInsets();
  const renderMessageItem: ListRenderItem<Message> = useCallback(({ item }) => (
    <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
      {item.sender === 'user' ? (
        <Text style={styles.userText}>{item.text}</Text>
      ) : (
        <Markdown style={{ body: styles.aiText, strong: { fontWeight: 'bold' } }}>
          {item.text}
        </Markdown>
      )}
    </View>
  ), [styles]);

  const renderDocItem: ListRenderItem<FileDetail> = useCallback(({ item }) => (
    <TouchableOpacity style={styles.docItem} onPress={() => vm.selectDocForChat(item)}>
      <Text style={styles.docItemText}>📄 {item.name}</Text>
    </TouchableOpacity>
  ), [styles, vm.selectDocForChat]);

  const renderMessageFooter = useCallback(() => {
    if (!vm.isChatLoading) return null;
    return (
      <View style={[styles.bubble, styles.aiBubble, { width: 50, padding: 10 }]}>
        <Text style={[styles.aiText, { fontWeight: 'bold', fontSize: 20 }]}>
          {vm.dots}
        </Text>
      </View>
    );
  }, [vm.isChatLoading, vm.dots, styles]);

  const renderDocModalFooter = useCallback(() => {
    if (!vm.isChatLoading) return null;
    return (
      <View style={[styles.bubble, styles.aiBubble, { width: 60, alignItems: 'center' }]}>
        <ActivityIndicator size="small" color="#00796B" />
      </View>
    );
  }, [vm.isChatLoading, styles]);

  const handleContentSizeChange = useCallback(() => {
    vm.flatListRef.current?.scrollToEnd({ animated: true });
  }, [vm.flatListRef]);

  const keyExtractor = useCallback((item: any) => item.id, []);
  
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
          vm.isSessionsLoading ? (
            // 1. Show this while Supabase is fetching
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#00796B" />
              <Text style={[styles.emptyText, { marginTop: 15 }]}>Loading your study sessions...</Text>
            </View>
          ) :
            !vm.currentSession ? <View style={[styles.emptyContainer]}>
              <Text style={styles.emptyText}>Open the drawer to create a chat.</Text>
            </View> :
              <View style={styles.subContainer}>
                <View style={styles.docBanner}>
                  <View
                    style={styles.attachedFileContainer}
                  >
                    <Text style={styles.docText}>
                      {vm.attachedFile?.name ? (
                        <>
                          <Text style={styles.fileNameText}>
                            📄 {vm.attachedFile.name}
                          </Text>
                        </>
                      ) : (
                        "No document attached"
                      )}
                    </Text>
                  </View>
                  <CustomButton onPress={vm.openDocModal} viewstyle={styles.attachBtn} textStyle={styles.attachBtnText} title='+ Attach PDF' />
                </View>


                <FlatList
                  ref={vm.flatListRef}
                  data={vm.currentSession?.messages}
                  keyExtractor={keyExtractor}
                  contentContainerStyle={styles.messageList}
                  onContentSizeChange={handleContentSizeChange}
                  renderItem={renderMessageItem}
                  ListFooterComponent={
                    renderMessageFooter
                  }
                />

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask a question..."
                    placeholderTextColor={"gray"}
                    value={vm.inputText}
                    onChangeText={vm.changeInputText}
                    multiline
                    editable={!vm.isChatLoading}
                  />
                  <TouchableOpacity onPress={vm.sendMessage} disabled={vm.isChatLoading}>
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
                renderItem={renderDocItem}
                ListFooterComponent={
                  renderDocModalFooter
                }
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