import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { ActiveQuizVM } from './ActiveQuizVM';
import { TextInput } from 'react-native-paper';
import { Question } from '../../store/slices/QuizSlice';
import DrawerMenu from '../../components/Drawer/Drawer';

export const ActiveQuizScreen = () => {
    const vm = ActiveQuizVM();
    const styles = vm.styles;
    const insets = useSafeAreaInsets();
    if (!vm.currentSession) return null;

    const renderQuestion = ({ item, index }: any) => {
        const userAnswers = vm.currentSession?.userAnswers || {};
        return (
            <View style={styles.questionCard}>
                <Text style={styles.questionText}>
                    {index + 1}. {item.text}
                </Text>

                {Object.entries(item.options).map(([optionKey, optionValue]) => {
                    const isSelected = userAnswers[item.id] === optionKey;
                    return (
                        <TouchableOpacity
                            key={optionKey}
                            style={[
                                styles.optionBtn,
                                isSelected && styles.optionSelected,
                            ]}
                            onPress={() => vm.answerQuestionAI(item.id, optionKey)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    isSelected && styles.optionTextSelected,
                                ]}
                            >
                                {optionKey}. {String(optionValue)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={[styles.container, { paddingTop: insets.top - 10 }]}>
            <View style={styles.header}>
                <DrawerMenu />
                {
                    vm.currentSession && vm.currentSession.status == "active" &&
                    <Text style={styles.headerTitle}>{vm.currentSession?.title}</Text>
                }
            </View>

            <FlatList
                data={vm.currentSession.questions || []}
                keyExtractor={item => item.id}
                renderItem={renderQuestion}
                contentContainerStyle={styles.flatListConatiner}
            />

            <View style={styles.fixedBottom}>
                <CustomButton
                    title="Submit Answers"
                    disabled={!vm.isAllAnswered()}
                    onPress={vm.handleSubmission}
                    loading={vm.isSubmitting}
                />
            </View>
        </KeyboardAvoidingView>
    );
};