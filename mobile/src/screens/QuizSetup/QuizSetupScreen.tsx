import React from 'react';
import { FlatList, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import DrawerMenu from '../../components/Drawer/Drawer';
import { QuizSetupVM } from './QuizSetupVM';

export const QuizSetupScreen = () => {
  const vm = QuizSetupVM();
  const insets = useSafeAreaInsets();
  const styles = vm.styles

  if (!vm.currentSession) {
    return (
      <View style={[styles.emptyMainContainer, { paddingTop: insets.top + 10 }]}>
        <DrawerMenu />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Open the drawer to start a new quiz.</Text>
        </View>
      </View>
    )
  }

  const { setupParams } = vm.currentSession;

  const InlineSelector = ({ label, options, selected, onSelect }: any) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillContainer}>
        {options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pill, selected === opt && styles.pillActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.pillText, selected === opt && styles.pillTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <DrawerMenu />
        <Text style={styles.headerTitle}>{ vm.currentSession.title}</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Select Study Material</Text>
        <TouchableOpacity style={styles.docSelector} onPress={() => vm.handleModel(true)}>
          <Text style={styles.docSelectorText}>
            {vm.currentSession?.documentName ? `📄 ${vm.currentSession.documentName}` : "Tap to select a PDF"}
          </Text>
        </TouchableOpacity>

        <CustomInput
          label="Number of Questions (Max 25)"
          keyboardType="numeric"
          value={setupParams.numQuestions}
          onChangeText={(val) => vm.updateSetup({ numQuestions: val })}
        />

        <InlineSelector
          label="Difficulty Level"
          options={['Easy', 'Medium', 'Hard']}
          selected={setupParams.difficulty}
          onSelect={(val: any) => vm.updateSetup({ difficulty: val })}
        />

        <InlineSelector
          label="Question Format"
          options={['mcq', 'text']}
          selected={setupParams.format}
          onSelect={(val: any) => vm.updateSetup({ format: val })}
        />

        <CustomInput
          label="Custom Instructions for AI"
          placeholder="E.g., Focus mainly on chapter 3 formulas..."
          value={setupParams.customPrompt}
          onChangeText={(val) => vm.updateSetup({ customPrompt: val })}
          multiline
          inputStyle={{ height: 80 }}
        />

        <CustomButton
          title="Generate Quiz"
          onPress={vm.generateAndStartQuiz}
          disabled={!vm.currentSession.documentId}
        />
      </ScrollView>

      <Modal visible={vm.isDocModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Document</Text>
            <FlatList
              data={vm.availableDocs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <CustomButton onPress={() => {
                  vm.documentSelect({ id: item.id, name: item.name })
                  vm.handleModel(false)
                }} title={`📄 ${item.name}`} viewstyle={styles.docItem} textStyle={styles.pdfName} />
              )}
            />
            <CustomButton title="Close" onPress={() =>
              vm.handleModel(false)}
              viewstyle={{ backgroundColor: '#509cfa' }} />
          </View>
        </View>
      </Modal>
    </View>

  );
};
