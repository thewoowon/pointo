import React, {useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';

const StoreRegisterScreen = ({navigation, route}: any) => {
  const ownerUid: string | undefined = route?.params?.ownerUid;
  const {registerStore, findStoreByPhone, linkStoreToOwner} = useFirestore();

  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [storeName, setStoreName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);

  /** 등록 완료 처리 — 점주 계정에서 들어온 경우 계정에 연결 */
  const finalizeStore = async (code: string) => {
    if (ownerUid) {
      await linkStoreToOwner(ownerUid, code);
    }
    setRegisteredCode(code);
  };

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

    const existing = await findStoreByPhone(ownerPhone.trim());
    if (existing.length > 0) {
      setIsLoading(false);
      const storeList = existing
        .map(s => `${s.name} (${s.storeCode})`)
        .join('\n');
      return new Promise<void>(resolve => {
        Alert.alert(
          '이미 등록된 스토어가 있습니다',
          `${storeList}\n\n새 스토어를 추가로 등록하시겠습니까?`,
          [
            {text: '취소', style: 'cancel', onPress: () => resolve()},
            {
              text: '새로 등록',
              onPress: async () => {
                setIsLoading(true);
                const result = await registerStore({
                  name: storeName.trim(),
                  ownerPhone: ownerPhone.trim(),
                });
                setIsLoading(false);
                if (!result) {
                  Alert.alert('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
                } else {
                  await finalizeStore(result.storeCode);
                }
                resolve();
              },
            },
          ],
        );
      });
    }

    const result = await registerStore({
      name: storeName.trim(),
      ownerPhone: ownerPhone.trim(),
    });
    setIsLoading(false);

    if (!result) {
      Alert.alert('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      return;
    }

    await finalizeStore(result.storeCode);
  };

  const handleGoHome = () => {
    if (ownerUid) {
      navigation.navigate('Switcher');
    } else {
      navigation.navigate('ModeSelection');
    }
  };

  if (registeredCode) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContainer}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>등록 완료</Text>
            <Text style={styles.successSubtitle}>
              스토어가 개설되었어요.{'\n'}바로 로그인해서 사용할 수 있습니다.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>스토어 코드</Text>
              <Text style={styles.codeText}>{registeredCode}</Text>
            </View>

            <Text style={styles.noticeText}>
              스토어 코드를 꼭 기억해주세요.{'\n'}관리자 로그인 시 필요합니다.
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
            contentContainerStyle={{flexGrow: 1, paddingBottom: theme.spacing[10]}}
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
                  placeholderTextColor={theme.color.texticon.onNormal.lowemp}
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
                  placeholderTextColor={theme.color.texticon.onNormal.lowemp}
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
      borderBottomWidth: 1,
      borderColor: t.palette.gray[200],
    },
    backButtonWrapper: {
      position: 'absolute',
      left: t.spacing[4],
    },
    headerText: {
      fontSize: 18,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    goBackText: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    innerContainer: {
      flex: 1,
      paddingHorizontal: t.spacing[8],
      paddingTop: t.spacing[10],
      gap: t.spacing[6],
    },
    formSection: {
      gap: t.spacing[2],
      marginBottom: t.spacing[2],
    },
    pageTitle: {
      fontSize: 28,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      lineHeight: 36,
    },
    pageSubtitle: {
      fontSize: 16,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      lineHeight: 24,
    },
    fieldGroup: {
      gap: t.spacing[2],
    },
    fieldLabel: {
      fontSize: 16,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    input: {
      height: 56,
      borderColor: t.palette.gray[200],
      borderWidth: 1.5,
      borderRadius: t.radius.md,
      paddingHorizontal: t.spacing[4],
      fontSize: 18,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
      backgroundColor: t.color.surface.normal.bg1,
    },
    confirmButton: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 60,
      backgroundColor: t.color.surface.brand.primary,
      borderRadius: t.radius.lg,
      marginTop: t.spacing[2],
      shadowColor: t.color.surface.brand.primary,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
      paddingHorizontal: t.spacing[5],
    },
    confirmButtonText: {
      fontSize: 18,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onBrand.onPrimary,
    },
    // 완료 화면
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: t.spacing[10],
      gap: t.spacing[4],
    },
    successEmoji: {
      fontSize: 72,
    },
    successTitle: {
      fontSize: 36,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    successSubtitle: {
      fontSize: 18,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      lineHeight: 28,
    },
    codeBox: {
      alignItems: 'center',
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.xl,
      borderWidth: 1.5,
      borderColor: t.palette.gray[200],
      paddingVertical: t.spacing[6],
      paddingHorizontal: t.spacing[10],
      gap: t.spacing[2],
      marginTop: t.spacing[2],
      marginBottom: t.spacing[2],
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    codeLabel: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      letterSpacing: 1,
    },
    codeText: {
      fontSize: 44,
      fontFamily: 'SFUIDisplay-Medium',
      color: t.color.texticon.onNormal.highestemp,
      letterSpacing: 6,
    },
    noticeText: {
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      lineHeight: 24,
    },
  });

export default StoreRegisterScreen;
