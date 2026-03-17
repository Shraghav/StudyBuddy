import { Provider } from 'react-redux';
import { Root_Stack } from './src/navigation/RootNavigator';
import { store } from './src/store';
export default function App() {

  return (
    <Provider store={store}>
        <Root_Stack />
    </Provider>
  )
}     