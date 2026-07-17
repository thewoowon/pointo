import React, {useState} from 'react';
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
import {useAuth, useFirestore} from '../../hooks';
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
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
                placeholderTextColor="#B5B8BC"
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
                placeholderTextColor="#B5B8BC"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    position: 'absolute',
    left: 16,
  },
  backText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: '#3D4C57',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#191D2B',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 18,
  },
  intro: {
    gap: 8,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'Pretendard-SemiBold',
    color: '#191D2B',
    lineHeight: 34,
  },
  pageSubtitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: '#73777B',
    lineHeight: 22,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#73777B',
  },
  input: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E8EA',
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    color: '#191D2B',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: '#9DA1A6',
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#D4845A',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchModeText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#73777B',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E7E8EA',
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: '#B5B8BC',
  },
  secondaryBtn: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E8EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    color: '#3D4C57',
  },
});

export default EmailAuthScreen;
