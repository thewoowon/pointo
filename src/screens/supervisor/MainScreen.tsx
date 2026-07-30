import React, {useCallback, useMemo, useState} from 'react';
import {
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
  LeftArrowIcon,
  MagnifierIcon,
  ProfileIcon,
  RefreshIcon,
  ShortLeftArrowIcon,
  ShortRightArrowIcon,
  StatisticIcon,
  GearIcon,
} from '../../components/Icons';
import dayjs from 'dayjs';
// import {BackgroundDeco} from '../../components/background';
import DetailView from './DetailView';
import {useMasterDetail} from '../../components';
import {LoadingOverlay} from '../../components/overlay';

const FILTER_LIST: {
  label: string;
  value: 'all' | 'used' | 'saved';
}[] = [
  {label: '전체', value: 'all'},
  {label: '사용내역', value: 'used'},
  {label: '적립내역', value: 'saved'},
];

const FILTER_MAP: {
  [key: string]: string;
} = {
  all: '전체',
  used: '사용내역',
  saved: '적립내역',
};

const MainScreen = ({navigation, route}: any) => {
  const {isCompact} = useLayoutMode();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showDetail, setShowDetail] = useState(false);
  // Master-detail panel visibility (centralized — see SplitLayout primitive).
  const {showList, showDetailPanel} = useMasterDetail(showDetail);
  const {storeCode, storeName, setIsAuthenticated, initStoreCode} = useAuth();
  const {enterNumber, getLogs, getLogsAfter, getLogsByPhoneNumber} =
    useFirestore(storeCode);
  const {track} = useAnalytics();
  const [modalVisible, setModalVisible] = useState(false);
  const [date, setDate] = useState(dayjs());
  const [logs, setLogs] = useState<Log[]>([]);
  const [displayLogs, setDisplayLogs] = useState<Log[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<Date | null>(null);
  const [selectedContext, setSelectedContext] = useState<{
    selectedLog: Log | null;
    viewMode: 'detail' | 'list';
    logList: Log[];
  }>({
    selectedLog: null,
    viewMode: 'detail',
    logList: [],
  });
  const [searchContext, setSearchContext] = useState<{
    searchText: string;
    // 활성화  // 비활성화
    status: 'active' | 'inactive';
    filter: 'all' | 'used' | 'saved';
  }>({
    searchText: '',
    status: 'inactive',
    filter: 'all',
  });
  const [customerSearchVisible, setCustomerSearchVisible] = useState(false);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

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

  const handleSearch = () => {
    setCustomerSearchInput('');
    setCustomerSearchVisible(true);
  };

  const handleCustomerSearch = async () => {
    if (customerSearchInput.length < 10) {
      Alert.alert('전화번호를 입력해주세요', '10자리 번호를 입력해주세요.');
      return;
    }
    try {
      track(AnalyticsEvent.CUSTOMER_LOOKUP, {
        store_code: storeCode,
      });
    } catch (error) {
      console.error('Error logging customer lookup:', error);
    }
    setCustomerSearchVisible(false);
    setIsLoading(true);
    const result = await getLogsByPhoneNumber(customerSearchInput);
    setIsLoading(false);
    if (result.length === 0) {
      Alert.alert('조회 결과 없음', '해당 번호의 적립내역이 없습니다.');
      return;
    }
    setSelectedContext({
      selectedLog: result[0],
      viewMode: 'list',
      logList: result,
    });
  };

  const onCustomerSearchKeyPress = (val: number | string) => {
    if (typeof val === 'number') {
      if (customerSearchInput.length >= 11) return;
      setCustomerSearchInput(prev => prev + val);
    } else if (val === 'del') {
      setCustomerSearchInput(prev => prev.slice(0, -1));
    }
  };

  const handleStatistics = () => {
    navigation.navigate('Statistics');
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
      setLastTimestamp(logs[0].timestamp); // 가장 최신 로그의 timestamp로 갱신
    }
    setIsLoading(false);
  };

  const updateLogsAfter = async () => {
    const dateString = date.format('YYYY-MM-DD');

    // 마지막 로그 시간 이후의 로그만 가져오기
    setIsLoading(true);
    const newLogs = await getLogsAfter(dateString, lastTimestamp || undefined);
    console.log('newLogs', newLogs);
    if (newLogs && newLogs.length > 0) {
      setLogs(prev => [...newLogs, ...prev]); // 시간순으로 정렬되어 있다면 prepend
      setLastTimestamp(newLogs[0].timestamp); // 가장 최신 로그의 timestamp로 갱신
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

          setPhoneNumber(data.phone);
          if (data.phone !== '' && data.mode === 'onboarding') {
            setModalVisible(true);
          } else {
            //
            setModalVisible(false);
          }
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
              styles.flexRowBox,
              {
                justifyContent: 'space-between',
                backgroundColor: theme.color.texticon.onNormal.highemp,
                paddingVertical: isCompact ? 10 : 18,
                paddingHorizontal: isCompact ? 12 : 24,
              },
            ]}>
            {storeName ? (
              <Text style={{color: theme.color.surface.normal.bg1, fontSize: isCompact ? 13 : 16, fontFamily: theme.font.semibold}}>{storeName}</Text>
            ) : <View />}
            <View style={[styles.flexRowBox, {gap: isCompact ? 6 : 8}]}>
              <Pressable style={[styles.button, isCompact && styles.buttonCompact]} onPress={() => navigation.navigate('StoreSettings')}>
                <GearIcon width={isCompact ? 16 : 22} height={isCompact ? 16 : 22} />
                {!isCompact && <Text style={styles.buttonText}>설정</Text>}
              </Pressable>
              <Pressable style={[styles.button, isCompact && styles.buttonCompact]} onPress={handleStatistics}>
                <StatisticIcon width={isCompact ? 18 : 24} height={isCompact ? 18 : 24} />
                {!isCompact && <Text style={styles.buttonText}>대시보드</Text>}
              </Pressable>
              <Pressable style={[styles.button, isCompact && styles.buttonCompact]} onPress={handleLogout}>
                {!isCompact && <Text style={styles.buttonText}>내 매장</Text>}
                <ProfileIcon width={isCompact ? 16 : 20} height={isCompact ? 16 : 20} />
              </Pressable>
            </View>
          </View>
          <View
            style={[
              styles.flexRowBox,
              {
                flex: 1,
              },
            ]}>
            {showList && <View
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
                      paddingHorizontal: 16,
                      marginBottom: 32,
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
                    }}>
                    <Text style={styles.filterBoxText}>취소</Text>
                  </Pressable>
                </View>
              ) : (
                <View
                  style={[
                    styles.flexRowBox,
                    {
                      justifyContent: 'space-between',
                      marginBottom: isCompact ? 16 : 32,
                      gap:
                        date.format('YYYY-MM-DD') !==
                        dayjs().format('YYYY-MM-DD')
                          ? 10
                          : 0,
                      flexWrap: isCompact ? 'wrap' : undefined,
                    },
                  ]}>
                  <View
                    style={[
                      styles.flexRowBox,
                      {
                        gap: isCompact ? 8 : 12,
                      },
                    ]}>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          gap: isCompact ? 6 : 12,
                        },
                      ]}>
                      <Text style={[styles.titleText, isCompact && {fontSize: 18}]}>적립내역</Text>
                      <Text style={[styles.titleSideText, isCompact && {fontSize: 12}]}>{logs.length}건</Text>
                    </View>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          gap: isCompact ? 8 : 18,
                        },
                      ]}>
                      {date.format('YYYY-MM-DD') !==
                        dayjs().format('YYYY-MM-DD') && (
                        <Pressable
                          onPress={handleSetToday}
                          style={[
                            styles.flexRowBox,
                            {
                              backgroundColor: theme.color.surface.normal.container10,
                              width: isCompact ? 56 : 70,
                              height: isCompact ? 28 : 32,
                              borderRadius: 6,
                              gap: 4,
                            },
                          ]}>
                          <RefreshIcon width={isCompact ? 12 : 16} height={isCompact ? 12 : 16} />
                          <Text
                            style={{
                              fontSize: isCompact ? 12 : 16,
                              lineHeight: isCompact ? 18 : 26,
                              letterSpacing: -1,
                              fontFamily: theme.font.medium,
                              color: theme.color.texticon.onNormal.highemp,
                            }}>
                            오늘
                          </Text>
                        </Pressable>
                      )}
                      <View
                        style={[
                          styles.flexRowBox,
                          {
                            gap: isCompact ? 6 : 12,
                          },
                        ]}>
                        <Pressable onPress={() => handleDateMinusChange(1)}>
                          <ShortLeftArrowIcon width={isCompact ? 18 : 24} height={isCompact ? 18 : 24} />
                        </Pressable>
                        <Text
                          style={{
                            fontFamily: theme.font.medium,
                            fontSize: isCompact ? 13 : 16,
                            lineHeight: isCompact ? 20 : 26,
                            letterSpacing: -1,
                          }}>
                          {date.format('MM월 DD일')}
                        </Text>
                        <Pressable onPress={() => handleDatePlusChange(1)}>
                          <ShortRightArrowIcon width={isCompact ? 18 : 24} height={isCompact ? 18 : 24} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    style={[
                      styles.searchInput,
                      {flex: 1, maxWidth: 200, gap: 4},
                    ]}
                    onPress={() => {
                      setSearchContext({
                        ...searchContext,
                        status: 'active',
                      });
                    }}>
                    <Text
                      style={[
                        styles.searchInputText,
                        {
                          color: theme.palette.gray[200],
                        },
                      ]}>
                      고객번호로 내역검색
                    </Text>
                    <MagnifierIcon />
                  </Pressable>
                </View>
              )}
              <View
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                }}>
                {/* 테이블 헤더 — tablet only */}
                {!isCompact && (
                <View
                  style={[
                    styles.flexRowBox,
                    {
                      justifyContent: 'space-between',
                      height: 30,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.palette.gray[200],
                      gap: 16,
                      marginBottom: 16,
                    },
                  ]}>
                  <View
                    style={[
                      styles.flexRowBox,
                      {justifyContent: 'flex-start', gap: 16, flex: 1},
                    ]}>
                    <Text
                      style={{
                        fontFamily: theme.font.medium,
                        fontSize: 14,
                        lineHeight: 24,
                        letterSpacing: -1,
                        width: 62,
                        color: theme.color.texticon.onNormal.midemp,
                      }}>
                      적립정보
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.font.medium,
                        fontSize: 14,
                        lineHeight: 24,
                        letterSpacing: -1,
                        width: 100,
                        color: theme.color.texticon.onNormal.midemp,
                      }}>
                      회원정보
                    </Text>
                    <Text
                      style={{
                        fontFamily: theme.font.medium,
                        fontSize: 14,
                        lineHeight: 24,
                        letterSpacing: -1,
                        flex: 1,
                        color: theme.color.texticon.onNormal.midemp,
                      }}>
                      비고
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: theme.font.medium,
                      fontSize: 14,
                      lineHeight: 24,
                      letterSpacing: -1,
                      width: 120,
                      color: theme.color.texticon.onNormal.midemp,
                    }}>
                    일시
                  </Text>
                </View>
                )}
                <ScrollView style={styles.scrollView}>
                  <View
                    style={{display: 'flex', flexDirection: 'column', gap: isCompact ? 8 : 16}}>
                    {displayLogs.length > 0 ? (
                      displayLogs
                        .filter(log =>
                          log.phone_number.startsWith(searchContext.searchText),
                        )
                        .map((statistic, index) =>
                          isCompact ? (
                          <Pressable
                            key={index}
                            style={{
                              backgroundColor: theme.color.surface.normal.container10,
                              borderRadius: 10,
                              padding: 12,
                              gap: 6,
                            }}
                            onPress={() => handleClickLog(statistic)}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                <View
                                  style={{
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: 5,
                                    paddingHorizontal: 8,
                                    height: 26,
                                    backgroundColor:
                                      statistic.action === 'stamp_saved'
                                        ? theme.palette.green[100]
                                        : theme.palette.blue[50],
                                  }}>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontFamily: theme.font.medium,
                                      color:
                                        statistic.action === 'stamp_saved'
                                          ? theme.color.texticon.onNormal.success
                                          : theme.color.texticon.onNormal.primary,
                                    }}>
                                    {statistic.action === 'stamp_saved'
                                      ? '적립'
                                      : '사용'}{' '}
                                    {statistic.stamp}
                                  </Text>
                                </View>
                                <Text
                                  style={{
                                    color: theme.color.texticon.onNormal.highestemp,
                                    fontSize: 13,
                                    fontFamily: theme.font.medium,
                                    letterSpacing: -0.5,
                                  }}>
                                  {statistic.phone_number.replace(
                                    /(\d{3})(\d{4})(\d{4})/,
                                    '$1-$2-$3',
                                  )}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  color: theme.color.texticon.onNormal.midemp,
                                  fontSize: 11,
                                  letterSpacing: -0.5,
                                }}>
                                {dayjs(statistic.timestamp).format('HH:mm')}
                              </Text>
                            </View>
                            {statistic.note ? (
                              <Text
                                style={{
                                  color: theme.color.texticon.onNormal.midemp,
                                  fontSize: 12,
                                  fontFamily: theme.font.light,
                                  letterSpacing: -0.3,
                                }}
                                numberOfLines={1}>
                                {statistic.note}
                              </Text>
                            ) : null}
                          </Pressable>
                          ) : (
                          <Pressable
                            key={index}
                            style={styles.listBox}
                            onPress={() => {
                              handleClickLog(statistic);
                            }}>
                            <View
                              style={[
                                styles.flexRowBox,
                                {
                                  justifyContent: 'flex-start',
                                  gap: 16,
                                  flex: 1,
                                },
                              ]}>
                              <View
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  borderRadius: 6,
                                  width: 62,
                                  height: 32,
                                  backgroundColor:
                                    statistic.action === 'stamp_saved'
                                      ? theme.palette.green[100]
                                      : theme.palette.blue[50],
                                }}>
                                <Text
                                  style={{
                                    fontSize: 14,
                                    lineHeight: 24,
                                    letterSpacing: -1,
                                    fontFamily: theme.font.medium,
                                    color:
                                      statistic.action === 'stamp_saved'
                                        ? theme.color.texticon.onNormal.success
                                        : theme.color.texticon.onNormal.primary,
                                  }}>
                                  {statistic.action === 'stamp_saved'
                                    ? '적립'
                                    : '사용'}{' '}
                                  {statistic.stamp}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  width: 100,
                                  color: theme.color.texticon.onNormal.highestemp,
                                  fontSize: 14,
                                  lineHeight: 24,
                                  letterSpacing: -1,
                                  fontFamily: theme.font.medium,
                                }}>
                                {statistic.phone_number.replace(
                                  /(\d{3})(\d{4})(\d{4})/,
                                  '$1-$2-$3',
                                )}
                              </Text>
                              <Text
                                style={{
                                  color: theme.color.texticon.onNormal.highestemp,
                                  fontSize: 14,
                                  lineHeight: 24,
                                  letterSpacing: -1,
                                  fontFamily: theme.font.light,
                                }}>
                                {statistic.note}
                              </Text>
                            </View>
                            <Text
                              style={{
                                width: 120,
                                color: theme.color.texticon.onNormal.midemp,
                                fontSize: 14,
                                lineHeight: 24,
                                letterSpacing: -1,
                              }}>
                              {dayjs(statistic.timestamp).format(
                                'YYYY-MM-DD HH:mm',
                              )}
                            </Text>
                          </Pressable>
                          ),
                        )
                    ) : (
                      <View
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: 250,
                        }}>
                        <Text style={styles.emptyText}>
                          적립내역이 없습니다.
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>}
            {showDetailPanel && <View
              style={[
                styles.flexColumnBox,
                {
                  flex: 1,
                  maxWidth: isCompact ? undefined : 536,
                  height: '100%',
                  backgroundColor: theme.color.surface.normal.container10,
                  paddingHorizontal: 24,
                  paddingVertical: 32,
                },
              ]}>
              {isCompact && (
                <Pressable
                  style={[styles.flexRowBox, {gap: 6, marginBottom: 16}]}
                  onPress={() => setShowDetail(false)}>
                  <LeftArrowIcon width={16} height={16} />
                  <Text style={{fontFamily: theme.font.medium, fontSize: 15, color: theme.color.texticon.onNormal.highemp}}>목록으로</Text>
                </Pressable>
              )}
              {selectedContext.selectedLog ? (
                selectedContext.viewMode === 'detail' ? (
                  <View
                    style={{
                      flex: 1,
                    }}>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          width: '100%',
                          justifyContent: 'space-between',
                          marginBottom: 36,
                        },
                      ]}>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.highestemp,
                          fontFamily: theme.font.regular,
                          fontSize: 16,
                          lineHeight: 26,
                          letterSpacing: -1,
                        }}>
                        적립내역 상세
                      </Text>
                      <Pressable
                        onPress={() => {
                          setSelectedContext({
                            selectedLog: null,
                            viewMode: 'detail',
                            logList: [],
                          });
                        }}
                        style={[
                          styles.flexRowBox,
                          {
                            gap: 6,
                          },
                        ]}>
                        <Text>나가기</Text>
                        <ExitIcon />
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          marginBottom: 24,
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: 10,
                        },
                      ]}>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.highestemp,
                          fontFamily: theme.font.regular,
                          fontSize: 16,
                          lineHeight: 26,
                          letterSpacing: -1,
                        }}>
                        고객 번호
                      </Text>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.primary,
                          fontFamily: theme.font.medium,
                          fontSize: 24,
                          lineHeight: 32,
                          letterSpacing: -1,
                        }}>
                        {selectedContext.selectedLog.phone_number.replace(
                          /(\d{3})(\d{4})(\d{4})/,
                          '$1-$2-$3',
                        )}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        backgroundColor: theme.color.surface.normal.bg1,
                        borderRadius: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                      }}>
                      <View
                        style={[
                          styles.flexRowBox,
                          {
                            justifyContent: 'space-between',
                          },
                        ]}>
                        <View
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 6,
                            width: 62,
                            height: 32,
                            backgroundColor:
                              selectedContext.selectedLog.action ===
                              'stamp_saved'
                                ? theme.palette.green[100]
                                : theme.palette.blue[50],
                          }}>
                          <Text
                            style={{
                              fontSize: 14,
                              lineHeight: 24,
                              letterSpacing: -1,
                              fontFamily: theme.font.medium,
                              color:
                                selectedContext.selectedLog.action ===
                                'stamp_saved'
                                  ? theme.color.texticon.onNormal.success
                                  : theme.color.texticon.onNormal.primary,
                            }}>
                            {selectedContext.selectedLog.action ===
                            'stamp_saved'
                              ? '적립'
                              : '사용'}{' '}
                            {selectedContext.selectedLog.stamp}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: theme.color.texticon.onNormal.midemp,
                            fontFamily: theme.font.regular,
                            fontSize: 16,
                            lineHeight: 26,
                            letterSpacing: -1,
                          }}>
                          {dayjs(selectedContext.selectedLog.timestamp).format(
                            `M월 D일 HH:mm`,
                          )}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.flexRowBox,
                          {
                            justifyContent: 'space-between',
                            paddingHorizontal: 12,
                          },
                        ]}>
                        <Text
                          style={{
                            color: theme.color.texticon.onNormal.highestemp,
                            fontFamily: theme.font.medium,
                            fontSize: 16,
                            lineHeight: 24,
                            letterSpacing: -1,
                          }}>
                          {selectedContext.selectedLog.action === 'stamp_saved'
                            ? '스탬프 적립'
                            : selectedContext.selectedLog.note}
                        </Text>
                        <Text
                          style={{
                            color: theme.color.texticon.onNormal.highestemp,
                            fontFamily: theme.font.medium,
                            fontSize: 20,
                            lineHeight: 24,
                            letterSpacing: -1,
                          }}>
                          {selectedContext.selectedLog.action === 'stamp_saved'
                            ? `+${selectedContext.selectedLog.stamp}`
                            : `-${selectedContext.selectedLog.stamp}`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSelectedContext({
                            ...selectedContext,
                            viewMode: 'list',
                          });
                        }}
                        style={[
                          styles.flexRowBox,
                          {
                            borderRadius: 6,
                            paddingVertical: 15,
                            backgroundColor: theme.color.surface.normal.container10,
                            marginTop: 12,
                            cursor: 'pointer',
                          },
                        ]}>
                        <Text>모든내역보기</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1,
                    }}>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          width: '100%',
                          justifyContent: 'space-between',
                          marginBottom: 36,
                        },
                      ]}>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.highestemp,
                          fontFamily: theme.font.regular,
                          fontSize: 16,
                          lineHeight: 26,
                          letterSpacing: -1,
                        }}>
                        적립내역 상세
                      </Text>
                      <Pressable
                        onPress={() => {
                          setSelectedContext({
                            selectedLog: null,
                            viewMode: 'detail',
                            logList: [],
                          });
                        }}
                        style={[
                          styles.flexRowBox,
                          {
                            gap: 6,
                          },
                        ]}>
                        <Text>나가기</Text>
                        <ExitIcon />
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.flexRowBox,
                        {
                          marginBottom: 24,
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: 10,
                        },
                      ]}>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.highestemp,
                          fontFamily: theme.font.regular,
                          fontSize: 16,
                          lineHeight: 26,
                          letterSpacing: -1,
                        }}>
                        고객 번호
                      </Text>
                      <Text
                        style={{
                          color: theme.color.texticon.onNormal.primary,
                          fontFamily: theme.font.medium,
                          fontSize: 24,
                          lineHeight: 32,
                          letterSpacing: -1,
                        }}>
                        {selectedContext.selectedLog.phone_number.replace(
                          /(\d{3})(\d{4})(\d{4})/,
                          '$1-$2-$3',
                        )}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        backgroundColor: theme.color.surface.normal.bg1,
                        borderRadius: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                      }}>
                      <Pressable
                        style={[
                          styles.flexRowBox,
                          {gap: 7, justifyContent: 'flex-start'},
                        ]}
                        onPress={() => {
                          setSelectedContext({
                            ...selectedContext,
                            viewMode: 'detail',
                          });
                        }}>
                        <LeftArrowIcon />
                        <Text
                          style={{
                            fontSize: 16,
                            fontFamily: theme.font.regular,
                            color: theme.color.texticon.onNormal.highestemp,
                            lineHeight: 26,
                            letterSpacing: -1,
                          }}>
                          뒤로가기
                        </Text>
                      </Pressable>
                      <ScrollView>
                        {selectedContext.logList.map((log, index) => (
                          <View
                            key={index}
                            style={[
                              styles.listBox,
                              {
                                borderBottomWidth: 1,
                                borderBottomColor: theme.palette.gray[200],
                                paddingVertical: 16,
                              },
                            ]}>
                            <View
                              style={[
                                styles.flexRowBox,
                                {
                                  justifyContent: 'flex-start',
                                  gap: 16,
                                  flex: 1,
                                },
                              ]}>
                              <View
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  borderRadius: 6,
                                  width: 62,
                                  height: 32,
                                  backgroundColor:
                                    log.action === 'stamp_saved'
                                      ? theme.palette.green[100]
                                      : theme.palette.blue[50],
                                }}>
                                <Text
                                  style={{
                                    fontSize: 14,
                                    lineHeight: 24,
                                    letterSpacing: -1,
                                    fontFamily: theme.font.medium,
                                    color:
                                      log.action === 'stamp_saved'
                                        ? theme.color.texticon.onNormal.success
                                        : theme.color.texticon.onNormal.primary,
                                  }}>
                                  {log.action === 'stamp_saved'
                                    ? '적립'
                                    : '사용'}{' '}
                                  {log.stamp}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  color: theme.color.texticon.onNormal.highestemp,
                                  fontSize: 14,
                                  lineHeight: 24,
                                  letterSpacing: -1,
                                  fontFamily: theme.font.light,
                                }}>
                                {log.note}
                              </Text>
                            </View>
                            <Text
                              style={{
                                width: 120,
                                color: theme.color.texticon.onNormal.midemp,
                                fontSize: 14,
                                lineHeight: 24,
                                letterSpacing: -1,
                              }}>
                              {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm')}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )
              ) : (
                <>
                  <Text
                    style={{
                      color: theme.palette.gray[200],
                      fontFamily: theme.font.medium,
                      fontSize: 20,
                      lineHeight: 28,
                      letterSpacing: -1,
                    }}>
                    내역을 선택하여
                  </Text>
                  <Text
                    style={{
                      color: theme.palette.gray[200],
                      fontFamily: theme.font.medium,
                      fontSize: 20,
                      lineHeight: 28,
                      letterSpacing: -1,
                    }}>
                    상세 적립내역을 확인할 수 있습니다
                  </Text>
                </>
              )}
            </View>}
          </View>
        </View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={filterModalVisible}
          onRequestClose={() => setFilterModalVisible(false)}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
            }}
            onPress={() => setFilterModalVisible(false)}>
            <Pressable
              style={{
                backgroundColor: theme.color.surface.normal.bg1,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 32,
                paddingTop: 24,
                paddingBottom: 44,
                gap: 24,
              }}
              onPress={e => e.stopPropagation()}>
              <Text
                style={{
                  fontFamily: theme.font.semibold,
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -1,
                  color: theme.color.texticon.onNormal.highestemp,
                }}>
                내역 타입
              </Text>
              <View
                style={{
                  flexDirection: 'column',
                  gap: 20,
                }}>
                {FILTER_LIST.map((item, index) => {
                  return (
                    <Pressable
                      key={index}
                      onPress={() => {
                        setSearchContext({
                          ...searchContext,
                          filter: item.value,
                        });
                        if (item.value === 'all') {
                          setDisplayLogs(logs);
                        } else {
                          setDisplayLogs(
                            logs.filter(
                              log => log.action === `stamp_${item.value}`,
                            ),
                          );
                        }
                        setFilterModalVisible(false);
                      }}>
                      <Text
                        style={{
                          fontSize: 20,
                          lineHeight: 28,
                          fontFamily: theme.font.regular,
                          color:
                            searchContext.filter === item.value
                              ? theme.color.texticon.onNormal.primary
                              : theme.color.texticon.onNormal.highestemp,
                        }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        {/* 고객 조회 모달 */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={customerSearchVisible}
          presentationStyle="overFullScreen"
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setCustomerSearchVisible(false)}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setCustomerSearchVisible(false)}>
            <Pressable
              style={{
                backgroundColor: theme.color.surface.normal.bg1,
                borderRadius: 24,
                padding: 36,
                width: '90%',
                maxWidth: 400,
                gap: 20,
              }}
              onPress={() => {}}>
              <Text
                style={{
                  fontFamily: theme.font.semibold,
                  fontSize: 22,
                  color: theme.color.texticon.onNormal.highestemp,
                  letterSpacing: -0.5,
                }}>
                고객 번호 조회
              </Text>
              {/* 번호 표시 */}
              <View
                style={{
                  backgroundColor: theme.color.surface.normal.container10,
                  borderRadius: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  alignItems: 'flex-end',
                }}>
                <Text
                  style={{
                    fontFamily: 'SFUIDisplay-Medium',
                    fontSize: 28,
                    color:
                      customerSearchInput.length > 0 ? theme.color.texticon.onNormal.highestemp : theme.palette.gray[200],
                    letterSpacing: 2,
                  }}>
                  {customerSearchInput.length > 0
                    ? customerSearchInput.replace(
                        /(\d{3})(\d{0,4})(\d{0,4})/,
                        (_, a, b, c) =>
                          [a, b, c].filter(Boolean).join('-'),
                      )
                    : '010-0000-0000'}
                </Text>
              </View>
              {/* 숫자 키패드 */}
              <View style={{gap: 10}}>
                {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ['', 0, 'del']].map(
                  (row, ri) => (
                    <View
                      key={ri}
                      style={{flexDirection: 'row', gap: 10, justifyContent: 'center'}}>
                      {row.map((key, ki) => (
                        <Pressable
                          key={ki}
                          style={({pressed}) => ({
                            width: 90,
                            height: 56,
                            backgroundColor:
                              key === '' ? 'transparent' : pressed ? theme.palette.gray[200] : theme.color.surface.normal.container10,
                            borderRadius: 10,
                            justifyContent: 'center',
                            alignItems: 'center',
                          })}
                          onPress={() =>
                            key !== '' && onCustomerSearchKeyPress(key as number | string)
                          }>
                          <Text
                            style={{
                              fontSize: key === 'del' ? 18 : 26,
                              fontFamily: 'SFUIDisplay-Medium',
                              color: theme.color.texticon.onNormal.highestemp,
                            }}>
                            {key === 'del' ? '⌫' : key}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ),
                )}
              </View>
              {/* 조회 버튼 */}
              <Pressable
                style={({pressed}) => ({
                  backgroundColor: pressed ? theme.palette.blue[600] : theme.color.surface.brand.primary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                })}
                onPress={handleCustomerSearch}>
                <Text
                  style={{
                    fontFamily: theme.font.semibold,
                    fontSize: 18,
                    color: theme.color.surface.normal.bg1,
                  }}>
                  조회하기
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          presentationStyle="overFullScreen" // or "pageSheet" 등 시도
          supportedOrientations={['portrait', 'landscape']}>
          <DetailView
            navigation={navigation}
            phoneNumber={phoneNumber}
            onClose={() => {
              setModalVisible(false);
            }}
            updateLogs={updateLogs}
          />
        </Modal>
        {/* <BackgroundDeco backgroundColor="#FFFAE3" /> */}
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#FFFAE3',
  },
  backgroundStyle: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  flexColumnBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
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
  listBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    width: 112,
    height: 40,
    backgroundColor: theme.color.surface.normal.bg1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    gap: 6,
    shadowColor: theme.color.etc.absolute.black,
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 6,
  },
  buttonCompact: {
    width: 40,
    height: 34,
    gap: 0,
  },
  buttonText: {
    color: theme.color.texticon.onNormal.highestemp,
    fontFamily: theme.font.medium,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: -1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    height: 120,
    width: 'auto',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: theme.color.etc.absolute.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonClose: {
    backgroundColor: theme.color.surface.brand.primary,
    height: 50,
    width: 120,
    borderRadius: 10,
    elevation: 2,
    justifyContent: 'center',
  },
  textStyle: {
    color: theme.color.etc.absolute.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  titleText: {
    fontFamily: theme.font.semibold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -1,
  },
  titleSideText: {
    fontFamily: theme.font.regular,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: -1,
    color: theme.color.texticon.onNormal.midemp,
  },
  emptyText: {
    color: theme.color.texticon.onNormal.midemp,
    fontFamily: theme.font.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -1,
  },
  searchInput: {
    width: 200,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.color.surface.normal.container10,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInputText: {
    fontFamily: theme.font.regular,
    fontSize: 16,
    lineHeight: 20,
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
});

export default MainScreen;
