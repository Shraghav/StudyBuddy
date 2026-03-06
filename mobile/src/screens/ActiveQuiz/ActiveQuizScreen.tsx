import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import { ActiveQuizVM } from './ActiveQuizVM';

export const ActiveQuizScreen = () => {
    const vm = ActiveQuizVM();
    const styles = vm.styles;
    const insets = useSafeAreaInsets();
    if (!vm.currentSession) return null;

    const renderQuestion = ({ item, index }: any) => {
        const userAnswer = vm.currentSession!.userAnswers[item.id];

        return (
            <View style={styles.questionCard}>
                <Text style={styles.questionText}>{index + 1}. {item.text}</Text>

                {item.type === 'mcq' ? (
                    item.options.map((opt: string) => (
                        <TouchableOpacity
                            key={opt}
                            style={[styles.optionBtn, userAnswer === opt && styles.optionSelected]}
                            onPress={() => vm.answerQuestionAI(item.id, opt)}
                        >
                            <Text style={[styles.optionText, userAnswer === opt && styles.optionTextSelected]}>{opt}</Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    <CustomInput
                        label="Your Answer"
                        value={userAnswer || ''}
                        onChangeText={(val) => vm.answerQuestionAI(item.id, val)}
                        multiline
                    />
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} style={[styles.container, { paddingTop: insets.top - 10 }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Study Buddy Quiz</Text>
            </View>

            <FlatList
                data={vm.currentSession.questions}
                keyExtractor={item => item.id}
                renderItem={renderQuestion}
                contentContainerStyle={styles.flatListConatiner}
            />

            <View style={styles.fixedBottom}>
                <CustomButton
                    title="Submit Answers"
                    disabled={!vm.isAllAnswered()}
                    onPress={vm.handleSubmission}
                />
            </View>
        </KeyboardAvoidingView>
    );
};