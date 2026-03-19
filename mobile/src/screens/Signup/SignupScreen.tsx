import React from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { TextInput } from 'react-native-paper';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import { SignupVM } from './SignupScreenVM';


const SignupScreen = () => {
  const vm = SignupVM();
  const styles = vm.styles;
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.subContainer}>
        <Text style={styles.title}>Join StudyBuddy</Text>
        <Text style={styles.subtitle}>Start collaborating with peers today.</Text>

        <View style={styles.card}>
          <TextInput
            mode="outlined"
            label="Email Address"
            placeholder="peter@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={vm.email}
            onChangeText={vm.setEmail}
            style={{ marginBottom: 15 }}
          />

          <TextInput
            mode="outlined"
            label="Password"
            value={vm.password}
            onChangeText={vm.setPassword}
            secureTextEntry={!vm.passwordVisible}
            style={{ marginBottom: 15 }}
            right={
              <TextInput.Icon
                icon={vm.passwordVisible ? "eye-off" : "eye"}
                onPress={() => vm.passwordIconVisible(vm.passwordVisible)}
              />
            }
          />

          <TextInput
            mode="outlined"
            label="Confirm Password"
            value={vm.confirmPassword}
            onChangeText={vm.setConfirmPassword}
            secureTextEntry={!vm.confirmPasswordVisible}
            style={styles.outlineBtn}
            right={
              <TextInput.Icon
                icon={vm.confirmPasswordVisible ? "eye-off" : "eye"}
                onPress={() => vm.confirmPasswordIconVisible(vm.confirmPasswordVisible)}
              />
            }
          />
          {vm.error && <Text style={styles.errorText}>{vm.error}</Text>}
          <CustomButton
            title="Create Account"
            onPress={vm.handleSignup}
            loading={vm.isLoading}
          />
        </View>

        <Text style={styles.footer} onPress={vm.handleLogin}>
          Already have an account? <Text style={styles.link}>Sign In</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};



export default SignupScreen;