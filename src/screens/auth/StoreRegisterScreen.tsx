import React, {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useFirestore} from '../../hooks';

const StoreRegisterScreen = ({navigation}: any) => {
  const {registerStore} = useFirestore();

  const [storeName, setStoreName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!storeName.trim()) {
      Alert.alert('가게 이름을 입력해주세요.');
      return;
    }
    if (!ownerPhone.trim()) {
      Alert.alert('점주 연락처를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    const result = await registerStore({
      name: storeName.trim(),
      ownerPhone: ownerPhone.trim(),
    });
    setIsLoading(false);

    if (!result) {
      Alert.alert('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
    }

    setRegisteredCode(result.storeCode);
  };

  const handleGoHome = () => {
    navigation.navigate('ModeSelection');
  };

  if (registeredCode) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <Text style={styles.successEmoji}>📋</Text>
            <Text style={styles.successTitle}>등록 신청 완료</Text>
            <Text style={styles.successSubtitle}>
              심사가 완료되면 로그인할 수 있어요.{'\n'}보통 1~2일 내에 처리됩니다.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>스토어 코드</Text>
              <Text style={styles.codeText}>{registeredCode}</Text>
            </View>

            <Text style={styles.noticeText}>
              스토어 코드를 꼭 기억해주세요.{'\n'}승인 후 로그인 시 필요합니다.
            </Text>

            <Pressable style={styles.confirmButton} onPress={handleGoHome}>
              <Text style={styles.confirmButtonText}>홈으로 돌아가기</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 등록 폼 화면
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.backButtonWrapper}>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={styles.goBackText}>뒤로</Text>
            </Pressable>
          </View>
          <Text style={styles.headerText}>새 가게 등록</Text>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
          <ScrollView
            contentContainerStyle={{flexGrow: 1, paddingBottom: 40}}
            keyboardShouldPersistTaps="handled">
            <View style={styles.innerContainer}>
              <View style={styles.formSection}>
                <Text style={styles.pageTitle}>가게 정보를 입력해주세요</Text>
                <Text style={styles.pageSubtitle}>
                  등록 완료 후 스토어 코드가 발급됩니다
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>가게 이름</Text>
                <TextInput
                  style={styles.input}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="예) 우리동네 볼링장"
                  placeholderTextColor="#AAAAAA"
                  maxLength={30}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>점주 연락처</Text>
                <TextInput
                  style={styles.input}
                  value={ownerPhone}
                  onChangeText={setOwnerPhone}
                  placeholder="010-0000-0000"
                  placeholderTextColor="#AAAAAA"
                  keyboardType="phone-pad"
                  maxLength={13}
                />
              </View>

              <Pressable
                style={({pressed}) => [
                  styles.confirmButton,
                  {opacity: isLoading || pressed ? 0.7 : 1},
                ]}
                onPress={handleRegister}
                disabled={isLoading}>
                <Text style={styles.confirmButtonText}>
                  {isLoading ? '등록 중...' : '가게 등록하기'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF4',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F2F4F6',
  },
  backButtonWrapper: {
    position: 'absolute',
    left: 16,
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#181818',
  },
  goBackText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: '#181818',
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 24,
  },
  formSection: {
    gap: 8,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
    lineHeight: 36,
  },
  pageSubtitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.6)',
    lineHeight: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  input: {
    height: 56,
    borderColor: '#E8D5C0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Pretendard-Regular',
    color: '#3D2416',
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    backgroundColor: '#D4845A',
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#D4845A',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  // 완료 화면
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  successEmoji: {
    fontSize: 72,
  },
  successTitle: {
    fontSize: 36,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  successSubtitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.65)',
    textAlign: 'center',
    lineHeight: 28,
  },
  codeBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8D5C0',
    paddingVertical: 28,
    paddingHorizontal: 40,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#D4845A',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  codeLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 44,
    fontFamily: 'SFUIDisplay-Medium',
    color: '#3D2416',
    letterSpacing: 6,
  },
  noticeText: {
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default StoreRegisterScreen;
