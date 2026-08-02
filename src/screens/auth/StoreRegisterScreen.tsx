import React, {useMemo, useState} from 'react';
import {
  Alert,
  Image,
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
      navigation.navigate('Login');
    }
  };

  if (registeredCode) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerText}>등록완료</Text>
          </View>

          <View style={styles.successContainer}>
            <Image
              source={require('../../assets/images/store_register_complete.png')}
              style={styles.successIllust}
              resizeMode="contain"
            />
            <Text style={styles.successTitle}>등록완료되었습니다.</Text>
            <Text style={styles.successSubtitle}>
              내 매장에서 바로 시작할 수 있어요.
            </Text>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.confirmButton} onPress={handleGoHome}>
              <Text style={styles.confirmButtonText}>바로 시작</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 두 필드가 모두 채워져야 등록 버튼 활성화
  const fieldsFilled =
    storeName.trim().length > 0 && ownerPhone.trim().length > 0;
  const canSubmit = fieldsFilled && !isLoading;

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
          <Text style={styles.headerText}>새 매장 등록</Text>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
          <ScrollView
            style={{flex: 1}}
            contentContainerStyle={{flexGrow: 1, paddingBottom: theme.spacing[6]}}
            keyboardShouldPersistTaps="handled">
            <View style={styles.innerContainer}>
              <View style={styles.formSection}>
                <Text style={styles.pageTitle}>매장정보를 입력해주세요</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>매장명을 입력해주세요</Text>
                <TextInput
                  style={styles.input}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="예) 커피빈 상봉점"
                  placeholderTextColor={theme.color.texticon.onNormal.lowemp}
                  maxLength={30}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>점주님의 연락처를 입력해주세요</Text>
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
            </View>
          </ScrollView>

          {/* 하단 고정 CTA — 키보드가 올라오면 KAV가 이 footer를 함께 밀어올린다 */}
          <View style={styles.footer}>
            <Pressable
              style={({pressed}) => [
                styles.confirmButton,
                !fieldsFilled && styles.confirmButtonDisabled,
                fieldsFilled && (isLoading || pressed) && {opacity: 0.7},
              ]}
              onPress={handleRegister}
              disabled={!canSubmit}>
              <Text
                style={[
                  styles.confirmButtonText,
                  !fieldsFilled && styles.confirmButtonTextDisabled,
                ]}>
                {isLoading ? '등록 중...' : '가게 등록하기'}
              </Text>
            </Pressable>
          </View>
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
      backgroundColor: t.color.surface.normal.container0,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: t.spacing[3.5],
    },
    backButtonWrapper: {
      position: 'absolute',
      left: t.spacing[4],
    },
    headerText: {
      fontSize: 16,
      fontFamily: t.font.medium,
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
      alignItems: 'center',
      marginBottom: t.spacing[2],
    },
    pageTitle: {
      fontSize: 20,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      lineHeight: 28,
      textAlign: 'center',
    },
    fieldGroup: {
      gap: t.spacing[2],
    },
    fieldLabel: {
      fontSize: 16,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    // NumberInputScreen의 inputBox와 동일한 브랜드 보더 + 글로우 처리
    input: {
      height: 56,
      borderColor: t.color.surface.brand.primary,
      borderWidth: 1.5,
      borderRadius: 10,
      paddingHorizontal: t.spacing[4],
      fontSize: 16,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
      backgroundColor: t.color.surface.normal.bg1,
      shadowColor: t.color.surface.brand.primary,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 2,
    },
    footer: {
      paddingHorizontal: t.spacing[8],
      paddingTop: t.spacing[3],
      paddingBottom: t.spacing[4],
      backgroundColor: t.color.surface.normal.container0,
    },
    confirmButton: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 60,
      backgroundColor: t.color.surface.brand.primary,
      borderRadius: t.radius.sm,
      shadowColor: t.color.surface.brand.primary,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
      paddingHorizontal: t.spacing[5],
    },
    // 필드 미입력 시: 브랜드 컬러·그림자 제거하고 중립 회색으로
    confirmButtonDisabled: {
      backgroundColor: '#E2E8F0',
      shadowOpacity: 0,
      elevation: 0,
    },
    confirmButtonText: {
      fontSize: 18,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onBrand.onPrimary,
    },
    confirmButtonTextDisabled: {
      color: '#94A3B8',
    },
    // 완료 화면
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: t.spacing[10],
      gap: t.spacing[3],
    },
    successIllust: {
      width: 200,
      height: 200,
      marginBottom: t.spacing[4],
    },
    successTitle: {
      fontSize: 24,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: 16,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      lineHeight: 24,
    },
  });

export default StoreRegisterScreen;
