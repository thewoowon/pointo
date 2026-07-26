import {createStackNavigator} from '@react-navigation/stack';
import MainScreen from './MainScreen';
import StatisticsScreen from './StatisticsScreen';
import StoreSettingsScreen from './StoreSettingsScreen';

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
  </Stack.Navigator>
);

export default SupervisorStack;
