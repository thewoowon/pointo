import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {
  signOutOwner,
  getCurrentOwner,
  reloadCurrentOwner,
  resendVerificationEmail,
} from '../../services/auth';
import {ShortRightArrowIcon} from '../../components/Icons';

const SwitcherScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    ownerUid,
    ownerEmail,
    setOwnerUid,
    setOwnerEmail,
    initStoreCode,
    setStoreName,
    setMode,
    setIsAuthenticated,
  } = useAuth();
  const {getOwnerStores, claimStoresByPhone, getOwnerSlotInfo} = useFirestore();

  // ownerUid가 컨텍스트에 없으면 Firebase 현재 세션에서 폴백
  const uid = ownerUid ?? getCurrentOwner()?.uid ?? null;

  const [stores, setStores] = useState<{storeCode: string; name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slot, setSlot] = useState<{current: number; limit: number; canAdd: boolean}>({
    current: 0,
    limit: 3,
    canAdd: true,
  });
  const [emailVerified, setEmailVerified] = useState(true);
  const [claimVisible, setClaimVisible] = useState(false);
  const [phone, setPhone] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [list, slotInfo] = await Promise.all([
      getOwnerStores(uid),
      getOwnerSlotInfo(uid),
    ]);
    setStores(list);
    setSlot(slotInfo);
    setEmailVerified(getCurrentOwner()?.emailVerified ?? true);
    setIsLoading(false);
    // useFirestore()는 매 렌더 새 함수 참조를 반환하므로 uid만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSelectStore = (store: {storeCode: string; name: string}) => {
    initStoreCode(store.storeCode);
    setStoreName(store.name);
    setMode('supervisor');
    setIsAuthenticated(true);
    // RootNavigator가 isAuthenticated=true를 감지해 MainTab(관리자)로 전환
  };

  const handleAddStore = async () => {
    if (!uid) return;
    const info = await getOwnerSlotInfo(uid);
    setSlot(info);
    if (!info.canAdd) {
      Alert.alert(
        '슬롯이 가득 찼어요',
        `현재 ${info.current}/${info.limit}개를 사용 중입니다.\n구독하면 최대 10개까지 늘릴 수 있어요. (준비 중)`,
      );
      return;
    }
    navigation.navigate('StoreRegister', {ownerUid: uid});
  };

  const handleClaim = async () => {
    if (!uid) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      Alert.alert('전화번호를 입력해주세요.');
      return;
    }
    setClaiming(true);
    const claimed = await claimStoresByPhone(uid, trimmed);
    setClaiming(false);
    setClaimVisible(false);
    setPhone('');
    if (claimed.length === 0) {
      Alert.alert(
        '연결할 가게가 없어요',
        '해당 번호로 등록된 가게가 없거나, 이미 다른 계정에 연결돼 있습니다.',
      );
      return;
    }
    Alert.alert('연결 완료', `${claimed.length}개 가게를 계정에 연결했어요.`);
    load();
  };

  const handleLogout = async () => {
    try {
      await signOutOwner();
    } catch {}
    setOwnerUid(null);
    setOwnerEmail(null);
    navigation.reset({index: 0, routes: [{name: 'ModeSelection'}]});
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      Alert.alert('인증메일 재발송', '메일함을 확인해주세요.');
    } catch {
      Alert.alert('발송 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  const handleCheckVerified = async () => {
    const user = await reloadCurrentOwner();
    if (user?.emailVerified) {
      setEmailVerified(true);
      Alert.alert('인증 완료', '이메일 인증이 완료됐어요.');
    } else {
      Alert.alert('아직 미완료', '메일의 인증 링크를 클릭한 뒤 다시 눌러주세요.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.color.surface.normal.bg1} translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>내 매장</Text>
            {ownerEmail ? (
              <Text style={styles.headerEmail}>{ownerEmail}</Text>
            ) : null}
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.color.surface.brand.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* 이메일 인증 넛지 */}
            {!emailVerified && (
              <View style={styles.verifyBanner}>
                <Text style={styles.verifyText}>
                  이메일 인증이 아직 완료되지 않았어요.
                </Text>
                <View style={styles.verifyActions}>
                  <Pressable onPress={handleResendVerification}>
                    <Text style={styles.verifyLink}>재발송</Text>
                  </Pressable>
                  <Pressable onPress={handleCheckVerified}>
                    <Text style={styles.verifyLink}>인증 완료했어요</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {stores.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>아직 연결된 매장이 없어요</Text>
                <Text style={styles.emptySubtitle}>
                  이미 운영 중인 가게가 있다면 전화번호로 연결하고,{'\n'}
                  처음이라면 새 가게를 등록해보세요.
                </Text>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => setClaimVisible(true)}>
                  <Text style={styles.primaryBtnText}>전화번호로 기존 가게 연결</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={handleAddStore}>
                  <Text style={styles.secondaryBtnText}>새 가게 등록</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.slotRow}>
                  <Text style={styles.slotText}>
                    스토어 {slot.current}/{slot.limit}
                  </Text>
                  <Pressable onPress={() => setClaimVisible(true)}>
                    <Text style={styles.claimLink}>기존 가게 연결</Text>
                  </Pressable>
                </View>

                {stores.map(store => (
                  <Pressable
                    key={store.storeCode}
                    style={styles.storeCard}
                    onPress={() => handleSelectStore(store)}>
                    <View style={{flex: 1}}>
                      <Text style={styles.storeName}>{store.name}</Text>
                      <Text style={styles.storeCode}>코드 {store.storeCode}</Text>
                    </View>
                    <ShortRightArrowIcon width={20} height={20} />
                  </Pressable>
                ))}

                <Pressable style={styles.addBtn} onPress={handleAddStore}>
                  <Text style={styles.addBtnText}>+ 새 스토어 추가</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}

        {/* 기존 가게 연결 모달 */}
        <Modal
          animationType="fade"
          transparent
          visible={claimVisible}
          onRequestClose={() => setClaimVisible(false)}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setClaimVisible(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>기존 가게 연결</Text>
              <Text style={styles.modalSubtitle}>
                가게 등록 시 입력한 점주 연락처를 입력하면{'\n'}해당 가게가 계정에 연결돼요.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="01012345678"
                placeholderTextColor={theme.color.texticon.onNormal.lowemp}
                keyboardType="phone-pad"
              />
              <Pressable
                style={({pressed}) => [
                  styles.primaryBtn,
                  {opacity: claiming || pressed ? 0.7 : 1, marginTop: 4},
                ]}
                onPress={handleClaim}
                disabled={claiming}>
                <Text style={styles.primaryBtnText}>
                  {claiming ? '연결 중...' : '연결하기'}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.surface.normal.container10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.color.surface.normal.bg1,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.gray[200],
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: theme.font.semibold,
    color: theme.color.texticon.onNormal.highestemp,
  },
  headerEmail: {
    fontSize: 13,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.lowemp,
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.midemp,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  verifyBanner: {
    backgroundColor: theme.palette.blue[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.blue[100],
    padding: 14,
    gap: 8,
  },
  verifyText: {
    fontSize: 13,
    fontFamily: theme.font.medium,
    color: theme.palette.blue[700],
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 16,
  },
  verifyLink: {
    fontSize: 13,
    fontFamily: theme.font.semibold,
    color: theme.color.surface.brand.primary,
  },
  emptyBox: {
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.palette.gray[200],
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: theme.font.semibold,
    color: theme.color.texticon.onNormal.highestemp,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.midemp,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  slotText: {
    fontSize: 14,
    fontFamily: theme.font.semibold,
    color: theme.color.texticon.onNormal.midemp,
  },
  claimLink: {
    fontSize: 13,
    fontFamily: theme.font.medium,
    color: theme.color.surface.brand.primary,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.palette.gray[200],
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  storeName: {
    fontSize: 18,
    fontFamily: theme.font.semibold,
    color: theme.color.texticon.onNormal.highestemp,
  },
  storeCode: {
    fontSize: 13,
    fontFamily: 'SFUIDisplay-Regular',
    color: theme.color.texticon.onNormal.lowemp,
    marginTop: 4,
    letterSpacing: 1,
  },
  addBtn: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.gray[200],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.surface.normal.bg1,
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 15,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.midemp,
  },
  primaryBtn: {
    height: 52,
    width: '100%',
    backgroundColor: theme.color.surface.brand.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: theme.font.semibold,
    color: theme.color.etc.absolute.white,
  },
  secondaryBtn: {
    height: 52,
    width: '100%',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.highemp,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: theme.font.semibold,
    color: theme.color.texticon.onNormal.highestemp,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.midemp,
    lineHeight: 21,
  },
  modalInput: {
    height: 54,
    backgroundColor: theme.color.surface.normal.container10,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.highestemp,
  },
});

export default SwitcherScreen;
