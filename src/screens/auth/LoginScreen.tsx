import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {AppleIcon, GoogleIcon} from '../../components/Icons';
import {
  isAppleSignInSupported,
  registerAppleRefreshToken,
  signInWithApple,
  signInWithGoogle,
} from '../../services/auth';

type OwnerAccount = {uid: string; email: string};

/** 로그인 제공자 식별 (로딩 스피너를 어느 버튼에 표시할지) */
type Provider = 'google' | 'apple';

const LoginScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, setOwnerUid, setOwnerEmail} = useAuth();
  const {ensureOwnerProfile, getOwnerProfile} = useFirestore();

  // 진행 중인 제공자(null이면 유휴). 어느 버튼에 스피너를 띄울지 결정한다.
  const [pending, setPending] = useState<Provider | null>(null);
  const appleSupported = useMemo(() => isAppleSignInSupported(), []);

  // 로그인(또는 이미 로그인된 상태로 재진입)되면 계정 상태에 따라 목적지를 정한다.
  // 정상 계정 → Switcher, 탈퇴 유예 중 → DeletionPending(매장 접근 차단).
  useEffect(() => {
    if (!ownerUid) return;
    let active = true;
    (async () => {
      const owner = await getOwnerProfile(ownerUid);
      if (!active) return;
      const dest =
        owner?.accountStatus === 'pending_deletion'
          ? 'DeletionPending'
          : 'Switcher';
      navigation.reset({index: 0, routes: [{name: dest}]});
    })();
    return () => {
      active = false;
    };
    // getOwnerProfile은 매 렌더 새 참조 — ownerUid만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUid, navigation]);

  /**
   * 구글·애플 공통 후처리: 프로필 보장 → 세션 세팅.
   * 실제 화면 이동은 ownerUid 변경을 감지하는 위 useEffect가 상태에 맞춰 처리한다.
   */
  const completeSignIn = async (account: OwnerAccount) => {
    await ensureOwnerProfile(account.uid, account.email);
    setOwnerUid(account.uid);
    setOwnerEmail(account.email);
  };

  const handleGoogle = async () => {
    setPending('google');
    try {
      const account = await signInWithGoogle();
      if (!account) return; // 사용자가 취소
      await completeSignIn(account);
    } catch (error) {
      console.error('[login] google sign-in failed:', error);
      Alert.alert(
        '로그인 실패',
        '구글 로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setPending(null);
    }
  };

  const handleApple = async () => {
    setPending('apple');
    try {
      const account = await signInWithApple();
      if (!account) return; // 사용자가 취소
      // 탈퇴 시 revoke용 refresh token 저장 (실패해도 로그인은 진행 — 비차단)
      void registerAppleRefreshToken(account);
      await completeSignIn(account);
    } catch (error) {
      console.error('[login] apple sign-in failed:', error);
      Alert.alert(
        '로그인 실패',
        'Apple 로그인에 실패했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/images/pointo-full-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.actions}>
          <View style={styles.socialLoginContainer}>
            <View style={styles.horizontalLine}></View>
            <Text style={styles.socialLoginText}>소셜로그인으로 계속하기</Text>
            <View style={styles.horizontalLine}></View>
          </View>
          <Pressable
            style={({pressed}) => [
              styles.googleBtn,
              {opacity: pending ? 0.9 : pressed ? 0.7 : 1},
            ]}
            onPress={handleGoogle}
            disabled={pending !== null}>
            <View style={{position: 'absolute', left: 16}}>
              <GoogleIcon width={20} height={20} />
            </View>
            {pending === 'google' ? (
              <ActivityIndicator
                color={theme.color.texticon.onNormal.highemp}
              />
            ) : (
              <Text style={styles.googleBtnText}>구글로 계속하기</Text>
            )}
          </Pressable>

          {appleSupported && (
            <Pressable
              style={({pressed}) => [
                styles.appleBtn,
                {opacity: pending ? 0.9 : pressed ? 0.85 : 1},
              ]}
              onPress={handleApple}
              disabled={pending !== null}>
              <View style={{position: 'absolute', left: 16}}>
                <AppleIcon
                  width={20}
                  height={20}
                  color={theme.color.etc.absolute.white}
                />
              </View>
              {pending === 'apple' ? (
                <ActivityIndicator color={theme.color.etc.absolute.white} />
              ) : (
                <Text style={styles.appleBtnText}>애플로 계속하기</Text>
              )}
            </Pressable>
          )}
          <Text style={styles.legal}>
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.bg1,
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: t.spacing[6],
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    logo: {
      width: '100%',
      maxWidth: 220,
      height: 53,
      marginBottom: t.spacing[2],
    },
    actions: {
      paddingBottom: t.spacing[8],
      gap: t.spacing[2.5],
      // 모바일: 자식이 100%로 꽉 참 / 태블릿: maxWidth에서 캡되고 가운데 정렬
      alignItems: 'center',
    },
    socialLoginContainer: {
      width: '100%',
      maxWidth: 420,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing[2],
    },
    horizontalLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.palette.gray[300],
    },
    socialLoginText: {
      marginHorizontal: t.spacing[3],
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
    },
    googleBtn: {
      width: '100%',
      maxWidth: 420,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing[3],
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.palette.gray[300],
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    googleBtnText: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highestemp,
    },
    appleBtn: {
      width: '100%',
      maxWidth: 420,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing[3],
      backgroundColor: t.color.etc.absolute.black,
      borderRadius: t.radius.sm,
    },
    appleBtnText: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.color.etc.absolute.white,
    },
    legal: {
      width: '100%',
      maxWidth: 420,
      fontSize: 12,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

export default LoginScreen;
