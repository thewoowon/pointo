import {createStackNavigator} from '@react-navigation/stack';
import {
  ModeSelectionScreen,
  SignInScreen,
  EmailAuthScreen,
} from '../screens/auth';
import StoreRegisterScreen from '../screens/auth/StoreRegisterScreen';
import {SwitcherScreen} from '../screens/common';

const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="ModeSelection"
      component={ModeSelectionScreen}
      options={{headerShown: false}}
    />
    <Stack.Screen
      name="EmailAuth"
      component={EmailAuthScreen}
      options={{headerShown: false}}
    />
    <Stack.Screen
      name="Switcher"
      component={SwitcherScreen}
      options={{headerShown: false, gestureEnabled: false}}
    />
    <Stack.Screen
      name="SignIn"
      component={SignInScreen}
      options={{headerShown: false}}
    />
    <Stack.Screen
      name="StoreRegister"
      component={StoreRegisterScreen}
      options={{headerShown: false}}
    />
  </Stack.Navigator>
);

export default AuthStack;
