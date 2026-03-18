import React from 'react';
import {
    KeyboardAvoidingView, Platform,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { Button, TextInput } from 'react-native-paper';
import { CustomButton } from '../../components/CustomButton/CustomButton';
import { LoginScreenVM } from './LoginScreenVM';

const LoginScreen = () => {
    const vm = LoginScreenVM();
    const styles = vm.styles;
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.innerContainer}>

                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.logoText}>StudyBuddy</Text>
                    <Text style={styles.subtitle}>Unlock your potential </Text>
                </View>

                {/* Form Section */}
                <View style={styles.form}>
                    <TextInput
                        mode="outlined"
                        label="Email Address"
                        placeholder="peter@example.com"
                        value={vm.email}
                        onChangeText={vm.setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
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
                    {vm.error && <Text style={styles.errorText}>{vm.error}</Text>}
                    <CustomButton
                        title="Sign In"
                        onPress={vm.handleLogin}
                        loading={vm.isLoading}
                        disabled={vm.isLoading}
                        viewstyle={styles.loginButtonOverride}
                    />
                </View>

                {/* Footer */}
                <View>
                    <Text style={styles.footerText}>
                        New to StudyBuddy? <TouchableOpacity style={{ marginTop: 3 }}>
                            <Text onPress={vm.navigateToSignUp} style={styles.signUpLink}>Create Account</Text>
                        </TouchableOpacity>
                    </Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default LoginScreen;