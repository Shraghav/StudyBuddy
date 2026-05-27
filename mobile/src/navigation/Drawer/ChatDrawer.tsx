import { createDrawerNavigator, DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import React, { memo, useCallback } from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { ChatScreen } from '../../screens/Chat/ChatScreen';
import { ChatSession } from '../../store/slices/ChatSlice';
import { Images } from '../../utils/Images';
import { ChatDrawerType, ChatDrawerVM } from './ChatDrawerVM';

const Drawer = createDrawerNavigator();

interface CustomDrawerProps extends DrawerContentComponentProps {
    vm: ChatDrawerType;
    styles: ChatDrawerType['styles'];
}
interface SessionItemProps {
    session: ChatSession;
    isActive: boolean;
    isSelected: boolean;
    isSelectionMode: boolean;
    styles: any;
    onPress: (id: string, isSelectionMode: boolean) => void;
    onLongPress: (id: string, title: string, isSelectionMode: boolean) => void;
}

const SessionItem = memo(({ session, isActive, isSelected, isSelectionMode, styles, onPress, onLongPress }: SessionItemProps) => {
    return (
        <TouchableOpacity
            style={[styles.historyItem, isActive && styles.historyItemActive, isSelected && styles.selectedItem]}
            onPress={() => onPress(session.id, isSelectionMode)}
            onLongPress={() => onLongPress(session.id, session.title, isSelectionMode)}
        >
            <Text style={[styles.historyText, isActive && styles.historyTextActive]} numberOfLines={1}>
                🕛 {session.title}
            </Text>
        </TouchableOpacity>
    );
});
const CustomDrawerContent = (props: CustomDrawerProps) => {
    const vm = props.vm
    const styles = vm.styles
    const insets = useSafeAreaInsets();

    const handleSessionPress = useCallback((id: string, isSelectionMode: boolean) => {
        if (isSelectionMode) {
            vm.toggleSelection(id);
        } else {
            vm.changeSession(id);
        }
    }, [vm.toggleSelection, vm.changeSession]);

    const handleSessionLongPress = useCallback((id: string, title: string, isSelectionMode: boolean) => {
        if (!isSelectionMode) {
            vm.openModal(id, title);
        }
    }, [vm.openModal]);
    return (
        <DrawerContentScrollView {...props} contentContainerStyle={[styles.drawerContainer, { paddingTop: insets.top }]}>

            <View style={styles.drawerHeader}>
                <Text style={styles.logoText}>Study Buddy Chat</Text>
            </View>

            {!vm.isSelectionMode && (
                <View style={styles.newChatContainer}>
                    <CustomButton title="+ New Chat" onPress={vm.createNewChatAndCloseDrawer} viewstyle={styles.newChatBtn} loading={vm.createChatLoading} />
                </View>
            )}

            <View style={styles.rowHeader}>
                <Text style={styles.historyLabel}>
                    {vm.isSelectionMode ? `${vm.selectedIds.length} Selected` : "Previous Sessions"}
                </Text>
                {vm.isSelectionMode && (
                    <View style={styles.actionIcons}>
                        <TouchableOpacity onPress={vm.deleteSelectedChats} style={styles.iconBtn}>
                            <Image tintColor={vm.theme.colors.onSurface} source={Images.delete} style={styles.deleteIcon} resizeMode='contain' />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={vm.cancelSelection} style={styles.iconBtn}>
                            <Image tintColor={vm.theme.colors.onSurface} source={Images.cancel} style={styles.cancelIcon} resizeMode='contain' />
                        </TouchableOpacity>
                    </View>
                )}
                {vm.isDeleteLoading && (
                    <View style={styles.deleteLoader}>
                        <ActivityIndicator animating={true} size="small" color={vm.theme.colors.primary} />
                    </View>
                )}
            </View>

            {vm.error ? (
                <View style={styles.centeredState}>
                    <Text style={styles.errorText}>{vm.error}</Text>
                </View>
            ) : vm.isSessionLoading ? (
                <View style={styles.centeredState}>
                    <Text style={styles.dontCreateText}>
                        Don't Create Chats while loading
                    </Text>
                    <ActivityIndicator animating={true} size="small" color={vm.theme.colors.primary} />
                </View>
            ) : (
                <ScrollView>
                    {vm.sessions.length > 0 ? (
                        vm.sessions.map((session: ChatSession, index) => (
                            <SessionItem
                                key={session.id || `temp-${index}`}
                                session={session}
                                isActive={session.id === vm.currentSessionId && !vm.isSelectionMode}
                                isSelected={vm.selectedIds.includes(session.id)}
                                isSelectionMode={vm.isSelectionMode}
                                styles={styles}
                                onPress={handleSessionPress}
                                onLongPress={handleSessionLongPress}
                            />
                        ))
                    ) : (
                        <View style={styles.centeredState}>
                            <Text style={styles.noSessionText}>No sessions found</Text>
                            <Text style={styles.noSessionText}>Create a new chat with the above button</Text>
                        </View>
                    )}
                </ScrollView>
            )}

            <Modal visible={vm.isModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Chat Session</Text>
                        <TextInput
                            mode="outlined"
                            label="Rename Chat"
                            value={vm.docName}
                            onChangeText={vm.handleDocName}
                            style={styles.renameTextContent}
                        />
                        <CustomButton title="Select Chat" onPress={vm.enterSelectionMode} viewstyle={styles.selectChatContainer} />
                        <View style={styles.modalContainer}>
                            <CustomButton title="Cancel" onPress={vm.closeModal} viewstyle={styles.closeModalContainer} />
                            <CustomButton title="Save Name" onPress={vm.confirmRename} viewstyle={styles.saveModalContainer} loading={vm.saveLoading} />
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

