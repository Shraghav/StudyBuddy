import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { View } from 'react-native';
import { RootState } from '../store';
import { loginSuccess } from '../store/slices/AuthSlice';
import { AuthStack } from './AuthStackNavigator';
import { BottomTabs } from './TabNavigator';
import { RootStackParamList } from './types';
import { isTokenValid, performLogout } from '../utils/auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function Root_Stack() {
    const dispatch = useDispatch();
    const [isHydrating, setIsHydrating] = useState(true);
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
    useEffect(() => {
        const checkSession = async () => {
            try {
                const token = await SecureStore.getItemAsync('auth_token');
                if (token && isTokenValid(token)) {
                    dispatch(loginSuccess({ token }));
                } else {
                    await performLogout();
                }
            } catch (error) {
                await performLogout();
            } finally {
                setIsHydrating(false);
            }
        };
        checkSession();
    }, [dispatch]);

    if (isHydrating) {
        return (
            <View />
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {
                    isAuthenticated ? <Stack.Screen name='MainApp' component={BottomTabs} /> :
                        <Stack.Screen name='Auth' component={AuthStack} />
                }
            </Stack.Navigator>
        </NavigationContainer>
    );
}