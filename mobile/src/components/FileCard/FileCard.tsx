import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, Image } from 'react-native';
import { Images } from '../../utils/Images';

interface FileCardProps {
    name: string;
    onPress: () => void;
    onLongPress: () => void;
    style: ViewStyle
}

export const FileCard = ({ name, onPress, onLongPress, style }: FileCardProps) => (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} onLongPress={onLongPress}>
        <View style={styles.iconContainer}>
            <Image source={Images.file} style={{height:30, width:30}} resizeMode='contain' />
        </View>
        <View style={styles.textContainer}>
            <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
            <Text style={styles.subText}>Tap to view</Text>
        </View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 15,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E1E8ED',
    },
    iconContainer: {
        backgroundColor: '#E0F2F1',
        padding: 10,
        borderRadius: 10,
        marginRight: 15,
    },
    pdfIcon: { fontSize: 20 },
    textContainer: { flex: 1 },
    fileName: { fontSize: 16, fontWeight: '600', color: '#263238' },
    subText: { fontSize: 12, color: '#90A4AE', marginTop: 2 },
});