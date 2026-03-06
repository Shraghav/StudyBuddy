import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';

import { RootState } from '../store';
import { BottomTabs } from './TabNavigator';
import { RootStackParamList } from './types';
const Stack = createNativeStackNavigator<RootStackParamList>();

export function Root_Stack() {
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* {isAuthenticated ? (
                    <Stack.Screen name="MainApp" component={BottomTabs} />
                ) : (
                    <Stack.Screen name="Auth" component={AuthStack} />
                )} */}
                <Stack.Screen name='MainApp' component={BottomTabs} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}