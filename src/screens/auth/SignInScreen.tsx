import React, {useMemo, useState} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useAnalytics, useTheme} from '../../hooks';
import {AnalyticsEvent} from '../../analytics/events';
import type {Theme} from '../../theme';
// import {BackgroundDeco} from '../../components/background';

const SignInScreen = ({navigation, route}: any) => {
  const mode = route.params?.mode;
  const title = mode === 'supervisor' ? '관리자 로그인' : '고객 로그인';

  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {setIsAuthenticated, setMode, initStoreCode, setStoreName} = useAuth();
  const {getStores, findStoreByPhone} = useFirestore();
  const {track} = useAnalytics();

  const [storeCode, setStoreCode] = useState('');
  const [findMode, setFindMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [findLoading, setFindLoading] = useState(false);
  const handleChange = (text: string) => {
    setStoreCode(text);
  };

  const handleFindCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert('전화번호를 입력해주세요.');
      return;
    }
    setFindLoading(true);
    const results = await findStoreByPhone(trimmed);
    setFindLoading(false);
    if (results.length === 0) {
      Alert.alert(
        '조회 결과 없음',
        '해당 전화번호로 등록된 스토어가 없습니다.',
      );
      return;
    }
    if (results.length === 1) {
      Alert.alert(
        '스토어 코드 찾기',
        `${results[0].name}\n스토어 코드: ${results[0].storeCode}`,
      );
      setStoreCode(results[0].storeCode);
      setFindMode(false);
      return;
    }
    const message = results
      .map(s => `${s.name} — ${s.storeCode}`)
      .join('\n');
    Alert.alert(
      `등록된 스토어 ${results.length}개`,
      message,
      results.map(s => ({
        text: s.name,
        onPress: () => {
          setStoreCode(s.storeCode);
          setFindMode(false);
        },
      })),
    );
  };
  const handleSignIn = async () => {
    if (storeCode === '') {
      Alert.alert('스토어 코드를 입력해주세요.');
      return;
    }

    const response = await getStores(storeCode);
    if (!response) {
      Alert.alert('존재하지 않는 스토어 코드입니다.');
      return;
    }

    try {
      track(AnalyticsEvent.OWNER_LOGIN, {
        store_code: storeCode,
      });
    } catch (error) {
      console.error('Error logging owner login:', error);
    }

    setMode(mode);
    setIsAuthenticated(true);
    initStoreCode(storeCode);
    setStoreName(response.name || null);
  };
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.header}>
          {/* 상단 헤더 */}
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              position: 'absolute',
              left: theme.spacing[4],
            }}>
            <Pressable
              onPress={() => {
                navigation.goBack();
              }}>
              <Text style={styles.goBackText}>뒤로</Text>
            </Pressable>
          </View>
          <Text style={styles.headerText}>{title}</Text>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
          {/* renderContent만 ScrollView로 감싸기 */}
          <ScrollView
            contentContainerStyle={{flexGrow: 1, paddingBottom: theme.spacing[5]}}
            keyboardShouldPersistTaps="handled">
            <View style={styles.innerContainer}>
              <View style={styles.flexBox}>
                <Text style={styles.label}>스토어 코드 입력</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange}
                  placeholder="스토어 코드를 입력해주세요"
                  placeholderTextColor={theme.color.texticon.onNormal.midemp}
                />
                <Pressable style={styles.confirmButton} onPress={handleSignIn}>
                  <Text style={styles.confirmButtonText}>로그인</Text>
                </Pressable>
                {mode === 'supervisor' && !findMode && (
                  <Pressable onPress={() => setFindMode(true)}>
                    <Text style={styles.findCodeText}>
                      스토어 코드를 잊으셨나요?
                    </Text>
                  </Pressable>
                )}
                {findMode && (
                  <View style={styles.findCodeBox}>
                    <Text style={styles.findCodeLabel}>
                      가입 시 입력한 전화번호
                    </Text>
                    <TextInput
                      style={styles.input}
                      onChangeText={setPhone}
                      value={phone}
                      placeholder="01012345678"
                      placeholderTextColor={theme.color.texticon.onNormal.midemp}
                      keyboardType="phone-pad"
                    />
                    <Pressable
                      style={[
                        styles.confirmButton,
                        styles.findButton,
                      ]}
                      onPress={handleFindCode}
                      disabled={findLoading}>
                      <Text style={styles.confirmButtonText}>
                        {findLoading ? '조회 중...' : '스토어 코드 찾기'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {/* <BackgroundDeco /> */}
      </SafeAreaView>
    </View>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: t.spacing[5],
    },
    backgroundStyle: {
      flex: 1,
    },
    flexBox: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[5],
    },
    header: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: t.spacing[3],
      paddingBottom: t.spacing[3],
      maxHeight: 50,
      // 디자인 시스템엔 border 토큰이 없음(=보더 미사용). 헤더 구분선은
      // 가장 옅은 surface 토큰으로 임시 대체 — 리디자인 패스에서 재검토.
      borderBottomWidth: 1,
      borderColor: t.color.surface.normal.container10,
    },
    headerText: {
      color: t.color.texticon.onNormal.highestemp,
      fontSize: 18,
      fontFamily: t.font.semibold,
    },
    goBackText: {
      color: t.color.texticon.onNormal.highestemp,
      fontSize: 14,
      fontFamily: t.font.regular,
    },
    label: {
      fontSize: 28,
      color: t.color.texticon.onNormal.highestemp,
      fontFamily: t.font.semibold,
      lineHeight: 34,
    },
    input: {
      width: '100%',
      maxWidth: 391,
      height: 60,
      // border 토큰 부재 → 중립 팔레트로 입력 외곽선 처리 (리디자인 때 재검토)
      borderColor: t.palette.gray[300],
      borderWidth: 1,
      borderRadius: t.radius.sm,
      textAlign: 'center',
      fontSize: 20,
      color: t.color.texticon.onNormal.highestemp,
      backgroundColor: t.color.surface.normal.bg1,
    },
    confirmButton: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      maxWidth: 391,
      height: 55,
      backgroundColor: t.color.surface.brand.primary,
      borderRadius: t.radius.xl,
      // shadow
      shadowColor: t.color.surface.brand.primary,
      shadowOffset: {
        width: 0,
        height: 4.5,
      },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
    confirmButtonText: {
      fontSize: 16,
      color: t.color.texticon.onBrand.onPrimary,
      fontFamily: t.font.regular,
    },
    findCodeText: {
      fontSize: 14,
      color: t.color.texticon.onNormal.midemp,
      fontFamily: t.font.regular,
      textDecorationLine: 'underline',
    },
    findCodeBox: {
      width: '100%',
      maxWidth: 391,
      gap: t.spacing[3],
      alignItems: 'center',
    },
    findCodeLabel: {
      fontSize: 16,
      color: t.color.texticon.onNormal.highestemp,
      fontFamily: t.font.medium,
    },
    findButton: {
      // 보조(코드 찾기) 버튼 — 중립 다크. 시맨틱 토큰 없어 팔레트 직접 사용.
      backgroundColor: t.palette.gray[800],
      shadowColor: t.palette.gray[800],
    },
  });

export default SignInScreen;
