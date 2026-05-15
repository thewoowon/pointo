import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';
import {
  AnalyticsEvent,
  hashPhone,
  getTierFromLevel,
  getReturnBucket,
} from '../../analytics/events';
import dayjs from 'dayjs';
import {
  CheckIcon,
  CircleXIcon,
  LeftBigArrowIcon,
  XIcon,
} from '../../components/Icons';
import LinearGradient from 'react-native-linear-gradient';
// import {BackgroundDeco} from '../../components/background';
import {useFocusEffect} from '@react-navigation/native';
import {LoadingOverlay} from '../../components/overlay';
import DashboardView from './DashboardView';

const COMING_SOON_SLIDES = [
  {
    emoji: '☕',
    title: '스마트 스탬프 적립',
    subtitle: '방문할수록 쌓이는 혜택\n아메리카노·음료 쿠폰을 받아보세요',
    badge: 'Now Live',
    bg: ['rgba(255, 243, 228, 0.82)', 'rgba(255, 224, 194, 0.82)'],
  },
  {
    emoji: '📊',
    title: '점주 전용 대시보드',
    subtitle: 'DAU·WAU·MAU, 재방문율, 쿠폰 성과를\n한눈에 확인하세요',
    badge: 'Now Live',
    bg: ['rgba(244, 240, 255, 0.82)', 'rgba(229, 220, 255, 0.82)'],
  },
  {
    emoji: '🎉',
    title: '이벤트 관리 기능',
    subtitle: '특별 프로모션과 이벤트를\n직접 만들고 관리해보세요',
    badge: 'Coming Soon',
    bg: ['rgba(255, 240, 244, 0.82)', 'rgba(255, 214, 224, 0.82)'],
  },
];

const SPRING_COLORS = {
  backgroundStart: '#FFFAF4',
  backgroundEnd: '#ffead1ff',
  accent: '#D4845A',
  primary: '#3D2416',
  petalPink: '#FFAA80',
  warmCream: '#FFF8F0',
};

const NUMBER_SEQUENCE = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const NumberInputScreen = ({navigation}: any) => {
  const {width: screenWidth} = useWindowDimensions();
  const isCompact = screenWidth < 768;
  const {storeCode, storeName} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const [number, setNumber] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalContext, setViewModalContext] = useState({
    visible: false,
    phoneNumber: '',
  });
  const [agree, setAgree] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    addUser,
    getUser,
    updateSession,
    deleteLogsInRange,
    deleteUserAccount,
  } = useFirestore(storeCode);
  const {track, identify} = useAnalytics();

  // Coming Soon 아이들 슬라이더
  const [idleVisible, setIdleVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }
    idleTimer.current = setTimeout(() => {
      setSlideIndex(0);
      setIdleVisible(true);
    }, storeConfig.idleTimeoutMs);
  }, [storeConfig.idleTimeoutMs]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
    };
  }, [resetIdleTimer]);

  // 슬라이드 자동 전환 + hint pulse (idleVisible일 때만)
  useEffect(() => {
    if (!idleVisible) {
      return;
    }
    const slideInterval = setInterval(() => {
      Animated.timing(slideOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setSlideIndex(prev => (prev + 1) % COMING_SOON_SLIDES.length);
        Animated.timing(slideOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, {
          toValue: 0.2,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      clearInterval(slideInterval);
      pulse.stop();
    };
  }, [idleVisible, slideOpacity, hintOpacity]);

  const onNumberPress = (value: number | string) => {
    resetIdleTimer();
    if (value === 'c') {
      setNumber(number.slice(0, -1));
      return;
    }

    if (number.length >= 8) {
      Alert.alert('전화번호는 11자리까지 입력할 수 있습니다.');
      return;
    }

    setNumber(number + value);
  };

  const onDeleteAccountPress = async () => {
    if (number.length < 8) {
      Alert.alert(
        '전화번호를 입력해주세요',
        '탈퇴할 계정의 전화번호를 먼저 입력해주세요.',
      );
      return;
    }
    const phoneNumber = `010${number}`;
    const existingUser = await getUser(phoneNumber);
    if (!existingUser) {
      Alert.alert('가입 이력 없음', '해당 번호로 가입된 계정이 없습니다.');
      return;
    }
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 스탬프, 쿠폰 등 모든 데이터가\n삭제되며 복구할 수 없어요.\n\n정말 탈퇴하시겠어요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteUserAccount(phoneNumber);
            if (success) {
              setNumber('');
              Alert.alert('탈퇴 완료', '그동안 이용해주셔서 감사합니다.');
            } else {
              Alert.alert('오류', '탈퇴 처리 중 문제가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  const onConfirmPress = async () => {
    if (number.length < 8) {
      Alert.alert('전화번호를 모두 입력해주세요.');
      return;
    }

    const phoneNumber = `010${number}`;

    setIsLoading(true);
    const response = await getUser(phoneNumber);
    setIsLoading(false);

    if (!response) {
      // 신규 유저 — 약관 동의 모달로
      try {
        track(AnalyticsEvent.SIGNUP_STARTED, {
          store_code: storeCode,
        });
      } catch (error) {
        console.error('Error logging event:', error);
      }
      setModalVisible(true);
      return;
    }

    // 이미 가입된 유저 — 재방문 이벤트 기록
    try {
      const user = response as User;
      identify(phoneNumber);
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      const daysSinceLastVisit = user.last_used
        ? dayjs().diff(dayjs(user.last_used), 'day')
        : 0;
      track(AnalyticsEvent.USER_RETURNED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(user.level ?? 0, storeConfig.levelTiers),
        user_level: user.level ?? 0,
        stamps_total: user.stamps ?? 0,
        days_since_signup: daysSinceSignup,
        days_since_last_visit: daysSinceLastVisit,
        return_bucket: getReturnBucket(daysSinceLastVisit),
      });
      if (daysSinceLastVisit >= 1) {
        track(AnalyticsEvent.FIRST_VISIT_OF_DAY, {
          store_code: storeCode,
          user_id: hashPhone(phoneNumber),
          user_tier: getTierFromLevel(user.level ?? 0, storeConfig.levelTiers),
        });
      }
    } catch (error) {
      console.error('Error logging event:', error);
    }

    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: phoneNumber,
      mode: 'onboarding',
    });
    // navigation.reset({
    //   index: 0,
    //   routes: [{name: 'Dashboard', params: {phoneNumber}}],
    // });
    setViewModalContext({
      visible: true,
      phoneNumber,
    });
    setNumber('');
  };

  const phoneNumberLabel = () => {
    if (number.length === 0) {
      return '';
    } else if (number.length < 5) {
      return `-${number}`;
    } else {
      return `-${number.slice(0, 4)}-${number.slice(4)}`;
    }
  };

  const onAgreePress = async () => {
    if (!agree) {
      Alert.alert('이용약관에 동의해주세요.');
      return;
    }

    const phoneNumber = `010${number}`;
    setIsLoading(true);
    await addUser(phoneNumber);
    setIsLoading(false);

    try {
      identify(phoneNumber);
      track(AnalyticsEvent.SIGNUP_COMPLETED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(0, storeConfig.levelTiers),
        user_level: 0,
        stamps_total: 0,
        days_since_signup: 0,
      });
    } catch (error) {
      console.error('Error logging event:', error);
    }

    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: phoneNumber,
      mode: 'onboarding',
    });
    // navigation.reset({
    //   index: 0,
    //   routes: [{name: 'Dashboard', params: {phoneNumber}}],
    // });
    setViewModalContext({
      visible: true,
      phoneNumber,
    });

    setNumber('');

    setModalVisible(false);
  };

  useFocusEffect(
    useCallback(() => {
      updateSession(`session_${storeCode}`, {
        last_used: new Date().toISOString().split('T')[0],
        phone: '',
        mode: 'waiting',
      });
    }, [storeCode]),
  );

  return (
    <LinearGradient
      colors={[SPRING_COLORS.backgroundStart, SPRING_COLORS.backgroundEnd]}
      style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={SPRING_COLORS.backgroundStart}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <LoadingOverlay isLoading={isLoading} />
        <View style={[styles.flexRowBox]}>
          <View
            style={[
              {
                display: 'flex',
                flex: 1,
                flexDirection: isCompact ? 'column' : 'row',
                justifyContent: 'center',
              },
              {gap: isCompact ? 0 : 60},
            ]}>
            {!isCompact && (
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    height: '100%',
                    width: 340,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    paddingTop: 134,
                    paddingBottom: 134,
                  },
                ]}>
                <View
                  style={[
                    styles.flexColumnBox,
                    {
                      alignItems: 'flex-start',
                      gap: 10,
                    },
                  ]}>
                  <View style={styles.labelBox}>
                    {storeConfig.welcomeLines.map((line, i) => (
                      <Text key={i} style={styles.labelTitleText}>{line}</Text>
                    ))}
                  </View>
                  <View style={styles.subLabelBox}>
                    {storeConfig.guideLines.map((line, i) => (
                      <Text key={i} style={styles.labelSubText}>{line}</Text>
                    ))}
                  </View>
                </View>
                <View
                  style={[
                    styles.labelBox,
                    {
                      marginTop: 10,
                      marginBottom: 10,
                      gap: 6,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.labelSubText,
                      {fontSize: 16, lineHeight: 24, color: '#FC4A00'},
                    ]}>
                    © 2025 {storeConfig.companyName}. All rights reserved.
                  </Text>
                  {/* <BackgroundDeco /> */}
                  <View
                    style={{
                      alignSelf: 'center',
                      flexDirection: 'row',
                      gap: 16,
                    }}>
                    <Pressable onPress={() => setPrivacyVisible(true)}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Pretendard-Regular',
                          color: 'rgba(61,36,22,0.5)',
                        }}>
                        개인정보 처리방침
                      </Text>
                    </Pressable>
                    <Pressable onPress={onDeleteAccountPress}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: 'Pretendard-Regular',
                          color: 'rgba(61,36,22,0.5)',
                        }}>
                        회원 탈퇴
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
            <View
              style={[
                styles.flexColumnBox,
                {
                  justifyContent: isCompact ? 'center' : 'flex-end',
                  height: '100%',
                  flex: isCompact ? 1 : undefined,
                },
              ]}>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    paddingTop: isCompact ? 16 : 24,
                    paddingLeft: 15,
                    paddingRight: 15,
                    borderTopLeftRadius: isCompact ? 0 : 32,
                    borderTopRightRadius: isCompact ? 0 : 32,
                    width: isCompact ? '100%' : 533,
                    height: isCompact ? '100%' : 734,
                    backgroundColor: '#ffffff',
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 4.5,
                    },
                    shadowOpacity: 0.07,
                    shadowRadius: 22,
                    elevation: 6,
                  },
                ]}>
                <View
                  style={[
                    styles.flexColumnBox,
                    {
                      width: isCompact ? '100%' : 485,
                      height: 'auto',
                    },
                  ]}>
                  <View
                    style={[
                      {
                        width: isCompact ? '100%' : 376,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 20,
                        marginBottom: 32,
                        paddingLeft: 9,
                        paddingRight: 9,
                      },
                    ]}>
                    {storeName && (
                      <Text
                        style={{
                          fontSize: 15,
                          fontFamily: 'Pretendard-SemiBold',
                          color: '#D4845A',
                        }}>
                        {storeName}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.headerNumberContainer,
                        {
                          width: '100%',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        },
                      ]}>
                      <View style={styles.headerNumberContainer}>
                        <Text style={styles.headerNumberText}>010</Text>
                        <Text style={styles.headerNumberText}>
                          {phoneNumberLabel()}
                        </Text>
                      </View>
                      {number.length > 0 && (
                        <Pressable
                          onPress={() => {
                            setNumber('');
                          }}>
                          <CircleXIcon width={24} height={24} color="#97999D" />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.divisor}></View>
                  </View>
                  <View
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 12,
                      },
                    ]}>
                    {NUMBER_SEQUENCE.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.numberInputContainer}>
                        {row.map((number, numberIndex) => (
                          <Pressable
                            key={numberIndex}
                            style={({pressed}) => [
                              {
                                backgroundColor: pressed
                                  ? '#FFD4AE'
                                  : 'rgba(255, 255, 255, 0.96)',
                                borderRadius: 10,
                              },
                              // 또는 추가 스타일이 있으면 아래처럼
                              styles.numberInputButton,
                            ]}
                            onPress={() => onNumberPress(number)}>
                            <Text style={styles.numberInputText}>{number}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                    <View style={styles.numberInputContainer}>
                      <Pressable style={styles.numberInputButton}></Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed
                              ? '#FFD6E0'
                              : 'rgba(255, 255, 255, 0.96)',
                            borderRadius: 10,
                          },
                          // 또는 추가 스타일이 있으면 아래처럼
                          styles.numberInputButton,
                        ]}
                        onPress={() => onNumberPress(0)}>
                        <Text style={styles.numberInputText}>0</Text>
                      </Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed
                              ? '#FFD6E0'
                              : 'rgba(255, 255, 255, 0.96)',
                            borderRadius: 10,
                          },
                          // 또는 추가 스타일이 있으면 아래처럼
                          styles.numberInputButton,
                        ]}
                        onPress={() => onNumberPress('c')}>
                        <LeftBigArrowIcon />
                      </Pressable>
                    </View>
                  </View>
                </View>
                <View style={styles.confirmContainer}>
                  <Pressable
                    style={({pressed}) => [
                      styles.confirmButton,
                      {
                        width: isCompact ? '100%' : pressed ? 409 : 421,
                        maxWidth: isCompact ? undefined : 421,
                      },
                    ]}
                    onPress={onConfirmPress}>
                    <LinearGradient
                      colors={['#FFB884', '#fea265ff']}
                      locations={[0.2, 1]}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 20,
                      }}>
                      <Text style={styles.confirmButtonText}>조회하기</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          presentationStyle="overFullScreen" // or "pageSheet" 등 시도
          supportedOrientations={['portrait', 'landscape']}>
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <View
                style={[
                  {
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  },
                ]}>
                <Text
                  style={[
                    styles.welcomeText,
                    {
                      color: '#191D2B',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.welcomeText,
                      {
                        color: '#FE7901',
                        fontFamily: 'SFUIDisplay-Semibold',
                      },
                    ]}>
                    010{phoneNumberLabel()}
                  </Text>{' '}
                  님 반갑습니다!
                </Text>
                <Pressable
                  style={{
                    height: 28,
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: 7,
                  }}
                  onPress={() => {
                    setAgree(false);
                    setModalVisible(false);
                  }}>
                  <XIcon />
                </Pressable>
              </View>
              <Text style={styles.titleText}>
                포인토(Pointo) 가입을 위해 이용약관 동의가 필요해요
              </Text>
              <Text style={styles.subtitleText}>
                아래 이용약관 확인 후 가입을 완료해 주세요.
              </Text>
              <ScrollView
                style={{
                  width: '100%',
                  borderColor: '#E0E0E9',
                  borderWidth: 0.5,
                  borderRadius: 10,
                  marginBottom: 25,
                  marginTop: 15,
                }}>
                <View style={styles.termsContainer}>
                  <Text>개인정보의 수집. 및 이용 동의서</Text>
                  <Text style={styles.termsLightSubtitle}>
                    - 이용자가 제공한 모든 정보는 다음의 목적을 위해 활용하며,
                    하기 목적 이외의 용도로는 사용되지 않습니다.
                  </Text>
                  <Text style={styles.termsSubtitle}>
                    ① 개인정보 수집 항목 및 수집·이용 목적
                  </Text>
                  <Text style={styles.termsBasicText}>
                    가) 수집 항목 (필수항목)
                  </Text>
                  <Text style={styles.termsSmallText}>
                    - 전화번호(휴대전화)
                  </Text>
                  <Text style={styles.termsBasicText}>
                    나) 수집 및 이용 목적
                  </Text>
                  <Text style={styles.termsSmallText}>
                    - 서비스 제공 및 운영
                  </Text>
                  <Text style={styles.termsSmallText}>- 사용자 본인 확인</Text>
                  <Text style={styles.termsSubtitle}>
                    ② 개인정보 보유 및 이용 기간
                  </Text>
                  <Text style={styles.termsSmallText}>
                    - 수집·이용 동의일로부터 개인정보의 수집·이용 목적을 달성할
                    때까지
                  </Text>
                  <Text style={styles.termsSubtitle}>③ 동의거부관리</Text>
                  <Text style={styles.termsSmallText}>
                    - 귀하께서는 본 안내에 따른 개인정보 수집, 이용에 대하여
                    동의를 거부하실 권리가 있습니다. 다만, 귀하가 개인정보의
                    수집·이용에 동의를 거부하시는 경우에 서비스 이용 과정에 있어
                    불이익이 발생할 수 있음을 알려드립니다.
                  </Text>
                </View>
              </ScrollView>
              <View
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                }}>
                <Pressable
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 6,
                    paddingLeft: 16,
                  }}
                  onPress={() => setAgree(!agree)}>
                  <CheckIcon color={agree ? SPRING_COLORS.accent : '#CFCFCF'} />
                  <Text style={styles.bottomText}>
                    이용약관을 모두 읽었으며 해당 내용에 모두 동의합니다.
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPrivacyVisible(true)}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Pretendard-Regular',
                      color: '#D4845A',
                      textDecorationLine: 'underline',
                      marginTop: 4,
                      marginBottom: 8,
                    }}>
                    개인정보 처리방침 보기
                  </Text>
                </Pressable>
                <Pressable
                  style={({pressed}) => [
                    styles.confirmButton,
                    {
                      width: pressed ? '98%' : '100%',
                      backgroundColor: agree ? SPRING_COLORS.accent : '#CFCFCF',
                      shadowOpacity: agree ? 0.45 : 0,
                    },
                  ]}
                  onPress={onAgreePress}
                  disabled={!agree}>
                  <LinearGradient
                    colors={
                      agree ? ['#FFB884', '#fea265ff'] : ['#EDEDED', '#EDEDED']
                    }
                    locations={[0.2, 1]}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 20,
                    }}>
                    <Text style={styles.confirmButtonText}>가입완료</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          animationType="slide"
          transparent={true}
          visible={viewModalContext.visible}
          presentationStyle="overFullScreen" // or "pageSheet" 등 시도
          supportedOrientations={['portrait', 'landscape']}>
          <DashboardView
            phoneNumber={viewModalContext.phoneNumber}
            onClose={() => {
              setViewModalContext({
                visible: false,
                phoneNumber: '',
              });
            }}
          />
        </Modal>
      </SafeAreaView>
      {/* Coming Soon 아이들 오버레이 — 전체화면 그라디언트 */}
      {false && (
        <Pressable
          style={styles.idleOverlay}
          onPress={() => {
            setIdleVisible(false);
            resetIdleTimer();
          }}>
          <LinearGradient
            colors={COMING_SOON_SLIDES[slideIndex].bg as [string, string]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.idleGradient}>
            <Animated.View
              style={{opacity: slideOpacity, alignItems: 'center', gap: 16}}>
              <View style={styles.idleBadge}>
                <Text style={styles.idleBadgeText}>
                  {COMING_SOON_SLIDES[slideIndex].badge}
                </Text>
              </View>
              <Text style={styles.idleEmoji}>
                {COMING_SOON_SLIDES[slideIndex].emoji}
              </Text>
              <Text style={styles.idleTitle}>
                {COMING_SOON_SLIDES[slideIndex].title}
              </Text>
              <Text style={styles.idleSubtitle}>
                {COMING_SOON_SLIDES[slideIndex].subtitle}
              </Text>
            </Animated.View>
            <View style={styles.idleDots}>
              {COMING_SOON_SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.idleDot,
                    i === slideIndex && styles.idleDotActive,
                  ]}
                />
              ))}
            </View>
            <Animated.Text style={[styles.idleTapHint, {opacity: hintOpacity}]}>
              화면을 터치하면 돌아갑니다
            </Animated.Text>
          </LinearGradient>
        </Pressable>
      )}
      <PrivacyPolicyModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
        companyName={storeConfig.companyName}
        contactEmail={storeConfig.contactEmail}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#FFFAE3',
  },
  backgroundStyle: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  flexCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexRowBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexColumnBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  holidayBadge: {
    backgroundColor: 'rgba(212, 132, 90, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 132, 90, 0.4)',
    marginBottom: 10,
    gap: 4,
  },
  holidayBadgeText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: SPRING_COLORS.accent,
    letterSpacing: -0.5,
  },
  holidayBadgeSubText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: SPRING_COLORS.primary,
  },
  subLabelBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  labelTitleText: {
    fontSize: 36,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 48,
    letterSpacing: -1,
    color: SPRING_COLORS.primary,
  },
  labelSubText: {
    fontSize: 24,
    fontFamily: 'Pretendard-Light',
    lineHeight: 32,
    letterSpacing: -1,
    color: 'rgba(61, 36, 22, 0.75)',
  },
  numberInputContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  numberInputButton: {
    display: 'flex',
    flex: 1,
    maxWidth: 151,
    height: 77,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberInputText: {
    fontSize: 42,
    color: '#3D2416',
    fontFamily: 'SFUIDisplay-Regular',
  },
  headerNumberContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerNumberText: {
    fontSize: 44,
    color: SPRING_COLORS.primary,
    fontFamily: 'SFUIDisplay-Medium',
    lineHeight: 48,
    letterSpacing: -1,
  },
  santaCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(212, 132, 90, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 132, 90, 0.35)',
  },
  santaIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 170, 128, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  santaIcon: {
    fontSize: 30,
    color: SPRING_COLORS.accent,
  },
  santaTextWrapper: {
    flexShrink: 1,
    gap: 2,
  },
  santaTitle: {
    fontSize: 17,
    fontFamily: 'SFUIDisplay-Semibold',
    color: '#3D2416',
  },
  santaSubtitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.75)',
    lineHeight: 20,
  },
  confirmContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 55.5,
  },
  confirmButton: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 344,
    height: 64,
    backgroundColor: '#FFCBA4',
    borderRadius: 24,
    // shadow
    shadowColor: '#E8935A',
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
  divisor: {
    width: '100%',
    height: 0.5,
    backgroundColor: '#D7E7DB',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    height: 450,
    width: '90%',
    maxWidth: 634,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: SPRING_COLORS.accent,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  termsContainer: {
    flex: 1,
    padding: 12,
  },
  templateContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 5,
    borderWidth: 0.5,
    borderColor: '#8E979E',
    borderRadius: 5,
    marginBottom: 20,
  },
  templateText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Light',
  },
  termsLightSubtitle: {
    fontSize: 10,
    fontFamily: 'Pretendard-Light',
    marginTop: 10,
    paddingLeft: 10,
  },
  termsSubtitle: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    marginTop: 10,
    paddingLeft: 10,
  },
  termsBasicText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Light',
    marginTop: 5,
    paddingLeft: 20,
  },
  termsSmallText: {
    fontSize: 10,
    fontFamily: 'Pretendard-Light',
    marginTop: 5,
    paddingLeft: 30,
  },
  welcomeText: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Pretendard-Medium',
    color: '#0E4132',
  },
  titleText: {
    width: '100%',
    fontSize: 28,
    lineHeight: 38,
    fontFamily: 'Pretendard-Medium',
    color: '#0E4132',
  },
  subtitleText: {
    width: '100%',
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'Pretendard-Regular',
    color: '#3E5F51',
  },
  bottomText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Pretendard-Regular',
    color: '#0E4132',
  },
  idleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 245, 235, 0.45)',
  },
  idleGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  idleBadge: {
    backgroundColor: 'rgba(212, 132, 90, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 132, 90, 0.4)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  idleBadgeText: {
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
    color: SPRING_COLORS.accent,
    letterSpacing: 1,
  },
  idleEmoji: {
    fontSize: 100,
  },
  idleTitle: {
    fontSize: 48,
    fontFamily: 'Pretendard-Medium',
    color: SPRING_COLORS.primary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  idleSubtitle: {
    fontSize: 26,
    fontFamily: 'Pretendard-Light',
    color: 'rgba(61, 36, 22, 0.7)',
    textAlign: 'center',
    lineHeight: 38,
  },
  idleDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  idleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(212, 132, 90, 0.3)',
  },
  idleDotActive: {
    backgroundColor: SPRING_COLORS.accent,
    width: 24,
  },
  idleTapHint: {
    fontSize: 18,
    fontFamily: 'Pretendard-Light',
    color: 'rgba(61, 36, 22, 1)',
    marginTop: 8,
  },
});

export default NumberInputScreen;
