import {createStackNavigator} from '@react-navigation/stack';
import MainScreen from './MainScreen';
import StatisticsScreen from './StatisticsScreen';
import StoreSettingsScreen from './StoreSettingsScreen';
import {OnboardingScreen} from '../onboarding';

const Stack = createStackNavigator();

const SupervisorStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Main"
      component={MainScreen}
      options={{headerShown: false}}
    />
    <Stack.Screen
      name="Statistics"
      component={StatisticsScreen}
      options={{headerShown: false}}
    />
    <Stack.Screen
      name="StoreSettings"
      component={StoreSettingsScreen}
      options={{headerShown: false}}
    />
    {/* 적립내역이 빈 화면에서 "사용법 보기"로 들어온다. replay 슬롯이라
        노출 기록을 남기지 않고, 끝나면 왔던 화면으로 되돌아간다. */}
    <Stack.Screen
      name="Onboarding"
      component={OnboardingScreen}
      initialParams={{slot: 'replay'}}
      options={{headerShown: false}}
    />
  </Stack.Navigator>
);

export default SupervisorStack;
