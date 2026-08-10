import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {BottomSheetModal} from '@gorhom/bottom-sheet';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {signOutOwner} from '../../services/auth';
import {
  SettingIcon,
  GoogleIcon,
  AppleIcon,
  RightChevronIcon,
} from '../../components/Icons';
import PinPad from '../../components/PinPad';
import StoreModeSheet, {SheetStore} from './StoreModeSheet';

const SwitcherScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    ownerUid,
    ownerEmail,
    ownerProvider,
    setOwnerUid,
    setOwnerEmail,
    setOwnerProvider,
    initStoreCode,
    setStoreName,
    setMode,
    setIsAuthenticated,
    lockDeviceToClient,
  } = useAuth();
  const {getOwnerStores, getOwnerSlotInfo} = useFirestore();

  const uid = ownerUid;

  const [stores, setStores] = useState<{storeCode: string; name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slot, setSlot] = useState<{
    current: number;
    limit: number;
    canAdd: boolean;
  }>({current: 0, limit: 3, canAdd: true});

  // 모드 선택 시트 + 고객모드 고정 PIN 설정
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selectedStore, setSelectedStore] = useState<SheetStore | null>(null);
  const [pinVisible, setPinVisible] = useState(false);

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
    setSelectedStore(store);
    sheetRef.current?.present();
  };

  const enterMode = (mode: 'supervisor' | 'client') => {
    if (!selectedStore) return;
    sheetRef.current?.dismiss();
    initStoreCode(selectedStore.storeCode);
    setStoreName(selectedStore.name);
    setMode(mode);
    setIsAuthenticated(true);
    // RootNavigator가 isAuthenticated=true를 감지해 MainTab으로 전환
  };

  const handleLockClient = () => {
    sheetRef.current?.dismiss();
    // 시트 닫힘 애니메이션과 겹치지 않게 약간 지연 후 PIN 설정
    setTimeout(() => setPinVisible(true), 250);
  };

  const handlePinSet = async (pin: string) => {
    setPinVisible(false);
    if (!selectedStore) return;
    await lockDeviceToClient(selectedStore.storeCode, selectedStore.name, pin);
    initStoreCode(selectedStore.storeCode);
    setStoreName(selectedStore.name);
    setMode('client');
    setIsAuthenticated(true);
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

  const handleLogout = async () => {
    await signOutOwner();
    setOwnerUid(null);
    setOwnerEmail(null);
    setOwnerProvider(null);
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
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
          <View
            style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <Text style={styles.headerTitle}>내 매장</Text>
          </View>
          <Pressable
            style={styles.gearBtn}
            onPress={() => navigation.navigate('AccountSettings')}
            hitSlop={8}>
            <SettingIcon />
          </Pressable>
        </View>

        <View style={styles.profileBox}>
          <View style={styles.profileWrap}>
            <View style={{gap: 6}}>
              {ownerEmail ? (
                <Text style={styles.progileEmail}>{ownerEmail}</Text>
              ) : null}
              {ownerProvider ? (
                <View style={styles.providerRow}>
                  <View style={styles.providerTag}>
                    {ownerProvider === 'apple' ? (
                      <AppleIcon
                        width={14}
                        height={14}
                        color={theme.color.texticon.onNormal.midemp}
                      />
                    ) : (
                      <GoogleIcon width={14} height={14} />
                    )}
                    <Text style={styles.providerText}>
                      {ownerProvider === 'apple' ? 'Apple' : 'Google'}
                    </Text>
                  </View>
                  <Text style={styles.providerLabel}>계정으로 로그인</Text>
                </View>
              ) : null}
            </View>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color={theme.color.surface.brand.primary}
            />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {stores.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>아직 연결된 매장이 없어요</Text>
                <Text style={styles.emptySubtitle}>
                  매장을 등록하면 바로 적립을 시작할 수 있어요.
                </Text>
                <Pressable style={styles.primaryBtn} onPress={handleAddStore}>
                  <Text style={styles.primaryBtnText}>새 매장 등록</Text>
                </Pressable>
                <Text style={styles.emptyHelp}>
                  이미 운영 중인 매장이 있다면 고객센터로 문의해주세요.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.slotRow}>
                  <Text style={styles.slotText}>
                    운영 중인 매장{'  '}
                    <Text style={styles.slotNumber}>{slot.current}</Text>
                    {/* /{slot.limit} */}
                  </Text>
                </View>

                <View style={styles.storeList}>
                  {stores.map(store => (
                    <Pressable
                      key={store.storeCode}
                      style={styles.storeCard}
                      onPress={() => handleSelectStore(store)}>
                      <View style={{flex: 1}}>
                        <Text style={styles.storeName}>{store.name}</Text>
                      </View>
                      <RightChevronIcon />
                    </Pressable>
                  ))}
                </View>

                <View style={styles.btnContainer}>
                  <Pressable style={styles.addBtn} onPress={handleAddStore}>
                    <Text style={styles.addBtnText}>새 매장 추가하기</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        )}

      </SafeAreaView>

      {/* 모드 선택 바텀시트 */}
      <StoreModeSheet
        ref={sheetRef}
        store={selectedStore}
        onSupervisor={() => enterMode('supervisor')}
        onClient={() => enterMode('client')}
        onLockClient={handleLockClient}
      />

      {/* 고객모드 고정 PIN 설정 */}
      <PinPad
        visible={pinVisible}
        mode="set"
        title="사용할 PIN을 설정해주세요"
        subtitle="고객 모드에서 나올 때 이 PIN이 필요해요."
        onSuccess={handlePinSet}
        onCancel={() => setPinVisible(false)}
      />
    </View>
  );
};

// 태블릿에서 콘텐츠가 가로로 꽉 차지 않도록 캡하는 단일 컬럼 폭
const CONTENT_MAX_WIDTH = 480;

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
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: theme.font.medium,
      color: theme.color.texticon.onNormal.highestemp,
    },
    headerEmail: {
      fontSize: 13,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
      marginTop: 2,
    },
    gearBtn: {
      position: 'absolute',
      right: 0,
      margin: 24,
    },
    logoutBtn: {
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: theme.palette.gray[200],
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.color.surface.normal.bg1,
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
      alignItems: 'center',
    },
    profileBox: {
      padding: 20,
      marginTop: 12,
      alignItems: 'center',
    },
    profileWrap: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 14,
      gap: 4,
      paddingHorizontal: 20,
      paddingVertical: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // shadow
      shadowColor: theme.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    progileEmail: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.highestemp,
    },
    providerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    providerTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderStyle: 'solid',
      borderWidth: 0.6,
      borderColor: '#747775',
      borderRadius: 100,
      paddingHorizontal: 7,
      paddingVertical: 5,
    },
    providerText: {
      fontSize: 8,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.highestemp,
    },
    providerLabel: {
      fontSize: 12,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
    },
    emptyBox: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 16,
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
    emptyHelp: {
      fontSize: 13,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 4,
    },
    slotRow: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    slotText: {
      fontSize: 14,
      fontFamily: theme.font.medium,
      color: theme.color.texticon.onNormal.lowemp,
      lineHeight: 24,
    },
    slotNumber: {
      fontSize: 13,
      fontFamily: theme.font.bold,
      color: theme.color.texticon.onNormal.primary,
    },
    storeList: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      gap: 10,
      marginBottom: 20,
    },
    storeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 14,
      paddingVertical: 20,
      paddingHorizontal: 20,
      // shadow
      shadowColor: theme.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    storeName: {
      fontSize: 15,
      fontFamily: theme.font.medium,
      color: theme.color.texticon.onNormal.highestemp,
    },
    btnContainer: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtn: {
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.brand.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    addBtnText: {
      fontSize: 16,
      fontFamily: theme.font.semibold,
      color: theme.color.etc.absolute.white,
      lineHeight: 26,
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
  });

export default SwitcherScreen;
