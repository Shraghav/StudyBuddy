import React from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
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
          <CustomInput
            label="Full Name"
            placeholder="Peter"
            value={vm.fullName}
            onChangeText={vm.setFullName}
          />
          <CustomInput
            label="Email"
            placeholder="peter@example.com"
            keyboardType="email-address"
            value={vm.email}
            onChangeText={vm.setEmail}
          />
          <CustomInput
            label="Password"
            secureTextEntry
            value={vm.password}
            onChangeText={vm.setPassword}
          />
          <CustomInput
            label="Confirm Password"
            secureTextEntry
            value={vm.confirmPassword}
            onChangeText={vm.setConfirmPassword}
          />

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