import React, {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useAuth, useFirestore, useStoreConfig} from '../../hooks';
import {getFirestore, doc, onSnapshot} from '@react-native-firebase/firestore';
import {
  AmericanoIcon,
  BeverageIcon,
  LeftArrowIcon,
} from '../../components/Icons';
import {AnimatedBall} from '../../components/decorations';
// import {BackgroundDeco} from '../../components/background';
import LinearGradient from 'react-native-linear-gradient';

const HOLIDAY_COLORS = {
  backgroundStart: '#0B3D2E',
  backgroundEnd: '#0D5C43',
  accent: '#F2D16B',
  primary: '#D7263D',
  softMint: '#D7F0E2',
};

// 총 13개까지
const BALL_POSITIONS: {
  position: {
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
  };
  color: string;
  size: number;
  zIndex: number;
}[] = [
  {
    position: {bottom: -4, left: -59},
    color: '#FF515D',
    size: 140,
    zIndex: 1,
  }, // 1
  {position: {bottom: -100, left: 23}, color: '#86AEFE', size: 140, zIndex: 6}, // 2
  {position: {bottom: -30, left: 131}, color: '#9165DD', size: 140, zIndex: 5}, // 3
  {position: {bottom: -44, left: 219}, color: '#FFAE62', size: 140, zIndex: 3}, // 4
  {position: {bottom: -23, right: -32}, color: '#5DB0EB', size: 140, zIndex: 4}, // 5

  {position: {bottom: 85, left: -53}, color: '#67B265', size: 140, zIndex: 6}, // 6
  {position: {bottom: 15, left: 41}, color: '#FFB2F6', size: 140, zIndex: 13}, // 7
  {position: {bottom: 62, left: 158}, color: '#FFF0A8', size: 140, zIndex: 1}, // 8
  {position: {bottom: 85, right: 7}, color: '#67B265', size: 140, zIndex: 5}, // 9
  {position: {bottom: 161, left: -48}, color: '#FFF0A8', size: 140, zIndex: 4}, // 10

  {position: {bottom: 136, left: 70}, color: '#5DB0EB', size: 140, zIndex: 5}, // 11
  {position: {bottom: 123, left: 172}, color: '#FFAE62', size: 140, zIndex: 1}, // 12
  {position: {bottom: 193, right: -49}, color: '#FF515D', size: 140, zIndex: 1}, // 13
];

const DashboardScreen = ({navigation, route}: any) => {
  const phoneNumber = route.params?.phoneNumber;
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const [timeLeft, setTimeLeft] = useState(60);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [prevUser, setPrevUser] = useState<User | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef<User | null>(null);
  const prevUserRef = useRef<User | null>(null);

  const {updateSession, resolveUserDocId} = useFirestore(storeCode);

  const phoneNumberLabel = () => {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber || '';
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(
      3,
      7,
    )}-${phoneNumber.slice(7)}`;
  };

  const goBack = async () => {
    setTimeLeft(3);
  };

  const getCouponName = (typeId: string) => {
    return storeConfig.couponTypes.find(c => c.id === typeId)?.name;
  };

  useEffect(() => {
    setTimeLeft(storeConfig.sessionTimeoutSeconds);
  }, [storeConfig.sessionTimeoutSeconds]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    prevUserRef.current = prevUser;
  }, [prevUser]);

  useEffect(() => {
    if (!phoneNumber) return;

    const db = getFirestore();
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      const docId = await resolveUserDocId(phoneNumber);
      if (cancelled) return;
      const _userRef = doc(db, 'users', docId);

      unsubscribe = onSnapshot(_userRef, doc => {
        if (doc.exists) {
          const data = doc.data();
          console.log('Dashboard Current User data: ', data);
          if (!data) {
            console.log('No data found');
            return;
          }

          if (!userRef.current && !prevUserRef.current) {
            console.log('최초 사용자 정보 저장');
            setUser(data as User);
            return;
          }

          setPrevUser(userRef.current);
          setUser(data as User);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [phoneNumber]);

  useEffect(() => {
    if (!storeCode) return;

    const db = getFirestore();
    const sessionRef = doc(db, 'sessions', `session_${storeCode}`);

    const unsubscribe = onSnapshot(sessionRef, doc => {
      if (doc.exists) {
        const data = doc.data();
        console.log('Dashboard Current Session data: ', data);
        if (!data) {
          console.log('No data found');
          return;
        }

        if (data.phone === '' && data.mode === 'waiting') {
          setTimeLeft(3); // 즉시 종료 처리
        }

        setSession(data as Session);
      }
    });

    return () => {
      unsubscribe(); // 🧹 리스너 정리
    };
  }, [storeCode]);

  useEffect(() => {
    if (timeLeft === 0) {
      if (session && session.phone !== '') {
        updateSession(`session_${storeCode}`, {
          last_used: new Date().toISOString().split('T')[0],
          phone: '',
          mode: 'waiting',
        });
      }

      navigation.reset({
        index: 0,
        routes: [{name: 'NumberInput'}],
      });
    }
  }, [timeLeft, session, storeCode]);

  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeLeft]);

  useEffect(() => {
    console.log('📱 DashboardScreen mounted');
    return () => {
      console.log('🧹 DashboardScreen unmounted');
    };
  }, []);

  return (
    <LinearGradient
      colors={[HOLIDAY_COLORS.backgroundStart, HOLIDAY_COLORS.backgroundEnd]}
      style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={HOLIDAY_COLORS.backgroundStart}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={[styles.flexRowBox]}>
          <View
            style={[
              {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
              },
              {gap: 110},
            ]}>
            {user && prevUser && user.stamps !== prevUser.stamps ? (
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    height: 'auto',
                    gap: 39,
                    width: '100%',
                    maxWidth: 424,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: 104,
                  },
                ]}>
                <View style={styles.holidayBadge}>
                  <Text style={styles.holidayBadgeText}>Warm wishes 🎄</Text>
                  <Text style={styles.holidayBadgeSubText}>
                    포근한 크리스마스 분위기에서 쉬어가세요
                  </Text>
                </View>
                <View style={styles.labelBox}>
                  <Text style={styles.labelTitleText}>
                    <Text
                      style={[
                        styles.labelTitleText,
                        {
                          color: HOLIDAY_COLORS.accent,
                        },
                      ]}>
                      스탬프 {Math.abs(user.stamps - prevUser.stamps)}개
                    </Text>
                    가
                  </Text>
                  <Text style={styles.labelTitleText}>
                    {prevUser.stamps < user.stamps
                      ? '적립되었습니다.'
                      : '사용되었습니다.'}
                  </Text>
                </View>
                <View style={styles.labelBox}>
                  <Text
                    style={[
                      styles.labelTitleText,
                      {
                        color: HOLIDAY_COLORS.accent,
                      },
                    ]}>
                    감사합니다
                  </Text>
                  <Text style={styles.labelSubText}>
                    <Text
                      style={[
                        styles.labelSubText,
                        {
                          width: 24,
                          fontFamily: 'Pretendard-SemiBold',
                        },
                      ]}>
                      {timeLeft}
                    </Text>{' '}
                    초 후 화면이 종료됩니다
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    height: 'auto',
                    gap: 58,
                    width: '100%',
                    maxWidth: 424,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: 28,
                  },
                ]}>
                <View style={styles.holidayBadge}>
                  <Text style={styles.holidayBadgeText}>Warm wishes 🎄</Text>
                  <Text style={styles.holidayBadgeSubText}>
                    포근한 크리스마스 분위기에서 쉬어가세요
                  </Text>
                </View>
                <Pressable style={[styles.flexBox, {gap: 7}]} onPress={goBack}>
                  <LeftArrowIcon />
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: 'Pretendard-Regular',
                      color: HOLIDAY_COLORS.softMint,
                      lineHeight: 28,
                      letterSpacing: -1,
                    }}>
                    뒤로가기
                  </Text>
                </Pressable>
                <View style={styles.labelBox}>
                  <Text style={styles.labelSubText}>
                    <Text
                      style={[
                        styles.labelSubText,
                        {
                          color: HOLIDAY_COLORS.accent,
                          fontFamily: 'SFUIDisplay-Semibold',
                        },
                      ]}>
                      {phoneNumberLabel()}
                    </Text>
                    {` 님 반갑습니다.`}
                  </Text>
                  <Text style={styles.labelTitleText}>
                    오늘도 좋은 하루 되세요 {'><'}
                  </Text>
                  {timeLeft < 10 && (
                    <Text>
                      <Text
                        style={[
                          styles.labelSubText,
                          {
                            width: 24,
                            fontFamily: 'Pretendard-SemiBold',
                          },
                        ]}>
                        {timeLeft}
                      </Text>{' '}
                      초 후 화면이 종료됩니다
                    </Text>
                  )}
                </View>
                <View style={styles.beverageWrapper}>
                  {user && user.beverageCoupons > 0 && (
                    <View style={styles.beverageBox}>
                      <View>
                        <View
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 4,
                            alignItems: 'center',
                          }}>
                          <BeverageIcon />
                          <Text style={styles.beverageTitleText}>
                            {getCouponName('beverage') ?? '조제음료'} {user.beverageCoupons}잔 무료로 사용
                            가능해요!
                          </Text>
                        </View>
                        <Text style={styles.beverageBodyText}>
                          스탬프 {storeConfig.stampsPerCoupon}개 소진
                        </Text>
                      </View>
                    </View>
                  )}
                  {user && user.americanoCoupons > 0 && (
                    <View style={styles.beverageBox}>
                      <View>
                        <View
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 4,
                            alignItems: 'center',
                          }}>
                          <AmericanoIcon />
                          <Text style={styles.beverageTitleText}>
                            {getCouponName('americano') ?? '아메리카노'} {user.americanoCoupons}잔 무료로 사용
                            가능해요!
                          </Text>
                        </View>
                        <Text style={styles.beverageBodyText}>
                          스탬프 {storeConfig.stampsPerCoupon}개 소진
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View
              style={[
                {
                  borderRadius: 35,
                  width: '90%',
                  maxWidth: 420,
                  height: 552,
                  backgroundColor: '#ffffff',
                  shadowColor: '#000000',
                  shadowOffset: {
                    width: 0,
                    height: 4.5,
                  },
                  shadowOpacity: 0.07,
                  shadowRadius: 22,
                  elevation: 6,
                  position: 'relative',
                },
              ]}>
              <View
                style={{
                  flex: 1,
                  paddingTop: 59,
                  paddingLeft: 37,
                  paddingRight: 37,
                  paddingBottom: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                <View
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                  }}>
                  <Text
                    style={[
                      styles.labelSubText,
                      {
                        color: '#424756',
                      },
                    ]}>
                    현재 보유 스탬프
                  </Text>
                </View>
                <View
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    alignItems: 'baseline',
                    gap: 18,
                  }}>
                  <Text style={styles.stampLeftText}>
                    {user ? user.stamps : 0}
                  </Text>
                  <Text style={styles.stampRightText}>/{storeConfig.stampsPerCoupon}개</Text>
                </View>
              </View>
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: 35,
                }}>
                {BALL_POSITIONS.slice(0, user?.stamps || 0).map(
                  (ball, index) => {
                    return (
                      <AnimatedBall key={index} index={index} ball={ball} />
                    );
                  },
                )}
              </View>
            </View>
          </View>
        </View>
        {/* <BackgroundDeco /> */}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundStyle: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  flexBox: {
    display: 'flex',
    flexDirection: 'row',
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
    gap: 5,
  },
  holidayBadge: {
    backgroundColor: 'rgba(242, 209, 107, 0.16)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 209, 107, 0.55)',
    marginBottom: 10,
    gap: 4,
  },
  holidayBadgeText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: HOLIDAY_COLORS.accent,
    letterSpacing: -0.5,
  },
  holidayBadgeSubText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: HOLIDAY_COLORS.softMint,
  },
  subLabelBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  labelTitleText: {
    fontSize: 32,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 45,
    letterSpacing: -1,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 28,
    letterSpacing: -1,
  },
  stampLeftText: {
    fontSize: 76,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 86,
    letterSpacing: -1,
    color: '#FD5F01',
  },
  stampRightText: {
    fontSize: 28,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 38,
    letterSpacing: -1,
  },
  beverageWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 40,
  },
  beverageBox: {
    width: '100%',
    height: 98,
    backgroundColor: '#FF8400',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beverageTitleText: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: 'Pretendard-Medium',
    color: '#ffffff',
    letterSpacing: -1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Pretendard-Regular',
    color: '#ffffff',
    letterSpacing: -1,
  },
});

export default DashboardScreen;
