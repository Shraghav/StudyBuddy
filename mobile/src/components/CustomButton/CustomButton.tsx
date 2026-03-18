import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppTheme } from '../../utils/themes';

interface CustomButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    viewstyle?: ViewStyle;
    textStyle?: TextStyle;
}

export const CustomButton = ({ title, onPress, loading, disabled, viewstyle, textStyle }: CustomButtonProps) => {
    const theme = useTheme<AppTheme>();
    const styles = makeStyles(theme);
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[styles.button, viewstyle, isDisabled && styles.disabled]}
            onPress={onPress}
            disabled={isDisabled}
        >
            {loading ? (
                <ActivityIndicator color={isDisabled ? theme.colors.onSurfaceDisabled : theme.colors.onPrimary} />
            ) : (
                <Text style={[styles.text, textStyle, isDisabled && styles.disabledText]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const makeStyles = (theme: AppTheme) => StyleSheet.create({
    button: {
        backgroundColor: theme.colors.primary,
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    disabled: {
        backgroundColor: theme.colors.surfaceDisabled,
    },
    text: {
        color: theme.colors.onPrimary,
        fontSize: 18,
        fontWeight: 'bold'
    },
    disabledText: {
        color: theme.colors.onSurfaceDisabled,
    }
});