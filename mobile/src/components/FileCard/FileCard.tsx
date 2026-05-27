import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, Image } from 'react-native';
import { Images } from '../../utils/Images';
import { useTheme } from 'react-native-paper';
import { AppTheme } from '../../utils/themes';

interface FileCardProps {
    name: string;
    onPress: () => void;
    style: ViewStyle
}

export const FileCard = ({ name, onPress, style }: FileCardProps) => {
    const theme = useTheme<AppTheme>()
    const styles = makeStyles(theme)
    return (
        <TouchableOpacity style={[styles.card, style]} onPress={onPress}>
            <View style={styles.iconContainer}>
                <Image tintColor={theme.colors.onBackground} source={Images.file} style={{ height: 30, width: 30 }}  />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
            </View>
        </TouchableOpacity>
    )
};

export const makeStyles = (theme: AppTheme) => StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface, 
        padding: 15,
        borderRadius: 15,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant, 
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    iconContainer: {
        padding: 10,
        borderRadius: 10,
        marginRight: 15,
    },
    pdfIcon: {
        fontSize: 20,
        color: theme.colors.onSecondaryContainer 
    },
    textContainer: {
        flex: 1
    },
    fileName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.onBackground,
    },
    subText: {
        fontSize: 12,
        color: theme.colors.onSurfaceVariant,
        marginTop: 2
    },
});