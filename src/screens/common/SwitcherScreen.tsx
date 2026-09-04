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
  CheckIcon,
} from '../../components/Icons';
import PinPad from '../../components/PinPad';
import StoreModeSheet, {SheetStore} from './StoreModeSheet';
import {
  hasDoneFirstGive,
  hasSeenOnboarding,
  markFirstGiveDone,
} from '../onboarding';
import {shouldAskSurvey, snoozeSurvey} from '../../services/survey';

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
  const {getOwnerStores, getOwnerSlotInfo, getOwnerProfile, hasAnyLog} =
    useFirestore();

  const uid = ownerUid;

  const [stores, setStores] = useState<{storeCode: string; name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slot, setSlot] = useState<{
    current: number;
    limit: number;
    canAdd: boolean;
  }>({current: 0, limit: 3, canAdd: true});

  /**
   * 매장 준비 체크리스트 상태. null이면 아직 판정 전(카드를 안 그린다).
   *
   * 매장은 만들었는데 첫 적립이 0건인 채로 멈추는 게 지금의 이탈 지점이라,
   * 남은 단계가 홈에 계속 보이게 한다. 첫 적립이 확인되면 카드는 영구히 사라진다.
   */
  const [setup, setSetup] = useState<{
    guideSeen: boolean;
    gave: boolean;
  } | null>(null);

  /**
   * 이용 설문을 권할지. 판정 전에는 false라 카드가 깜빡이지 않는다.
   *
   * 문자로 돌린 구글 폼은 회수가 2건이었다. 점주가 링크를 누르지 않기 때문인데,
   * 여기는 매장을 고르러 어차피 들르는 화면이라 같은 질문을 훨씬 많이 회수할 수
   * 있다. 대신 자리는 맨 아래다 — 첫 적립 체크리스트가 위에 떠 있을 수 있고,
   * 지금 해야 할 일을 설문이 가리면 안 된다.
   */
  const [askSurvey, setAskSurvey] = useState(false);

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

    if (list.length === 0) {
      setSetup(null);
      return;
    }
    // 첫 적립 여부는 한 번 참이 되면 뒤집히지 않는다 — 캐시가 있으면 서버를
    // 다시 두드리지 않는다. 없을 때만 매장을 훑고, 하나라도 찾으면 즉시 멈춘다.
    let gave = await hasDoneFirstGive();
    if (!gave) {
      for (const store of list) {
        if (await hasAnyLog(store.storeCode)) {
          gave = true;
          await markFirstGiveDone();
          break;
        }
      }
    }
    setSetup({guideSeen: await hasSeenOnboarding('setup'), gave});

    // 계정 나이는 owners 문서에서 읽는다. 만든 지 며칠 안 된 점주에게 물으면
    // 답할 경험 자체가 없어서, 회수는 늘고 내용은 비게 된다.
    const profile = await getOwnerProfile(uid);
    setAskSurvey(await shouldAskSurvey(uid, profile?.createdAt ?? null));
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
                {!!setup && !setup.gave && (
                  <SetupChecklist
                    guideSeen={setup.guideSeen}
                    styles={styles}
                    theme={theme}
                    onOpenGuide={() =>
                      navigation.navigate('Onboarding', {slot: 'setup'})
                    }
                  />
                )}

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

            {/* 이용 설문. 답했거나 '나중에'를 고르면 사라진다. */}
            {askSurvey && (
              <View style={styles.surveyCard}>
                <Text style={styles.surveyTitle}>30초만 여쭤봐도 될까요?</Text>
                <Text style={styles.surveyBody}>
                  어떻게 쓰고 계신지 알려주시면 다음에 무엇을 만들지 정하는 데
                  그대로 씁니다.
                </Text>
                <View style={styles.surveyActions}>
                  <Pressable
                    style={styles.surveyBtn}
                    onPress={() => navigation.navigate('Survey')}>
                    <Text style={styles.surveyBtnText}>답변하기</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={12}
                    onPress={async () => {
                      // 카드를 먼저 지운다 — 저장이 늦어도 눌린 티가 나야 한다.
                      setAskSurvey(false);
                      if (uid) await snoozeSurvey(uid);
                    }}
                    style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                    <Text style={styles.surveyLater}>나중에</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 의견 보내기.
                점주가 막혔을 때 우리에게 말할 창구가 앱 안에 없어서, 지금은
                스토어 리뷰나 지인 연락으로 이탈한 뒤에야 알게 된다. 계정 허브
                맨 아래에 상주시켜 두 번 터치로 닿게 한다. */}
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackLead}>찾으시는 기능이 없으신가요?</Text>
              <Pressable
                onPress={() => navigation.navigate('Opinion')}
                hitSlop={12}
                style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                <Text style={styles.feedbackLink}>의견 보내기</Text>
              </Pressable>
            </View>
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

/**
 * 매장 준비 체크리스트.
 *
 * 매장을 만든 직후가 이탈 구간이다 — 기기를 한 대만 두면 관리자든 고객이든
 * 한쪽 화면만 켜지고, 그러면 적립이 안 되는데 이유를 알 길이 없어 그대로 멈춘다.
 * 남은 단계를 홈에 계속 남겨두면 "끝내야 할 게 있다"는 신호가 되고, 막힌
 * 사람에겐 사용법으로 가는 길이 항상 열려 있다.
 *
 * ③은 여기서 누를 수 있는 게 아니라 매장에 들어가서 하는 일이라 버튼이 없다.
 */
const SetupChecklist = ({
  guideSeen,
  styles,
  theme,
  onOpenGuide,
}: {
  guideSeen: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  onOpenGuide: () => void;
}) => {
  const steps = [
    {label: '매장 만들기', hint: null, done: true, onPress: null},
    {
      label: '사용법 익히기',
      hint: '적립하려면 고객 화면이 필요해요 — 없으면 QR로 손님 휴대폰을',
      done: guideSeen,
      onPress: onOpenGuide,
    },
    {
      label: '첫 적립 해보기',
      hint: '매장에 들어가 손님에게 첫 적립을 해보세요',
      done: false,
      onPress: null,
    },
  ];

  return (
    <View style={styles.setupCard}>
      <Text style={styles.setupTitle}>매장 준비 3단계</Text>
      <Text style={styles.setupSubtitle}>
        첫 적립까지 마치면 이 카드는 사라져요.
      </Text>

      {steps.map((step, i) => (
        <Pressable
          key={step.label}
          style={({pressed}) => [
            styles.setupRow,
            {opacity: step.onPress && pressed ? 0.6 : 1},
          ]}
          disabled={!step.onPress}
          onPress={step.onPress ?? undefined}>
          {step.done ? (
            <CheckIcon
              width={22}
              height={22}
              color={theme.color.surface.brand.primary}
            />
          ) : (
            <View style={styles.setupNumber}>
              <Text style={styles.setupNumberText}>{i + 1}</Text>
            </View>
          )}

          <View style={styles.setupTexts}>
            <Text style={[styles.setupLabel, step.done && styles.setupLabelDone]}>
              {step.label}
            </Text>
            {!step.done && !!step.hint && (
              <Text style={styles.setupHint}>{step.hint}</Text>
            )}
          </View>

          {!!step.onPress && !step.done && <RightChevronIcon />}
        </Pressable>
      ))}
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
      flexGrow: 1,
      padding: 20,
      gap: 12,
      alignItems: 'center',
    },
    // 매장이 한두 개뿐이라 화면이 텅 비어도 링크는 바닥에 앉아 있게 한다.
    surveyCard: {
      marginTop: 32,
      padding: 20,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface.normal.bg1,
      gap: 8,
    },
    surveyTitle: {
      fontSize: 15,
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.highestemp,
      letterSpacing: -0.3,
    },
    surveyBody: {
      fontSize: 13,
      lineHeight: 20,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.midemp,
      letterSpacing: -0.2,
    },
    surveyActions: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    surveyBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface.brand.primary,
    },
    surveyBtnText: {
      fontSize: 14,
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onBrand.onPrimary,
    },
    surveyLater: {
      fontSize: 14,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.midemp,
    },
    feedbackBox: {
      marginTop: 'auto',
      paddingTop: 32,
      alignItems: 'center',
      gap: 10,
    },
    feedbackLead: {
      fontSize: 14,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
    },
    feedbackLink: {
      fontSize: 14,
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.primary,
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
    setupCard: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 18,
      marginBottom: 8,
      // shadow
      shadowColor: theme.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    setupTitle: {
      fontSize: 16,
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.highestemp,
    },
    setupSubtitle: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 13,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
    },
    setupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },
    setupNumber: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.palette.gray[300],
      justifyContent: 'center',
      alignItems: 'center',
    },
    setupNumberText: {
      fontSize: 12,
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.lowemp,
    },
    setupTexts: {
      flex: 1,
      gap: 2,
    },
    setupLabel: {
      fontSize: 15,
      fontFamily: theme.font.medium,
      color: theme.color.texticon.onNormal.highestemp,
    },
    setupLabelDone: {
      color: theme.color.texticon.onNormal.lowemp,
      textDecorationLine: 'line-through',
    },
    setupHint: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: theme.font.regular,
      color: theme.color.texticon.onNormal.lowemp,
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
