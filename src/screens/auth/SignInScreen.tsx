import React, {useState} from 'react';
import {
  SafeAreaView,
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
import {useAuth, useFirestore, useAnalytics} from '../../hooks';
import {AnalyticsEvent} from '../../analytics/events';
// import {BackgroundDeco} from '../../components/background';

const SignInScreen = ({navigation, route}: any) => {
  const mode = route.params?.mode;
  const title = mode === 'supervisor' ? '관리자 로그인' : '고객 로그인';

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
        backgroundColor="#6a51ae"
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
              left: 16,
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
            contentContainerStyle={{flexGrow: 1, paddingBottom: 20}}
            keyboardShouldPersistTaps="handled">
            <View style={styles.innerContainer}>
              <View style={styles.flexBox}>
                <Text style={styles.label}>스토어 코드 입력</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={handleChange}
                  placeholder="스토어 코드를 입력해주세요"
                  placeholderTextColor={'#6D6D6D'}
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
                      placeholderTextColor={'#6D6D6D'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    gap: 20,
  },
  modeContainer: {
    width: '100%',
    maxWidth: 391,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#3D7BF7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  modeText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
  },
  header: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 50,
    borderBottomWidth: 1,
    borderColor: '#F2F4F6',
  },
  headerText: {
    color: '#181818',
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
  },
  goBackText: {
    color: '#181818',
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  label: {
    fontSize: 28,
    color: '#181818',
    fontFamily: 'Pretendard-SemiBold',
    lineHeight: 34,
  },
  input: {
    width: '100%',
    maxWidth: 391,
    height: 60,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 20,
    backgroundColor: 'white',
  },
  confirmButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 391,
    height: 55,
    backgroundColor: '#FE8300',
    borderRadius: 20,
    // shadow
    shadowColor: '#FE6D00',
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
    color: 'white',
    fontFamily: 'Pretendard-Regular',
  },
  findCodeText: {
    fontSize: 14,
    color: '#6D6D6D',
    fontFamily: 'Pretendard-Regular',
    textDecorationLine: 'underline',
  },
  findCodeBox: {
    width: '100%',
    maxWidth: 391,
    gap: 12,
    alignItems: 'center',
  },
  findCodeLabel: {
    fontSize: 16,
    color: '#181818',
    fontFamily: 'Pretendard-Medium',
  },
  findButton: {
    backgroundColor: '#333',
    shadowColor: '#333',
  },
});

export default SignInScreen;
