import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import LoginScreen from '../screens/Login/LoginScreen';
import SignupScreen from '../screens/Signup/SignupScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack = () => {
    return (
        <Stack.Navigator
            initialRouteName="SignIn"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="SignIn" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
    );
};