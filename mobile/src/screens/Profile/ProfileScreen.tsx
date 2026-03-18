import React from 'react';
import { View, Text, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomButton } from '../../components/CustomButton/CustomButton';
import { ProfileScreenVM } from './ProfileScreenVM';

const ProfileScreen = () => {
    // ViewModel extracts all business logic, Redux state, and dynamic styling
    const vm = ProfileScreenVM();
    const styles = vm.styles;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>

                {/* Header Section */}
                <View style={styles.header}>
                    <Text style={styles.title}>Profile & Settings</Text>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Preferences</Text>

                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Dark Mode</Text>
                        <Switch
                            value={vm.isDark}
                            onValueChange={vm.toggleThemeProfile}
                            trackColor={{
                                false: vm.theme.colors.surfaceDisabled,
                                true: vm.theme.colors.primary
                            }}
                            thumbColor={vm.theme.colors.onSurface}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <CustomButton
                        title="Log Out"
                        onPress={vm.logOut}
                        viewstyle={styles.logoutButton}
                        textStyle={styles.logoutText}
                    />
                </View>

            </View>
        </SafeAreaView>
    );
};

export default ProfileScreen;