import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DrawerMenu from '../../components/Drawer/Drawer';
import { ResultScreenVM } from './ResultScreenVM';

export const QuizResultScreen = () => {
  const vm = ResultScreenVM();
  const styles = vm.styles;
  const insets = useSafeAreaInsets();

  if (!vm.currentSession) return null;
  const renderResultQuestion = ({ item, index }: any) => {
    const rawUserAns = vm.currentSession?.userAnswers?.[item.id] || "";
    const rawCorrectAns = item.correctAnswer || "";

    const displayUserText = item.options?.[rawUserAns] || rawUserAns || "No Answer";
    const displayCorrectText = item.options?.[rawCorrectAns] || rawCorrectAns;

    const isCorrect =
      rawUserAns.trim().toLowerCase() === rawCorrectAns.trim().toLowerCase() ||
      displayUserText.trim().toLowerCase() === displayCorrectText.trim().toLowerCase();

    const cardStyle = [
      styles.questionCard,
      isCorrect ? styles.cardCorrect : styles.cardWrong
    ];

    return (
      <View style={cardStyle}>
        <Text style={styles.questionText}>{index + 1}. {item.text}</Text>

        <Text style={styles.resultText}>
          Your Answer: <Text style={{ fontWeight: 'bold' }}>{displayUserText}</Text>
        </Text>

        <Text style={styles.correctText}>
          Correct Answer: {displayCorrectText}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <DrawerMenu />
        <Text style={styles.headerTitle}>Quiz Results</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.scoreHeader}>
        <Text style={styles.scoreText}>
          Final Score: {vm.currentSession.score} / {vm.currentSession.questions?.length || 0}
        </Text>
        <Text style={styles.feedbackText}>{vm.currentSession.feedback}</Text>
      </View>

      <FlatList
        data={vm.currentSession.questions || []}
        keyExtractor={(item) => item.id}
        renderItem={renderResultQuestion}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      />
    </KeyboardAvoidingView>
  );
};