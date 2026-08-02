import {createStackNavigator} from '@react-navigation/stack';
import NumberInputScreen from './NumberInputScreen';

const Stack = createStackNavigator();

// 고객 모드는 NumberInput 단일 화면. 대시보드는 그 위 Modal(DashboardView)로 뜬다.
const ClientStack = () => (
  <Stack.Navigator
    screenOptions={{
      detachPreviousScreen: true,
    }}>
    <Stack.Screen
      name="NumberInput"
      component={NumberInputScreen}
      options={{headerShown: false}}
    />
  </Stack.Navigator>
);

export default ClientStack;
