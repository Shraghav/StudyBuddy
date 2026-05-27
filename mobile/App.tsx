import { Provider } from 'react-redux';
import { Root_Stack } from './src/navigation/RootNavigator';
import { persistor, store } from './src/store';
import { PersistGate } from 'redux-persist/integration/react';
export default function App() {

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}></PersistGate>
      <Root_Stack />
    </Provider>
  )
}     