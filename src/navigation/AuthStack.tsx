import {createStackNavigator} from '@react-navigation/stack';
import {LoginScreen, StoreRegisterScreen} from '../screens/auth';
import {
  SwitcherScreen,
  AccountSettingsScreen,
  DeletionConfirmScreen,
  DeletionPendingScreen,
} from '../screens/common';

const Stack = createStackNavigator();

/**
 * 로그인 전 스택. 진입점은 구글 로그인.
 *   Login → Switcher(내 매장/슬롯) → [스토어 선택 + 모드] → MainTab
 * 이미 로그인된 상태로 재진입하면 LoginScreen이 상태에 따라 Switcher 또는
 * DeletionPending(탈퇴 유예)으로 자동 통과시킨다.
 */
const AuthStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen
      name="Switcher"
      component={SwitcherScreen}
      options={{gestureEnabled: false}}
    />
    <Stack.Screen name="StoreRegister" component={StoreRegisterScreen} />
    <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
    <Stack.Screen name="DeletionConfirm" component={DeletionConfirmScreen} />
    <Stack.Screen
      name="DeletionPending"
      component={DeletionPendingScreen}
      options={{gestureEnabled: false}}
    />
  </Stack.Navigator>
);

export default AuthStack;
