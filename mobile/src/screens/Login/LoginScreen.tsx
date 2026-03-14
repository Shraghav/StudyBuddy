import React from 'react';
import {
    KeyboardAvoidingView, Platform,
    Text,
    TouchableOpacity,
    View,
    Image
} from 'react-native';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { CustomInput } from '../../components/CustomInput/CustomInput';
import { LoginScreenVM } from './LoginScreenVM';
import { Images } from '../../utils/Images';


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
                    <CustomInput
                        label="Email Address"
                        placeholder="peter@example.com"
                        value={vm.email}
                        onChangeText={vm.setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <View>
                        <CustomInput
                            label="Password"
                            value={vm.password}
                            onChangeText={vm.setPassword}
                            secureTextEntry={!vm.passwordVisible}
                        />
                        <TouchableOpacity onPress={() => vm.passwordIconVisible(vm.passwordVisible)} style={{ position: "absolute", right:10 }}>
                            <Image source={vm.passwordVisible ? Images.password_open : Images.password_close} style={{ height: 20, width: 20 }} />
                        </TouchableOpacity>
                    </View>
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
                <TouchableOpacity onPress={vm.navigateToSignUp}>
                    <Text style={styles.footerText}>
                        New to StudyBuddy? <Text style={styles.signUpLink}>Create Account</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};



export default LoginScreen;