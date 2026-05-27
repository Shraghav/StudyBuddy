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

  const renderMessageItem: ListRenderItem<Message> = useCallback(({ item }) => {
    const isAI = item.sender === 'ai';
    const isEmpty = item.text.trim() === "";

    return (
      <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
        {isAI ? (
          isEmpty ? (
            <Text style={styles.aiText}>
              {vm.dots}
            </Text>
          ) : (
            <Markdown style={{ body: styles.aiText }}>
              {item.text}
            </Markdown>
          )
        ) : (
          <Text style={styles.userText}>{item.text}</Text>
        )}
      </View>
    );
  }, [styles, vm.dots]);

  const renderDocItem: ListRenderItem<FileDetail> = useCallback(({ item }) => {
    const isThisItemLoading = vm.submittingDocId === item.id;
    return (
      <CustomButton
        viewstyle={styles.docItem}
        onPress={() => vm.selectDocForChat(item)}
        title={"📄 " + item.name} loading={isThisItemLoading}
        textStyle={styles.docItemText} />
    )
  }, [styles, vm.selectDocForChat, vm.submittingDocId]);

  const renderDocModalFooter = useCallback(() => {
    if (!vm.isChatLoading) return null;
    return (
      <View style={[styles.bubble, styles.aiBubble, { width: 60, alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={vm.theme.colors.primary} />
      </View>
    );
  }, [vm.isChatLoading, styles]);

  const handleContentSizeChange = useCallback(() => {
    try {
      vm.flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error occured in handleContnt Size Change:", error)
    }
  }, [vm.flatListRef]);

  return (
    <View style={[styles.overallContainer, { paddingTop: insets.top - 10 }]}>
      <KeyboardAvoidingView
        style={styles.subContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.customHeader}>
          <DrawerMenu />
          <Text style={styles.headerTitle} numberOfLines={1}>{vm.currentSession?.title}</Text>
        </View>

        {
          vm.sessionLoading ? <View style={styles.sessionLoaderContent}>
            <ActivityIndicator size="large" color={vm.theme.colors.primary} />
            <Text style={styles.emptyText}>Loading your Chats...</Text>
          </View> :
            <View style={styles.subContainer}>
              <View style={styles.docBanner}>
                <View
                  style={styles.attachedFileContainer}
                >
                  <Text style={styles.docText}>
                    {vm.currentSession?.attachedDocName ? (
                      <>
                        <Text style={styles.fileNameText}>
                          📄 {vm.currentSession.attachedDocName}
                        </Text>
                      </>
                    ) : (
                      "No document attached"
                    )}
                  </Text>
                </View>
                <CustomButton
                  onPress={vm.openDocModal}
                  viewstyle={styles.attachBtn}
                  textStyle={styles.attachBtnText}
                  title='+ Attach PDF' />
              </View>

              <FlatList
                ref={vm.flatListRef}
                data={vm.currentSession?.messages}
                keyExtractor={vm.keyExtractor}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={handleContentSizeChange}
                renderItem={renderMessageItem}
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
                  <Image tintColor={vm.theme.colors.onBackground} source={Images.send} style={styles.sendIconSize} resizeMode='contain' />
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
                style={styles.availableDocsMaxHeight}
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