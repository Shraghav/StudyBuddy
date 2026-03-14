import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Image } from 'react-native';

import { UploadScreen } from '../screens/Upload/UploadScreen';
import { Images } from '../utils/Images';
import { ChatDrawer } from './Drawer/ChatDrawer';
import { QuizDrawer } from './Drawer/QuizDrawer';
import { BottomTabParamList } from './types';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Tab = createBottomTabNavigator<BottomTabParamList>();
export const BottomTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarActiveTintColor: '#6200EE',
                tabBarInactiveTintColor: '#9E9E9E',
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconSource;
                    if (route.name === 'Upload') {
                        iconSource = Images.upload_file;
                    } else if (route.name === 'Chat') {
                        iconSource = Images.chat;
                    } else if (route.name === 'Quiz') {
                        iconSource = Images.quiz;
                    }
                    else {
                        iconSource = Images.user
                    }
                    return (
                        <Image
                            source={iconSource}
                            style={{
                                width: size,
                                height: size,
                                tintColor: color
                            }}
                            resizeMode="contain"
                        />
                    );
                },
            })}
        >
            <Tab.Screen name="Upload" component={UploadScreen} />
            <Tab.Screen name="Chat" component={ChatDrawer} />
            <Tab.Screen name="Quiz" component={QuizDrawer} />
            <Tab.Screen name ="Profile" component={ProfileScreen}/>
        </Tab.Navigator>
    );
};