import React from 'react'
import { View } from 'react-native'
import { CustomButton } from '../../components/CustomButton/CustomButton'
import { ProfileScreenVM } from './ProfileScreenVM'

const ProfileScreen = () => {
    const vm = ProfileScreenVM()
    const styles = vm.styles
    return (
        <View style={styles.container}>
            <CustomButton onPress={vm.logOut} title='Logout' />
        </View>
    )
}

export default ProfileScreen