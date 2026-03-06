import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface CustomInputProps extends TextInputProps {
    label: string;
    containerStyle?: ViewStyle ; // Style for the wrapper
    inputStyle?:TextStyle;     // Style for the input itself
}

export const CustomInput = ({ label, containerStyle, inputStyle, ...props }: CustomInputProps) => (
    <View style={[styles.container, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
            style={[styles.input, inputStyle]}
            placeholderTextColor="#757c7f"
            {...props}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', color: '#263238', marginBottom: 8 },
    input: {
        backgroundColor: '#F5F7F9',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E1E8ED',
        color: '#263238',
    },
});