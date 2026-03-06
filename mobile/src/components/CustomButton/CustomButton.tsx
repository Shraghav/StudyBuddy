import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface CustomButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    viewstyle?: ViewStyle;
    textStyle?: TextStyle;
}

export const CustomButton = ({ title, onPress, loading, disabled, viewstyle, textStyle }: CustomButtonProps) => (
    <TouchableOpacity
        style={[styles.button, viewstyle, (disabled || loading) && styles.disabled]}
        onPress={onPress}
        disabled={disabled || loading}
    >
        {loading ? (
            <ActivityIndicator color="#FFF" />
        ) : (
            <Text style={[styles.text, textStyle]}>{title}</Text>
        )}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#00796B',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    disabled: { backgroundColor: '#B2DFDB' },
    text: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});