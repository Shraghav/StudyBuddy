import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DrawerMenu from '../../components/Drawer/Drawer';
import { ResultScreenVM } from './ResultScreenVM';
export const QuizResultScreen = () => {

  const vm = ResultScreenVM();
  const styles = vm.styles;
  const isMCQ = vm.currentSession!.setupParams.format === 'mcq';
  const insets = useSafeAreaInsets();

  const renderResultQuestion = ({ item, index }: any) => {
    const userAnswer = vm.currentSession!.userAnswers[item.id];
    const isCorrect = userAnswer === item.correctAnswer;
    const cardStyle = [
      styles.questionCard,
      isMCQ ? (isCorrect ? styles.cardCorrect : styles.cardWrong) : null
    ];

    return (
      <View style={cardStyle}>
        <Text style={styles.questionText}>{index + 1}. {item.text}</Text>
        <Text style={styles.resultText}>Your Answer: <Text style={{ fontWeight: 'bold' }}>{userAnswer}</Text></Text>
        {isMCQ && !isCorrect && <Text style={styles.correctText}>Correct Answer: {item.correctAnswer}</Text>}
        {!isMCQ && (
          <Text style={styles.pendingText}>✨ AI will provide detailed feedback soon</Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <DrawerMenu />
        <Text style={styles.headerTitle}>Quiz Results</Text>
      </View>

      <View style={styles.scoreHeader}>
        {isMCQ ? (
          <Text style={styles.scoreText}>
            {vm.currentSession!.score} / {vm.currentSession!.questions.length}
          </Text>
        ) : (
          <Text style={styles.scoreText}>Quiz Submitted</Text>
        )}
        <Text style={styles.feedbackText}>{vm.currentSession!.feedback}</Text>
      </View>

      <FlatList
        data={vm.currentSession!.questions}
        keyExtractor={item => item.id}
        renderItem={renderResultQuestion}
        contentContainerStyle={{ padding: 20 }}
      />
    </KeyboardAvoidingView>
  );
};