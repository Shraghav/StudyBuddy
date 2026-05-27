import { createDrawerNavigator, DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';

import { ScrollView } from 'react-native-gesture-handler';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import { ActiveQuizScreen } from '../../screens/ActiveQuiz/ActiveQuizScreen';
import { QuizSetupScreen } from '../../screens/QuizSetup/QuizSetupScreen';
import { QuizResultScreen } from '../../screens/Result/ResultScreen';
import { QuizSession } from '../../store/slices/QuizSlice';
import { Images } from '../../utils/Images';
import { QuizDrawerParamList, QuizStackParamList } from '../types';
import { QuizDrawerType, QuizDrawerVM } from './QuizDrawerVM';


const Drawer = createDrawerNavigator<QuizDrawerParamList>();
const Stack = createNativeStackNavigator<QuizStackParamList>();

interface CustomDrawerProps extends DrawerContentComponentProps {
    vm: QuizDrawerType,
    styles: QuizDrawerType['styles']
}

const QuizStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="QuizSetup" component={QuizSetupScreen} />
        <Stack.Screen name="ActiveQuiz" component={ActiveQuizScreen} />
        <Stack.Screen name="QuizResult" component={QuizResultScreen} />
    </Stack.Navigator>
);
const CustomQuizDrawerContent = (props: CustomDrawerProps) => {
    const vm = props.vm
    const styles = vm.styles
    const insets = useSafeAreaInsets();

    const handleSelectionPress = (session: QuizSession) => {
        vm.isSelectionMode ? vm.toggleSelect(session.id) : vm.handleSelectHistory(session.id, session.status)
    }

    const handleSelectionLongPress = (session: QuizSession) => {
        vm.openOptions(session)
    }
    const SessionItem = ({ session, isActive, isSelected }: { session: QuizSession, isActive: boolean, isSelected: boolean }) => {
        return (
            <TouchableOpacity
                key={session.id}
                style={[
                    styles.historyItem,
                    isActive && styles.historyItemActive,
                    vm.isSelectionMode && isSelected && styles.selectedItem
                ]}
                onPress={() =>
                    handleSelectionPress(session)
                }
                onLongPress={() =>
                    handleSelectionLongPress(session)
                }
            >
                <View>
                    <Text style={[styles.historyText, isActive && styles.historyTextActive]} numberOfLines={1}>
                        📝 {session.title}
                    </Text>
                    <Text style={styles.statusSubtext}>
                        {session.status === 'completed' ? `Result: ${session.score}` : session.status}
                    </Text>
                </View>
            </TouchableOpacity>
        )
    }
    return (
        <DrawerContentScrollView  {...props} contentContainerStyle={[styles.drawerContainer, { paddingTop: insets.top }]}>
            {/* Upload pdf */}
            <View style={styles.drawerHeader}>
                <Text style={styles.logoText}>Study Buddy Quiz</Text>
            </View>

            {!vm.isSelectionMode && (
                <View style={styles.newBtnContainer}>
                    <CustomButton title="+ New AI Quiz" onPress={vm.handleNewQuiz} viewstyle={styles.newQuizBtn} loading={vm.createQuizLoading} />
                </View>
            )}
            {/* cancel and delete  */}
            <View style={styles.rowHeader}>
                <Text style={styles.historyLabel}>
                    {vm.isSelectionMode ? `${vm.selectedIds.length} Selected` : "Quiz History"}
                </Text>
                {vm.isSelectionMode && (
                    <View style={styles.actionIcons}>
                        <TouchableOpacity onPress={vm.handleDelete} style={styles.iconBtn}>
                            <Image source={Images.delete} style={styles.deleteCancelIcon} resizeMode='contain' />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={vm.handleCancel} style={styles.iconBtn}>
                            <Image source={Images.cancel} style={styles.deleteCancelIcon} resizeMode='contain' />
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
            ) : vm.sessionLoading ? (
                <View style={styles.centeredState}>
                    <Text style={styles.dontCreateText}>
                        Don't Create Chats while loading
                    </Text>
                    <ActivityIndicator animating={true} size="small" color={vm.theme.colors.primary} />
                </View>
            ) : (
                <ScrollView style={{ height: 760 }}>
                    {vm.sessions.length > 0 ? (
                        vm.sessions.map((session: QuizSession) => (
                            <SessionItem
                                key={session.id}
                                isActive={session.id == vm.currentSessionId && !vm.isSelectionMode}
                                isSelected={vm.selectedIds.includes(session.id)}
                                session={session} />
                        )
                        ))
                        : (
                            <View style={styles.centeredState}>
                                <Text style={styles.noSessionText}>No sessions found</Text>
                                <Text style={styles.noSessionText}>Create a new quiz with the above button</Text>
                            </View>
                        )}
                </ScrollView>
            )}
            <Modal visible={vm.isModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Quiz Options</Text>
                        <TextInput
                            mode="outlined"
                            label="Rename Quiz"
                            value={vm.quizName}
                            onChangeText={vm.handleQuizName}
                        />

                        <CustomButton
                            title="Select this Quiz"
                            onPress={
                                vm.startSelection
                            }
                            viewstyle={styles.selectBtn}
                        />

                        <View style={styles.modalActions}>
                            <CustomButton title="Cancel" onPress={vm.closeModal} viewstyle={styles.cancelBtn} />
                            <CustomButton
                                title="Save Name"
                                onPress={vm.renameQuizModal}
                                viewstyle={styles.saveBtn}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </DrawerContentScrollView>
    );
};

export const QuizDrawer = () => {
    return (
        <Drawer.Navigator
            drawerContent={(drawerProps) => {
                const vm = QuizDrawerVM(drawerProps)
                const styles = vm.styles
                return <CustomQuizDrawerContent {...drawerProps} vm={vm} styles={styles} />
            }}
            screenOptions={{ headerShown: false, drawerStyle: { width: "60%" } }}
        >
            <Drawer.Screen name="QuizStack" component={QuizStack} />
        </Drawer.Navigator>
    );
};