import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {LoginScreen, StoreRegisterScreen} from '../screens/auth';
import {
  SwitcherScreen,
  AccountSettingsScreen,
  DeletionConfirmScreen,
  DeletionPendingScreen,
} from '../screens/common';
import {OnboardingScreen, hasSeenOnboarding} from '../screens/onboarding';
import {useAuth, useTheme} from '../hooks';

const Stack = createStackNavigator();

/**
 * 로그인 전 스택. 진입점은 온보딩(최초 1회) → 구글 로그인.
 *   [Onboarding] → Login → Switcher(내 매장/슬롯) → [스토어 선택 + 모드] → MainTab
 * 이미 로그인된 상태로 재진입하면 LoginScreen이 상태에 따라 Switcher 또는
 * DeletionPending(탈퇴 유예)으로 자동 통과시킨다.
 */
const AuthStack = () => {
  const theme = useTheme();
  const {ownerUid} = useAuth();

  // null = 판정 전. 첫 프레임에 Login을 깔아버리면 initialRouteName은 이미
  // 굳어서 온보딩이 영영 뜨지 않는다 — 그래서 잠깐 비워둔다.
  // 이 시점의 ownerUid는 이미 확정된 값이다: RootNavigator가 세션 복원
  // (isLoading)이 끝난 뒤에야 이 스택을 마운트한다.
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // 이미 로그인해서 쓰고 있던 점주에겐 띄우지 않는다. 그쪽은 설정의
      // '포인토 사용법'과 매장 등록 직후(setup 슬롯)로 닿는다.
      const seen = await hasSeenOnboarding('intro');
      if (active) setShowIntro(!seen && !ownerUid);
    })();
    return () => {
      active = false;
    };
    // 마운트 시 1회 — ownerUid는 위 주석대로 이 시점에 확정돼 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showIntro === null) {
    return (
      <View
        style={[
          styles.gate,
          {backgroundColor: theme.color.surface.normal.bg1},
        ]}
      />
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={showIntro ? 'Onboarding' : 'Login'}
      screenOptions={{headerShown: false}}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{slot: 'intro'}}
        options={{gestureEnabled: false}}
      />
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
};

const styles = StyleSheet.create({
  gate: {flex: 1},
});

export default AuthStack;
