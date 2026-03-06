import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { Image } from 'react-native'
import { DrawerVM } from './DrawerVM'
import { Images } from '../../utils/Images'

const DrawerMenu = () => {
    const drawerVm = DrawerVM()
    return (
        <TouchableOpacity
            onPress={drawerVm.openSidebar}
        >
            <Image style={{ height: 20, width: 20 }} resizeMode='contain' source={Images.drawer_menu} />
        </TouchableOpacity>
    )
}

export default DrawerMenu