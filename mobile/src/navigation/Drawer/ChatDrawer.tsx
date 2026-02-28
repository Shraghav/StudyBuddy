import { createDrawerNavigator, DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import React from 'react';
import { Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import { ChatScreen } from '../../screens/Chat/ChatScreen';
import { ChatSession } from '../../store/slices/ChatSlice';
import { Images } from '../../utils/Images';
import { ChatDrawerType, ChatDrawerVM } from './ChatDrawerVM';


const Drawer = createDrawerNavigator();

interface CustomDrawerProps extends DrawerContentComponentProps {
    vm: ChatDrawerType;
    styles: ChatDrawerType['styles'];
}
const CustomDrawerContent = (props: CustomDrawerProps) => {
    // Drawer Items
    const SessionItem = ({ session, isActive, isSelected }: { session: ChatSession, isActive: boolean, isSelected: boolean }) => {
        return (
            <TouchableOpacity
                key={session.id}
                style={[styles.historyItem, isActive && styles.historyItemActive, isSelected && styles.selectedItem]}
                onPress={() => {
                    if (vm.isSelectionMode) vm.toggleSelection(session.id);
                    else { vm.changeSession(session.id); props.navigation.closeDrawer(); }
                }}
                onLongPress={() => !vm.isSelectionMode && vm.openModal(session.id, session.title)}
            >
                <Text style={[styles.historyText, isActive && styles.historyTextActive]} numberOfLines={1}>
                    💬 {session.title}
                </Text>
            </TouchableOpacity>
        )
    }
    const vm = props.vm
    const styles = vm.styles
    const insets = useSafeAreaInsets();
    return (
        <DrawerContentScrollView {...props} contentContainerStyle={[styles.drawerContainer, { paddingTop: insets.top }]}>
            {/* Header to attach pdf */}
            <View style={styles.drawerHeader}>
                <Text style={styles.logoText}>📚 StudyBuddy</Text>
            </View>

            {!vm.isSelectionMode && (
                <View style={styles.newChatContainer}>
                    <CustomButton title="+ New Chat" onPress={vm.createNewChatAndCloseDrawer} viewstyle={styles.newChatBtn} />
                </View>
            )}

            {/* List of documents attached */}
            <View style={styles.rowHeader}>
                <Text style={styles.historyLabel}>
                    {vm.isSelectionMode ? `${vm.selectedIds.length} Selected` : "Previous Sessions"}
                </Text>
                {vm.isSelectionMode && (
                    <View style={styles.actionIcons}>
                        <TouchableOpacity onPress={vm.deleteSelectedChats} style={styles.iconBtn}>
                            <Image source={Images.delete} style={{ height: 20, width: 20 }} resizeMode='contain' />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={vm.cancelSelection} style={styles.iconBtn}>
                            <Image source={Images.cancel} style={{ height: 25, width: 20 }} resizeMode='contain' />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Passing items */}
            {vm.sessions.map((session: ChatSession) => (
                <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === vm.currentSessionId && !vm.isSelectionMode}
                    isSelected={vm.selectedIds.includes(session.id)}
                />
            ))}

            {/* Ways to rename, select and cancel in modal */}
            <Modal visible={vm.isModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Chat Session</Text>
                        <CustomInput label="Rename Chat" value={vm.docName} onChangeText={vm.handleDocName} />
                        <CustomButton title="Select Chat" onPress={vm.enterSelectionMode} viewstyle={styles.selectChatContainer} />
                        <View style={styles.modalContainer}>
                            <CustomButton title="Cancel" onPress={vm.closeModal} viewstyle={styles.closeModalContainer} />
                            <CustomButton title="Save Name" onPress={vm.confirmRename} viewstyle={styles.saveModalContainer} />
                        </View>
                    </View>
                </View>
            </Modal>
        </DrawerContentScrollView>
    );
};

export const ChatDrawer = () => {
    return (
        <Drawer.Navigator
            drawerContent={(drawerProps) => {
                const vm = ChatDrawerVM(drawerProps);
                const styles = vm.styles;
                return <CustomDrawerContent {...drawerProps} vm={vm} styles={styles} />
            }}
            screenOptions={{
                headerShown: false,
                drawerStyle: { width: "60%" },
            }}
        >
            <Drawer.Screen name="ChatScreen" component={ChatScreen} />
        </Drawer.Navigator>
    );
};

