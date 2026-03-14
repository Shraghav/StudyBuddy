import React from 'react';
import { KeyboardAvoidingView, Platform, Text, TouchableOpacity, View, Image } from 'react-native';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import { SignupVM } from './SignupScreenVM';
import { Images } from '../../utils/Images';


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
            label="Email"
            placeholder="peter@example.com"
            keyboardType="email-address"
            value={vm.email}
            onChangeText={vm.setEmail}
          />
          <View>
            <CustomInput
              label="Password"
              secureTextEntry={!vm.passwordVisible}
              value={vm.password}
              onChangeText={vm.setPassword}
            />
            <TouchableOpacity onPress={() => vm.passwordIconVisible(vm.passwordVisible)} style={{ position: "absolute", right: 10 }}>
              <Image source={vm.passwordVisible ? Images.password_open : Images.password_close} style={{ height: 20, width: 20 }} />
            </TouchableOpacity>
          </View>
          <View>
            <CustomInput
              label="Confirm Password"
              secureTextEntry = {!vm.confirmPasswordVisible}
              value={vm.confirmPassword}
              onChangeText={vm.setConfirmPassword}
            />
            <TouchableOpacity onPress={() => vm.confirmPasswordIconVisible(vm.confirmPasswordVisible)} style={{ position: "absolute", right: 10 }}>
              <Image source={vm.confirmPasswordVisible ? Images.password_open : Images.password_close} style={{ height: 20, width: 20 }} />
            </TouchableOpacity>
          </View>
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