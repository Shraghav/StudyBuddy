import { GoogleSignin } from '@react-native-google-signin/google-signin';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '../services/api/api_client';


export default function Login() {
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('Waiting to log in...');
    const [backendData, setBackendData] = useState(null);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: 'web client id',
            offlineAccess: true,
        });
    }, []);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            // 1. Get Token from Google
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            setStatusText(`Google Success! Email: ${userInfo.data?.user.name}\nSending to fastapi...`);

            // 2. Send to FastAPI 
            const response = await apiClient.post("/login/auth/google", {
                token: userInfo.data?.idToken
            });


            if (response.status) {
                setStatusText('Backend Success! Custom JWT token received.');
                // 3. Test the protected /me endpoint using the new JWT
                //Note : Can intercept the authorization in apiclient.ts but we will pass here
                await apiClient.get("/login/me", {
                    headers: {
                        'Authorization': `Bearer ${response.data.access_token}`
                    }
                });
                setBackendData(response.data);
            } 

        } catch (error) {
            console.error(error);
            setStatusText(`Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Integration Test</Text>

            <Button title="Sign in with Google" onPress={handleGoogleLogin} disabled={loading} />

            {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

            <Text style={styles.logText}>{statusText}</Text>

            {backendData && (
                <View style={styles.card}>
                    <Text style={{ fontWeight: 'bold' }}>Data from protected Postgres DB:</Text>
                    <Text>{JSON.stringify(backendData, null, 2)}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    logText: { marginTop: 20, fontSize: 14, color: '#333', textAlign: 'center' },
    card: { marginTop: 30, padding: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 2 }
});