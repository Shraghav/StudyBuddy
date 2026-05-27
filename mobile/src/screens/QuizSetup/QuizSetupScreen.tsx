import React from 'react';
import { ActivityIndicator, FlatList, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import DrawerMenu from '../../components/Drawer/Drawer';
import { QuizSetupVM } from './QuizSetupVM';

export const QuizSetupScreen = () => {
  const vm = QuizSetupVM();
  const insets = useSafeAreaInsets();
  const styles = vm.styles

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
        {
          vm.currentSession && (vm.currentSession.status == "setup" || vm.currentSession.status == "generating") &&
          <Text style={styles.headerTitle}>{vm.currentSession?.title}</Text>
        }
      </View>
      {
        vm.sessionLoading ?
          <View style={styles.sessionLoaderContent}>
            <ActivityIndicator size="large" color={vm.theme.colors.primary} />
            <Text style={styles.emptyText}>Loading your Quiz...</Text>
          </View> :
          <View style={{ flex: 1 }}>
            {
              !vm.currentSession || vm.currentSession.status == "active" ? <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={styles.emptyModalText}>Create a new quiz or click the existing quiz</Text>
              </View> :
                <View>
                  <ScrollView style={styles.content}>
                    <Text style={styles.label}>Select Study Material</Text>
                    <TouchableOpacity style={styles.docSelector} onPress={() => {
                      vm.handleModel(true)
                    }}>
                      <Text style={styles.docSelectorText}>
                        {vm.currentSession?.documentName ? `📄 ${vm.currentSession.documentName}` : "Tap to select a PDF"}
                      </Text>
                    </TouchableOpacity>

                    <TextInput
                      label="Number of Questions (Max 25)"
                      keyboardType="numeric"
                      value={vm.currentSession?.setupParams?.numQuestions || ""}
                      onChangeText={vm.updateNumQuestions}
                      disabled={vm.currentSession?.status == "generating"}
                      style={styles.questionsInp}
                    />

                    {vm.fieldErrors.numQuestions && <Text style={styles.errorText}>{vm.fieldErrors.numQuestions}</Text>}
                    <InlineSelector
                      label="Difficulty Level"
                      options={['Easy', 'Medium', 'Hard']}
                      value={vm.currentSession?.setupParams?.difficulty}
                      selected={vm.currentSession?.setupParams?.difficulty}
                      onSelect={(val: any) => vm.updateDifficulty(val)
                      }
                    />

                    <InlineSelector
                      label="Question Format"
                      options={['mcq']}
                      value={'vm.currentSession?.setupParams?.format || ""'}
                      selected={vm.currentSession?.setupParams?.format}
                      onSelect={(val: any) => vm.updateFormat(val)}
                    />

                    <TextInput
                      mode="outlined"
                      label="Custom Instructions for AI"
                      placeholder="E.g., Focus mainly on key concepts"
                      value={vm.currentSession?.setupParams?.customPrompt || ""}
                      onChangeText={(val) => vm.updateCustomPrompt(val)}
                      multiline
                      style={{ height: 80 }}
                      outlineColor="#C0C0C0"
                      activeOutlineColor="#7393B3"
                    />

                    <CustomButton
                      title={"Generate Quiz"}
                      onPress={vm.generateAndStartQuiz}
                      disabled={vm.isGenerating || !vm.currentSession?.documentId}
                      loading={vm.isGenerating}
                    />
                  </ScrollView>

                  <Modal visible={vm.isDocModalVisible} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                      <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Document</Text>
                        <FlatList
                          data={vm.availableDocs}
                          keyExtractor={item => item.id}
                          renderItem={({ item }) => {
                            const isThisItemLoading = vm.submittingDocId === item.id;
                            return (
                              <CustomButton onPress={() => {
                                vm.documentSelect(item)
                              }}
                                title={`📄 ${item.name}`}
                                viewstyle={styles.docItem}
                                textStyle={styles.pdfName}
                                loading={isThisItemLoading}
                              />
                            )
                          }}
                        />
                        <CustomButton title="Close" onPress={() =>
                          vm.handleModel(false)}
                          viewstyle={styles.closebtn} />
                      </View>
                    </View>
                  </Modal>
                </View>
            }
          </View>
      }

    </View>

  );
};
