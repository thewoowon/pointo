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
import {GoogleIcon} from '../../components/Icons';
import {signInWithGoogle} from '../../services/auth';

type OwnerAccount = {uid: string; email: string};

/** 로그인 제공자 식별 (로딩 스피너를 어느 버튼에 표시할지) */
type Provider = 'google';

const LoginScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, setOwnerUid, setOwnerEmail} = useAuth();
  const {ensureOwnerProfile} = useFirestore();

  // 진행 중인 제공자(null이면 유휴). 어느 버튼에 스피너를 띄울지 결정한다.
  const [pending, setPending] = useState<Provider | null>(null);

  // 이미 구글 로그인된 상태(예: '내 매장으로' 복귀)면 로그인 건너뛰고 스위처로
  useEffect(() => {
    if (ownerUid) {
      navigation.reset({index: 0, routes: [{name: 'Switcher'}]});
    }
  }, [ownerUid, navigation]);

  /** 구글·애플 공통 후처리: 프로필 보장 → 세션 세팅 → 스위처로 이동 */
  const completeSignIn = async (account: OwnerAccount) => {
    await ensureOwnerProfile(account.uid, account.email);
    setOwnerUid(account.uid);
    setOwnerEmail(account.email);
    navigation.reset({index: 0, routes: [{name: 'Switcher'}]});
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
          <Pressable
            style={({pressed}) => [
              styles.googleBtn,
              {opacity: pending ? 0.9 : pressed ? 0.7 : 1},
            ]}
            onPress={handleGoogle}
            disabled={pending !== null}>
            {pending === 'google' ? (
              <ActivityIndicator
                color={theme.color.texticon.onNormal.highemp}
              />
            ) : (
              <>
                <GoogleIcon width={20} height={20} />
                <Text style={styles.googleBtnText}>Google로 계속하기</Text>
              </>
            )}
          </Pressable>

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
      gap: t.spacing[4],
      // 모바일: 자식이 100%로 꽉 참 / 태블릿: maxWidth에서 캡되고 가운데 정렬
      alignItems: 'center',
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
      borderRadius: t.radius.lg,
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
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
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
