import React, {useCallback, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  useAuth,
  useFirestore,
  useAnalytics,
  useLayoutMode,
  useTheme,
} from '../../hooks';
import type {Theme} from '../../theme';
import {AnalyticsEvent} from '../../analytics/events';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import {
  DownTriangleIcon,
  ExitIcon,
  MagnifierIcon,
  RefreshIcon,
  ShortLeftArrowIcon,
  ShortRightArrowIcon,
  StatisticIcon,
  GearIcon,
  QrIcon,
  SummaryIcon,
  RightChevronIcon,
} from '../../components/Icons';
import dayjs from 'dayjs';
// import {BackgroundDeco} from '../../components/background';
import DetailView from './DetailView';
import GivePointSheet from './GivePointSheet';
import CustomerSearchSheet from './CustomerSearchSheet';
import LogDetailPanel, {type SelectedLogContext} from './LogDetailPanel';
import LogFilterSheet, {FILTER_MAP, type LogFilter} from './LogFilterSheet';
import QrShareModal from './QrShareModal';
import {useMasterDetail} from '../../components';
import {LoadingOverlay} from '../../components/overlay';
import {maskPhone, logActionStyle, logPillText} from './logDisplay';

/**
 * 고객 셀프 조회 QR 노출 여부.
 *
 * QR은 hellopointo.com/s/{매장코드}를 가리키는데, 그 라우트는 아직 배포 전이라
 * 지금 스캔하면 404다. 웹 배포는 보안 규칙 배포 뒤에 온다 — 규칙이 열려 있는
 * 상태로 웹을 띄우면 Firebase 설정이 브라우저에 노출돼 고객 전화번호가 통째로
 * 덤프된다 (SECURITY_PASS.md 배포 순서).
 *
 * ⚠️ 웹의 /s 라우트가 배포되면 이 값을 true로 되돌릴 것. QrShareModal과
 *    진입 버튼은 그대로 살아 있으므로 한 줄만 바꾸면 된다.
 */
const SHOW_SELF_LOOKUP_QR = false;

const MainScreen = ({navigation}: any) => {
  const {isCompact} = useLayoutMode();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(theme, isCompact),
    [theme, isCompact],
  );
  const [showDetail, setShowDetail] = useState(false);
  // Master-detail panel visibility (centralized — see SplitLayout primitive).
  const {showList, showDetailPanel} = useMasterDetail(showDetail);
  const {storeCode, setIsAuthenticated, initStoreCode} = useAuth();
  const {getLogs, getLogsByPhoneNumber} = useFirestore(storeCode);
  const {track} = useAnalytics();
  // 적립/사용 시트를 여는 두 경로 —
  // (1) 세션: 고객이 태블릿에 번호를 입력해 시작한 흐름
  // (2) 수동: 관리자가 고객 검색으로 직접 고른 흐름
  // 수동이 열려 있는 동안엔 세션이 화면을 빼앗지 않고, 수동을 닫을 때 세션 상태가 재평가된다.
  const [sessionPhone, setSessionPhone] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [manualPhone, setManualPhone] = useState<string | null>(null);
  const [date, setDate] = useState(dayjs());
  const [logs, setLogs] = useState<Log[]>([]);
  const [displayLogs, setDisplayLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<SelectedLogContext>({
    selectedLog: null,
    viewMode: 'detail',
    logList: [],
  });
  const [searchContext, setSearchContext] = useState<{
    searchText: string;
    // 활성화  // 비활성화
    status: 'active' | 'inactive';
    filter: LogFilter;
  }>({
    searchText: '',
    status: 'inactive',
    filter: 'all',
  });
  const [searchVisible, setSearchVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  // 모바일 헤더는 QR만 남기고, 통계·매장설정은 요약(⋮) 메뉴 안으로 접었다.
  const [menuVisible, setMenuVisible] = useState(false);

  const givePhone = manualPhone ?? sessionPhone;
  const giveVisible = manualPhone !== null || sessionActive;

  // 화면에 실제로 그려지는 목록. 타입 필터(displayLogs) 위에 번호 검색까지 걸린 결과다.
  // 요약 숫자와 목록이 같은 배열에서 나와야 둘이 어긋나지 않는다.
  const visibleLogs = useMemo(
    () =>
      displayLogs.filter(log =>
        log.phone_number.startsWith(searchContext.searchText),
      ),
    [displayLogs, searchContext.searchText],
  );

  const counts = useMemo(
    () => ({
      total: visibleLogs.length,
      saved: visibleLogs.filter(log => log.action === 'stamp_saved').length,
      used: visibleLogs.filter(log => log.action === 'stamp_used').length,
    }),
    [visibleLogs],
  );

  const handleLogout = async () => {
    try {
      track(AnalyticsEvent.OWNER_LOGOUT, {
        store_code: storeCode,
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }

    setIsAuthenticated(false);
    initStoreCode(null);
  };

  const handleOpenSearch = () => {
    try {
      track(AnalyticsEvent.CUSTOMER_LOOKUP, {
        store_code: storeCode,
      });
    } catch (error) {
      console.error('Error logging customer lookup:', error);
    }
    setSearchVisible(true);
  };

  /** 검색에서 고객을 고르면 그대로 적립/사용 시트로 넘긴다. */
  const handleSelectCustomer = (phone: string) => {
    setSearchVisible(false);
    // iOS는 모달이 닫히는 도중 새 모달을 띄우면 두 번째가 무시된다.
    // 검색 시트가 사라진 뒤에 적립 시트를 올린다.
    setTimeout(() => setManualPhone(phone), 300);
  };

  const handleStatistics = () => {
    navigation.navigate('Statistics');
  };

  /**
   * 요약 메뉴에서 화면을 열 때는 메뉴를 먼저 닫는다.
   * 모달이 떠 있는 채로 navigate하면 새 화면 위에 메뉴가 남는다.
   */
  const handleMenuNavigate = (run: () => void) => {
    setMenuVisible(false);
    setTimeout(run, 200);
  };

  /** 필터 시트 선택 — 목록은 이미 받아온 logs에서 걸러낸다 (재조회 없음). */
  const applyFilter = (filter: LogFilter) => {
    setSearchContext({...searchContext, filter});
    setDisplayLogs(
      filter === 'all'
        ? logs
        : logs.filter(log => log.action === `stamp_${filter}`),
    );
    setFilterModalVisible(false);
  };

  const handleDateMinusChange = (value: number) => {
    setDate(date.subtract(value, 'day'));
  };

  const handleDatePlusChange = (value: number) => {
    setDate(date.add(value, 'day'));
  };

  const handleSetToday = async () => {
    setDate(dayjs());
  };

  const handleClickLog = async (log: Log) => {
    const logs = await getLogsByPhoneNumber(log.phone_number);
    setSelectedContext({
      selectedLog: log,
      viewMode: 'detail',
      logList: logs,
    });
    if (isCompact) setShowDetail(true);
  };

  const updateLogs = async () => {
    const dateString = date.format('YYYY-MM-DD');
    setIsLoading(true);
    const logs = await getLogs(dateString);
    if (logs) {
      setLogs(logs);
      setDisplayLogs(logs);
    }
    setIsLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      const fetchLogs = async () => {
        const dateString = date.format('YYYY-MM-DD');
        setIsLoading(true);
        // 일자가 변경되었을 경우에는 100개만 끊어서 최신으로 가져오기
        const logs = await getLogs(dateString);
        if (logs) {
          setLogs(logs);
          setDisplayLogs(logs);
        }
        setIsLoading(false);
      };
      fetchLogs();
    }, [date]),
  );

  useFocusEffect(
    useCallback(() => {
      const db = getFirestore();
      const sessionRef = doc(db, 'sessions', `session_${storeCode}`);

      const unsubscribe = onSnapshot(sessionRef, doc => {
        if (doc.exists) {
          const data = doc.data();
          console.log('Supervisor Main Current data: ', data);
          if (!data) {
            console.log('No data found');
            return;
          }

          // 세션 상태는 수동 시트가 열려 있어도 계속 추적한다.
          // 화면을 누가 차지할지는 givePhone/giveVisible이 판단하므로,
          // 수동 작업 중엔 가려져 있다가 닫는 순간 대기 중인 고객으로 이어진다.
          setSessionPhone(data.phone);
          setSessionActive(data.phone !== '' && data.mode === 'onboarding');
        }
      });

      return () => unsubscribe();
    }, [storeCode]),
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <LoadingOverlay isLoading={isLoading} />
        <View style={styles.innerContainer}>
          <View
            style={[
              styles.headerBar,
              {
                paddingVertical: isCompact ? 12 : 16,
                paddingHorizontal: isCompact ? 16 : 24,
              },
            ]}>
            {/* 좌: 나가기 = 로그아웃 (기존 "내 매장") */}
            <Pressable
              style={styles.headerExit}
              onPress={handleLogout}
              hitSlop={8}>
              <ExitIcon />
              {!isCompact && (
                <Text
                  style={[styles.headerExitText, isCompact && {fontSize: 15}]}>
                  나가기
                </Text>
              )}
            </Pressable>

            {/* 중앙: 화면 타이틀 */}
            <Text
              style={[styles.headerTitle, isCompact && {fontSize: 17}]}
              pointerEvents="none">
              적립내역
            </Text>

            {/* 우: (태블릿)고객검색 · QR · 통계 · 설정 / (모바일)QR · 요약 메뉴 */}
            <View style={[styles.headerSide, {gap: isCompact ? 6 : 12}]}>
              {/* 모바일은 아래 하단 CTA가 같은 역할을 하므로 헤더에 중복하지 않는다. */}
              {!isCompact && (
                <Pressable
                  style={styles.headerIconBtn}
                  onPress={handleOpenSearch}
                  hitSlop={8}>
                  <MagnifierIcon
                    width={24}
                    height={24}
                    color={theme.color.texticon.onNormal.highestemp}
                  />
                </Pressable>
              )}
              {/* QR은 매장에서 가장 자주 쓰는 동작이라 모바일에서도 헤더에 남긴다. */}
              {SHOW_SELF_LOOKUP_QR && (
                <Pressable
                  style={styles.headerIconBtn}
                  onPress={() => setQrVisible(true)}
                  hitSlop={8}>
                  <QrIcon
                    width={isCompact ? 20 : 24}
                    height={isCompact ? 20 : 24}
                    color={theme.color.texticon.onNormal.highestemp}
                  />
                </Pressable>
              )}
              {isCompact ? (
                <Pressable
                  style={styles.headerIconBtn}
                  onPress={() => setMenuVisible(true)}
                  hitSlop={8}>
                  <SummaryIcon
                    width={20}
                    height={20}
                    color={theme.color.texticon.onNormal.highestemp}
                  />
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={styles.headerIconBtn}
                    onPress={handleStatistics}
                    hitSlop={8}>
                    <StatisticIcon
                      width={23}
                      height={23}
                      color={theme.color.texticon.onNormal.highestemp}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.headerIconBtn}
                    onPress={() => navigation.navigate('StoreSettings')}
                    hitSlop={8}>
                    <GearIcon
                      width={24}
                      height={24}
                      color={theme.color.texticon.onNormal.highestemp}
                    />
                  </Pressable>
                </>
              )}
            </View>
          </View>
          <View
            style={[
              styles.flexRowBox,
              {
                flex: 1,
              },
            ]}>
            {showList && (
              <View
                style={[
                  styles.innerContainer,
                  {
                    backgroundColor: theme.color.surface.normal.bg1,
                    paddingHorizontal: 24,
                    paddingTop: 32,
                  },
                ]}>
                {searchContext.status === 'active' ? (
                  <View
                    style={[
                      styles.flexRowBox,
                      {
                        justifyContent: 'space-between',
                        paddingHorizontal: 12,
                        marginBottom: isCompact ? 8 : 32,
                        gap: 16,
                      },
                    ]}>
                    <Pressable
                      style={styles.filterBox}
                      onPress={() => {
                        setFilterModalVisible(true);
                      }}>
                      <Text style={styles.filterBoxText}>
                        {FILTER_MAP[searchContext.filter]}
                      </Text>
                      <DownTriangleIcon />
                    </Pressable>
                    <TextInput
                      value={searchContext.searchText}
                      onChangeText={text => {
                        setSearchContext({
                          ...searchContext,
                          searchText: text,
                        });
                      }}
                      style={[
                        styles.searchInput,
                        {
                          flex: 1,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => {
                        setSearchContext({
                          filter: 'all',
                          searchText: '',
                          status: 'inactive',
                        });
                        setDisplayLogs(logs);
                      }}
                      style={{
                        width: 56,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                      <Text style={styles.filterBoxText}>취소</Text>
                    </Pressable>
                  </View>
                ) : isCompact ? (
                  <View style={styles.mDateRow}>
                    <View style={styles.mDateLeft}>
                      <Text style={styles.mBigDate}>
                        {date.format('M월 D일')}
                      </Text>
                    </View>
                    <View style={styles.mDateNav}>
                      <Pressable
                        style={styles.mRoundBtn}
                        onPress={() =>
                          setSearchContext({
                            ...searchContext,
                            status: 'active',
                          })
                        }>
                        <MagnifierIcon />
                      </Pressable>
                      <Pressable
                        style={styles.mRoundBtn}
                        onPress={() => handleDateMinusChange(1)}>
                        <ShortLeftArrowIcon width={20} height={20} />
                      </Pressable>
                      <Pressable
                        style={styles.mRoundBtn}
                        onPress={() => handleDatePlusChange(1)}>
                        <ShortRightArrowIcon width={20} height={20} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.flexRowBox,
                      {
                        justifyContent: 'space-between',
                        marginBottom: 32,
                        gap:
                          date.format('YYYY-MM-DD') !==
                          dayjs().format('YYYY-MM-DD')
                            ? 10
                            : 0,
                      },
                    ]}>
                    <View style={[styles.flexRowBox, {gap: 12}]}>
                      <View style={[styles.flexRowBox, {gap: 18}]}>
                        {date.format('YYYY-MM-DD') !==
                          dayjs().format('YYYY-MM-DD') && (
                          <Pressable
                            onPress={handleSetToday}
                            style={[
                              styles.flexRowBox,
                              {
                                backgroundColor:
                                  theme.color.surface.normal.container10,
                                width: 70,
                                height: 32,
                                borderRadius: 6,
                                gap: 4,
                              },
                            ]}>
                            <RefreshIcon width={16} height={16} />
                            <Text
                              style={{
                                fontSize: 16,
                                lineHeight: 26,
                                letterSpacing: -1,
                                fontFamily: theme.font.medium,
                                color: theme.color.texticon.onNormal.highemp,
                              }}>
                              오늘
                            </Text>
                          </Pressable>
                        )}
                        <View style={[styles.flexRowBox, {gap: 32}]}>
                          <Pressable
                            style={styles.mRoundBtn}
                            onPress={() => handleDateMinusChange(1)}>
                            <ShortLeftArrowIcon width={20} height={20} />
                          </Pressable>
                          <Text
                            style={{
                              fontFamily: theme.font.bold,
                              fontSize: 20,
                              lineHeight: 28,
                              letterSpacing: -1,
                            }}>
                            {date.format('M월 D일')}
                          </Text>
                          <Pressable
                            style={styles.mRoundBtn}
                            onPress={() => handleDatePlusChange(1)}>
                            <ShortRightArrowIcon width={20} height={20} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      style={[styles.searchInput, {flex: 1, maxWidth: 180}]}
                      onPress={() => {
                        setSearchContext({
                          ...searchContext,
                          status: 'active',
                        });
                      }}>
                      <MagnifierIcon width={16} height={16} />
                      <Text
                        style={[
                          styles.searchInputText,
                          {
                            color: theme.palette.gray[400],
                          },
                        ]}>
                        고객번호 뒤 4자리 검색
                      </Text>
                    </Pressable>
                  </View>
                )}
                <View
                  style={[
                    styles.flexRowBox,
                    {
                      justifyContent: 'flex-end',
                      gap: isCompact ? 6 : 12,
                    },
                  ]}>
                  <View style={[styles.flexRowBox, {gap: 4}]}>
                    <Text style={[styles.titleSideText]}>총</Text>
                    <Text
                      style={[
                        styles.titleText,
                        {
                          color: theme.color.texticon.onNormal.midemp,
                        },
                      ]}>
                      {counts.total}건
                    </Text>
                  </View>
                  <View style={styles.separateLine} />
                  {/* 색은 pill 체계를 따른다 — 적립=주황 / 사용=블루 (logDisplay.ts) */}
                  <Text
                    style={[
                      styles.titleText,
                      {color: theme.palette.orange[600]},
                    ]}>
                    적립 {counts.saved}건
                  </Text>
                  <Text
                    style={[
                      styles.titleText,
                      {color: theme.color.texticon.onNormal.primary},
                    ]}>
                    사용 {counts.used}건
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                  }}>
                  {/* 테이블 헤더 — 폭에 상관없이 같은 3컬럼.
                      컬럼 폭은 아래 행과 같은 스타일을 공유해서 어긋날 수 없다. */}
                  <View style={styles.tableHead}>
                    <Text style={[styles.headCell, styles.colAction]}>
                      적립정보
                    </Text>
                    <Text style={[styles.headCell, styles.colMember]}>
                      회원정보
                    </Text>
                    {/* 목록이 하루치로 고정돼 있어 날짜는 상단 날짜 이동에만 둔다. */}
                    <Text style={[styles.headCell, styles.colTime]}>시간</Text>
                  </View>
                  <ScrollView style={styles.scrollView}>
                    {visibleLogs.length > 0 ? (
                      visibleLogs.map((statistic, index) => {
                        const st = logActionStyle(statistic.action, theme);
                        return (
                          <Pressable
                            key={index}
                            style={styles.tableRow}
                            onPress={() => handleClickLog(statistic)}>
                            <View
                              style={[
                                styles.rowPill,
                                styles.colAction,
                                {backgroundColor: st.bg},
                              ]}>
                              <Text
                                style={[styles.rowPillText, {color: st.fg}]}>
                                {logPillText(statistic, st.label)}
                              </Text>
                            </View>
                            <Text
                              numberOfLines={1}
                              style={[styles.rowPhone, styles.colMember]}>
                              {maskPhone(statistic.phone_number)}
                            </Text>
                            <Text style={[styles.rowTime, styles.colTime]}>
                              {dayjs(statistic.timestamp).format('HH:mm')}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                          적립내역이 없습니다.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
                {isCompact &&
                  date.format('YYYY-MM-DD') !==
                    dayjs().format('YYYY-MM-DD') && (
                    <Pressable
                      style={styles.mTodayFab}
                      onPress={handleSetToday}>
                      <RefreshIcon width={16} height={16} />
                      <Text style={styles.mTodayFabText}>오늘로 돌아가기</Text>
                    </Pressable>
                  )}
              </View>
            )}
            {showDetailPanel && (
              <LogDetailPanel
                context={selectedContext}
                onContextChange={setSelectedContext}
                isCompact={isCompact}
                onBack={() => setShowDetail(false)}
              />
            )}
          </View>

          {/* 모바일 주 액션 — 태블릿이 없는 매장에선 이 경로가 유일한 적립 수단이다.
              상세 패널이 떠 있을 땐 감춘다. */}
          {isCompact && showList && (
            <View style={styles.bottomCtaWrap}>
              <Pressable
                style={({pressed}) => [
                  styles.bottomCta,
                  pressed && {opacity: 0.85},
                ]}
                onPress={handleOpenSearch}>
                <MagnifierIcon
                  width={20}
                  height={20}
                  color={theme.color.etc.absolute.white}
                />
                <Text style={styles.bottomCtaText}>고객 찾아 적립</Text>
              </Pressable>
            </View>
          )}
        </View>
        {/* 모바일 요약 메뉴 — 헤더 ⋮ 아래에 붙는 컨텍스트 박스.
            헤더 높이(paddingVertical 12 × 2 + 아이콘 36)만큼 내려서 버튼과 이어 보이게 한다. */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setMenuVisible(false)}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}>
            {/* 박스 안쪽 빈 곳을 눌러도 닫히지 않도록 터치를 여기서 흡수한다. */}
            <Pressable
              style={[styles.menuBox, {top: insets.top + 60 + 6}]}
              onPress={() => {}}>
              <Pressable
                style={({pressed}) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => handleMenuNavigate(handleStatistics)}>
                <StatisticIcon
                  width={19}
                  height={19}
                  color={theme.color.texticon.onNormal.highestemp}
                />
                <Text style={styles.menuItemText}>통계</Text>
                <RightChevronIcon
                  width={16}
                  height={16}
                  color={theme.color.texticon.onNormal.lowemp}
                />
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={({pressed}) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() =>
                  handleMenuNavigate(() => navigation.navigate('StoreSettings'))
                }>
                <GearIcon
                  width={20}
                  height={20}
                  color={theme.color.texticon.onNormal.highestemp}
                />
                <Text style={styles.menuItemText}>매장 설정</Text>
                <RightChevronIcon
                  width={16}
                  height={16}
                  color={theme.color.texticon.onNormal.lowemp}
                />
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
        <QrShareModal
          visible={qrVisible}
          storeCode={storeCode}
          onClose={() => setQrVisible(false)}
        />
        <LogFilterSheet
          visible={filterModalVisible}
          selected={searchContext.filter}
          onSelect={applyFilter}
          onClose={() => setFilterModalVisible(false)}
        />

        <CustomerSearchSheet
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelect={handleSelectCustomer}
        />

        {isCompact ? (
          <GivePointSheet
            visible={giveVisible}
            phoneNumber={givePhone}
            updateLogs={updateLogs}
            manual={manualPhone !== null}
            onClose={() => setManualPhone(null)}
          />
        ) : (
          <Modal
            animationType="slide"
            transparent={true}
            visible={giveVisible}
            presentationStyle="overFullScreen" // or "pageSheet" 등 시도
            supportedOrientations={['portrait', 'landscape']}>
            <DetailView
              navigation={navigation}
              phoneNumber={givePhone}
              manual={manualPhone !== null}
              onClose={() => setManualPhone(null)}
              updateLogs={updateLogs}
            />
          </Modal>
        )}
        {/* <BackgroundDeco backgroundColor="#FFFAE3" /> */}
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme, isCompact: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // backgroundColor: '#FFFAE3',
    },
    // 리뉴얼 CTA 규격 (NumberInputScreen과 동일: h56 / r16 / brand primary)
    bottomCtaWrap: {
      backgroundColor: theme.color.surface.normal.bg1,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 12,
    },
    bottomCta: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.color.surface.brand.primary,
    },
    bottomCtaText: {
      fontFamily: theme.font.semibold,
      fontSize: 16,
      letterSpacing: -0.5,
      color: theme.color.etc.absolute.white,
    },
    backgroundStyle: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    flexRowBox: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.surface.normal.bg1,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.gray[100],
    },
    headerExit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      zIndex: 1,
    },
    headerExitText: {
      fontFamily: theme.font.medium,
      fontSize: 17,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    headerTitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: theme.font.semibold,
      fontSize: 19,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    headerSide: {
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 1,
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ─── 모바일 요약(⋮) 메뉴 ───
    menuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    menuBox: {
      position: 'absolute',
      right: 12,
      minWidth: 200,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 16,
      paddingVertical: 6,
      shadowColor: theme.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 12,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      height: 52,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    menuItemPressed: {
      backgroundColor: theme.color.surface.normal.container10,
    },
    menuItemText: {
      flex: 1,
      fontFamily: theme.font.medium,
      fontSize: 16,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    menuDivider: {
      height: 1,
      marginHorizontal: 16,
      backgroundColor: theme.palette.gray[100],
    },
    // ─── 모바일 적립내역 (신규 시안) ───
    mDateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    mDateLeft: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
    mBigDate: {
      fontFamily: theme.font.bold,
      fontSize: 26,
      letterSpacing: -1,
      color: theme.color.texticon.onNormal.highestemp,
    },
    mDateCount: {
      fontFamily: theme.font.regular,
      fontSize: 13,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.midemp,
    },
    mDateNav: {flexDirection: 'row', alignItems: 'center', gap: 8},
    mRoundBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.color.surface.normal.container10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ─── 적립내역 테이블 (모바일·태블릿 공용) ───
    // 헤더와 행이 col* 스타일을 같이 쓴다. 한쪽만 고치면 어긋나므로 항상 여기서 바꾼다.
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 20 : 28,
      height: 30,
      marginBottom: isCompact ? 4 : 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.gray[200],
    },
    headCell: {
      fontFamily: theme.font.regular,
      fontSize: isCompact ? 13 : 14,
      lineHeight: 24,
      letterSpacing: -1,
      color: theme.color.texticon.onNormal.lowemp,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 20 : 28,
      paddingVertical: isCompact ? 10 : 8,
    },
    colAction: {width: isCompact ? 58 : 62},
    colMember: {flex: 1},
    // 하루치 목록이라 HH:mm이면 충분하다. tabular-nums로 폭이 흔들리지 않게 고정.
    colTime: {width: isCompact ? 44 : 56, textAlign: 'right'},
    rowPill: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 999,
      height: isCompact ? 28 : 32,
    },
    rowPillText: {
      fontFamily: theme.font.semibold,
      fontSize: isCompact ? 13 : 14,
      lineHeight: isCompact ? 20 : 24,
      letterSpacing: -0.5,
    },
    rowPhone: {
      fontFamily: theme.font.medium,
      fontSize: isCompact ? 15 : 14,
      lineHeight: 24,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      color: theme.color.texticon.onNormal.highestemp,
    },
    rowTime: {
      fontFamily: theme.font.regular,
      fontSize: isCompact ? 13 : 14,
      lineHeight: 24,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
      color: theme.color.texticon.onNormal.lowemp,
    },
    emptyBox: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 250,
    },
    mTodayFab: {
      position: 'absolute',
      bottom: 20,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 12,
      shadowColor: theme.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    mTodayFabText: {
      fontFamily: theme.font.medium,
      fontSize: 15,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highemp,
    },
    titleText: {
      fontFamily: theme.font.semibold,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
    },
    titleSideText: {
      fontFamily: theme.font.regular,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
      color: theme.color.texticon.onNormal.lowemp,
    },
    emptyText: {
      color: theme.color.texticon.onNormal.midemp,
      fontFamily: theme.font.regular,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: -1,
    },
    searchInput: {
      width: 180,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: theme.color.surface.normal.bg1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.palette.gray[200],
      gap: 8,
    },
    searchInputText: {
      fontFamily: theme.font.regular,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
      color: theme.color.texticon.onNormal.highestemp,
    },
    filterBox: {
      width: 100,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.palette.gray[200],
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    filterBoxText: {
      fontFamily: theme.font.regular,
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -1,
      color: theme.color.texticon.onNormal.highestemp,
    },
    separateLine: {
      width: 1,
      height: 14,
      marginVertical: 16,
      backgroundColor: theme.palette.gray[200],
    },
  });

export default MainScreen;
