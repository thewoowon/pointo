import React, {useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  authErrorMessage,
} from '../../services/auth';

type AuthMode = 'login' | 'signup';

const EmailAuthScreen = ({navigation}: any) => {
  const {setOwnerUid, setOwnerEmail} = useAuth();
  const {ensureOwnerProfile} = useFirestore();

  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignup = authMode === 'signup';
  const title = isSignup ? '점주 계정 만들기' : '이메일로 로그인';

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('이메일을 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const user = isSignup
        ? await signUpWithEmail(trimmedEmail, password)
        : await signInWithEmail(trimmedEmail, password);

      // 계정 프로필 보장 (없으면 생성, 기본 슬롯 3)
      await ensureOwnerProfile(user.uid, user.email ?? trimmedEmail);

      setOwnerUid(user.uid);
      setOwnerEmail(user.email ?? trimmedEmail);

      if (isSignup) {
        Alert.alert(
          '인증메일을 보냈어요',
          `${trimmedEmail}로 인증 링크를 보냈습니다.\n메일함에서 확인해주세요. (지금 바로 이용은 가능해요)`,
        );
      }

      // 스토어 선택/연결 화면으로
      navigation.reset({
        index: 0,
        routes: [{name: 'Switcher'}],
      });
    } catch (error) {
      Alert.alert('로그인 실패', authErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('비밀번호 재설정', '먼저 이메일을 입력해주세요.');
      return;
    }
    try {
      await sendPasswordReset(trimmedEmail);
      Alert.alert(
        '재설정 메일 발송',
        `${trimmedEmail}로 비밀번호 재설정 메일을 보냈습니다.`,
      );
    } catch (error) {
      Alert.alert('발송 실패', authErrorMessage(error));
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
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>관리자 로그인</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.intro}>
              <Text style={styles.pageTitle}>{title}</Text>
              <Text style={styles.pageSubtitle}>
                {isSignup
                  ? '이메일 계정 하나로 여러 매장을 관리해요.'
                  : '점주 계정으로 로그인하세요.'}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>이메일</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor={theme.color.texticon.onNormal.lowemp}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="6자 이상"
                placeholderTextColor={theme.color.texticon.onNormal.lowemp}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {!isSignup && (
              <Pressable onPress={handleForgotPassword} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
              </Pressable>
            )}

            <Pressable
              style={({pressed}) => [
                styles.primaryBtn,
                {opacity: isLoading || pressed ? 0.7 : 1},
              ]}
              onPress={handleSubmit}
              disabled={isLoading}>
              <Text style={styles.primaryBtnText}>
                {isLoading
                  ? '처리 중...'
                  : isSignup
                  ? '가입하고 시작하기'
                  : '로그인'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.switchModeBtn}
              onPress={() => setAuthMode(isSignup ? 'login' : 'signup')}>
              <Text style={styles.switchModeText}>
                {isSignup ? '이미 계정이 있어요 · 로그인' : '계정이 없으신가요? 가입하기'}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate('SignIn', {mode: 'supervisor'})
              }>
              <Text style={styles.secondaryBtnText}>스토어 코드로 빠른 로그인</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

// 보더 토큰이 디자인 시스템에 없어(=보더 미사용 방침), 구분선·입력 외곽선은
// 중립 팔레트로 임시 처리. 리디자인 패스에서 보더 정책 확정 시 교체.
const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.container10,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: t.spacing[3.5],
      backgroundColor: t.color.surface.normal.bg1,
      borderBottomWidth: 1,
      borderBottomColor: t.palette.gray[200],
    },
    backButton: {
      position: 'absolute',
      left: t.spacing[4],
    },
    backText: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highemp,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: t.spacing[6],
      paddingTop: t.spacing[8],
      paddingBottom: t.spacing[10],
      gap: t.spacing[4],
    },
    intro: {
      gap: t.spacing[2],
      marginBottom: t.spacing[2],
    },
    pageTitle: {
      fontSize: 26,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      lineHeight: 34,
    },
    pageSubtitle: {
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      lineHeight: 22,
    },
    field: {
      gap: t.spacing[2],
    },
    fieldLabel: {
      fontSize: 14,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.midemp,
    },
    input: {
      height: 54,
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.palette.gray[200],
      paddingHorizontal: t.spacing[4],
      fontSize: 16,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    forgotBtn: {
      alignSelf: 'flex-end',
      marginTop: -t.spacing[1.5],
    },
    forgotText: {
      fontSize: 13,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
      textDecorationLine: 'underline',
    },
    primaryBtn: {
      height: 56,
      backgroundColor: t.color.surface.brand.primary,
      borderRadius: t.radius.lg,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: t.spacing[1],
    },
    primaryBtnText: {
      fontSize: 17,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onBrand.onPrimary,
    },
    switchModeBtn: {
      alignItems: 'center',
      paddingVertical: t.spacing[1],
    },
    switchModeText: {
      fontSize: 14,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.midemp,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3],
      marginVertical: t.spacing[1],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.palette.gray[200],
    },
    dividerText: {
      fontSize: 12,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
    },
    secondaryBtn: {
      height: 54,
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.palette.gray[200],
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: 15,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highemp,
    },
  });

export default EmailAuthScreen;
