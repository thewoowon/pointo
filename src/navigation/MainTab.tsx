import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import SupervisorScreen from '../screens/supervisor';
import ClientScreen from '../screens/client';
import {useAuth, useStoreLifecycle, useTheme} from '../hooks';

/**
 * 삭제된 매장에 들어와 있을 때의 막다른 화면.
 *
 * 삭제는 유예를 두고 처리해서 매장 문서가 곧바로 사라지지 않는다. 그 사이에도
 * 카운터 기기는 아무 일 없다는 듯 계속 도는데, 그러면 손님이 곧 없어질 매장에
 * 적립을 쌓는다 — 지운 쪽은 지웠다고 믿고 있으니 아무도 모르는 채로 쌓이다가
 * 유예가 끝나는 날 한꺼번에 사라진다. 그래서 여기서 끊는다.
 */
const DeletedStoreNotice = ({missing}: {missing: boolean}) => {
  const theme = useTheme();
  const {setIsAuthenticated} = useAuth();

  return (
    <View style={[s.fill, {backgroundColor: theme.color.surface.normal.bg1}]}>
      <SafeAreaView style={s.fill}>
        <View style={s.center}>
          <Text
            style={[
              s.title,
              {color: theme.color.texticon.onNormal.highestemp},
            ]}>
            삭제된 매장이에요
          </Text>
          <Text style={[s.body, {color: theme.color.texticon.onNormal.midemp}]}>
            {missing
              ? '이 매장은 삭제가 끝나 더 이상 사용할 수 없습니다.'
              : '이 매장은 삭제 처리 중이라 적립을 받을 수 없습니다.\n잘못 지우셨다면 고객센터로 알려주세요.'}
          </Text>
          <Pressable
            style={[
              s.btn,
              {backgroundColor: theme.color.surface.brand.primary},
            ]}
            onPress={() => setIsAuthenticated(false)}>
            <Text
              style={[
                s.btnText,
                {color: theme.color.texticon.onBrand.onPrimary},
              ]}>
              내 매장으로 돌아가기
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};

/**
 * 로그인 후 진입하는 메인 영역. 탭바는 노출하지 않고 mode에 따라
 * 관리자(Supervisor) / 고객(Client) 스택 중 하나만 렌더한다.
 * mode가 바뀌면 컴포넌트 타입이 바뀌어 자연스럽게 새로 마운트된다.
 *
 * 두 모드가 함께 지나는 유일한 길목이라, 삭제된 매장을 막는 것도 여기서 한다.
 */
const MainTab = ({mode}: {mode: 'supervisor' | 'client'}) => {
  const {storeCode} = useAuth();
  const lifecycle = useStoreLifecycle(storeCode);
  const theme = useTheme();

  // 판정 전에 화면을 그리면 정상 매장도 한 프레임 깜빡인다.
  if (lifecycle === 'loading') {
    return (
      <View
        style={[
          s.fill,
          s.center,
          {backgroundColor: theme.color.surface.normal.bg1},
        ]}>
        <ActivityIndicator
          size="large"
          color={theme.color.surface.brand.primary}
        />
      </View>
    );
  }

  if (lifecycle !== 'active') {
    return <DeletedStoreNotice missing={lifecycle === 'missing'} />;
  }

  return mode === 'supervisor' ? <SupervisorScreen /> : <ClientScreen />;
};

const s = StyleSheet.create({
  fill: {flex: 1},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32},
  title: {fontSize: 20, fontWeight: '700', letterSpacing: -0.5},
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  btn: {
    marginTop: 32,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {fontSize: 16, fontWeight: '600', letterSpacing: -0.3},
});

export default MainTab;
