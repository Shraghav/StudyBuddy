import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Root_Stack } from './src/navigation/RootNavigator';
import { store } from './src/store';

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <Root_Stack />
      </Provider>
    </SafeAreaProvider>
  )
}