import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { RootState } from '../store';
import { loginSuccess } from '../store/slices/AuthSlice';
import { isTokenValid, performLogout } from '../utils/auth';
import { darkTheme, lightTheme } from '../utils/themes';
import { AuthStack } from './AuthStackNavigator';
import { BottomTabs } from './TabNavigator';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function Root_Stack() {
    const dispatch = useDispatch();
    const [isHydrating, setIsHydrating] = useState(true);
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

    const isDark = useSelector((state: any) => state.theme.isDark);
    const theme = isDark ? darkTheme : lightTheme
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
            <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
        );
    }

    return (
        <PaperProvider theme={theme}>
            <NavigationContainer theme={theme as any}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {isAuthenticated ? <Stack.Screen name='MainApp' component={BottomTabs} /> :
                        <Stack.Screen name='Auth' component={AuthStack} />
                    }
                </Stack.Navigator>
            </NavigationContainer>
        </PaperProvider>
    );
}