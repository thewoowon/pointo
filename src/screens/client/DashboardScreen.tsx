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
  LeftArrowIcon,
} from '../../components/Icons';
import {normalizeUser, getEarliestExpiry, filterExpiredCoupons} from '../../utils/coupons';
import {AnimatedBall} from '../../components/decorations';
// import {BackgroundDeco} from '../../components/background';
import LinearGradient from 'react-native-linear-gradient';

const SUMMER_COLORS = {
  backgroundStart: '#E8F4FD',
  backgroundEnd: '#C5E3F6',
  accent: '#0288D1',
  primary: '#0D2137',
  softSky: '#B3E5FC',
};

// 여름 바다 에디션 (총 13개)
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
    color: '#FFEB3B',
    size: 140,
    zIndex: 1,
  }, // 1 - 노랑
  {position: {bottom: -100, left: 23}, color: '#4FC3F7', size: 140, zIndex: 6}, // 2 - 하늘
  {position: {bottom: -30, left: 131}, color: '#FF7043', size: 140, zIndex: 5}, // 3 - 오렌지
  {position: {bottom: -44, left: 219}, color: '#E8F5E9', size: 140, zIndex: 3}, // 4 - 민트
  {position: {bottom: -23, right: -32}, color: '#81D4FA', size: 140, zIndex: 4}, // 5 - 연하늘

  {position: {bottom: 85, left: -53}, color: '#B2EBF2', size: 140, zIndex: 6}, // 6 - 연민트
  {position: {bottom: 15, left: 41}, color: '#FFEB3B', size: 140, zIndex: 13}, // 7 - 노랑
  {position: {bottom: 62, left: 158}, color: '#4FC3F7', size: 140, zIndex: 1}, // 8 - 하늘
  {position: {bottom: 85, right: 7}, color: '#FF7043', size: 140, zIndex: 5}, // 9 - 오렌지
  {position: {bottom: 161, left: -48}, color: '#E8F5E9', size: 140, zIndex: 4}, // 10 - 민트

  {position: {bottom: 136, left: 70}, color: '#81D4FA', size: 140, zIndex: 5}, // 11 - 연하늘
  {position: {bottom: 123, left: 172}, color: '#FFEB3B', size: 140, zIndex: 1}, // 12 - 노랑
  {position: {bottom: 193, right: -49}, color: '#4FC3F7', size: 140, zIndex: 1}, // 13 - 하늘
];

const DashboardScreen = ({navigation, route}: any) => {
  const phoneNumber = route.params?.phoneNumber;
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPointMode = storeConfig.mode === 'point';
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
            const initial = normalizeUser(data, storeConfig.couponTypes);
            const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(initial.coupons, initial.couponIssuedAt, storeConfig.couponExpiryDays);
            setUser({...initial, coupons: vc, couponIssuedAt: vi});
            return;
          }

          setPrevUser(userRef.current);
          const raw = normalizeUser(data, storeConfig.couponTypes);
          const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(raw.coupons, raw.couponIssuedAt, storeConfig.couponExpiryDays);
          setUser({...raw, coupons: vc, couponIssuedAt: vi});
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
      colors={[SUMMER_COLORS.backgroundStart, SUMMER_COLORS.backgroundEnd]}
      style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={SUMMER_COLORS.backgroundStart}
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
            {user && prevUser && (() => {
              const prevCT = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
              const newCT = Object.values(user.coupons).reduce((s, v) => s + v, 0);
              return user.stamps !== prevUser.stamps || newCT !== prevCT;
            })() ? (
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
                  <Text style={styles.holidayBadgeText}>Summer vibes 🏖️</Text>
                  <Text style={styles.holidayBadgeSubText}>
                    시원한 여름 바다 느낌으로 즐겨보세요
                  </Text>
                </View>
                <View style={styles.labelBox}>
                  {(() => {
                    if (isPointMode) {
                      const diff = user.stamps - prevUser.stamps;
                      if (diff > 0) {
                        return (
                          <>
                            <Text style={styles.labelTitleText}>
                              <Text style={[styles.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                                {diff.toLocaleString()}{storeConfig.pointUnit}
                              </Text>
                              이
                            </Text>
                            <Text style={styles.labelTitleText}>적립되었습니다.</Text>
                          </>
                        );
                      }
                      return (
                        <>
                          <Text style={styles.labelTitleText}>
                            <Text style={[styles.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                              {Math.abs(diff).toLocaleString()}{storeConfig.pointUnit}
                            </Text>
                            이
                          </Text>
                          <Text style={styles.labelTitleText}>사용되었습니다.</Text>
                        </>
                      );
                    }
                    const prevCT = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
                    const newCT = Object.values(user.coupons).reduce((s, v) => s + v, 0);
                    const couponsEarned = newCT - prevCT;
                    if (user.stamps !== prevUser.stamps || couponsEarned > 0) {
                      const earned = couponsEarned * storeConfig.stampsPerCoupon + user.stamps - prevUser.stamps;
                      return (
                        <>
                          <Text style={styles.labelTitleText}>
                            <Text style={[styles.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                              스탬프 {earned}개
                            </Text>
                            가
                          </Text>
                          <Text style={styles.labelTitleText}>적립되었습니다.</Text>
                        </>
                      );
                    }
                    const used = prevCT - newCT;
                    return (
                      <>
                        <Text style={styles.labelTitleText}>
                          <Text style={[styles.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                            쿠폰 {used}장
                          </Text>
                          이
                        </Text>
                        <Text style={styles.labelTitleText}>사용되었습니다.</Text>
                      </>
                    );
                  })()}
                </View>
                <View style={styles.labelBox}>
                  <Text
                    style={[
                      styles.labelTitleText,
                      {
                        color: SUMMER_COLORS.accent,
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
                  <Text style={styles.holidayBadgeText}>Summer vibes 🏖️</Text>
                  <Text style={styles.holidayBadgeSubText}>
                    시원한 여름 바다 느낌으로 즐겨보세요
                  </Text>
                </View>
                <Pressable style={[styles.flexBox, {gap: 7}]} onPress={goBack}>
                  <LeftArrowIcon />
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: 'Pretendard-Regular',
                      color: SUMMER_COLORS.softSky,
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
                          color: SUMMER_COLORS.accent,
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
                  {isPointMode ? (
                    user && (
                      <View style={styles.beverageBox}>
                        <View>
                          <Text style={styles.beverageTitleText}>
                            💰 보유 포인트
                          </Text>
                          <Text style={styles.beverageBodyText}>
                            {user.stamps.toLocaleString()}{storeConfig.pointUnit} 사용 가능
                          </Text>
                        </View>
                      </View>
                    )
                  ) : (
                    user && storeConfig.couponTypes.map(ct => {
                      const count = user.coupons[ct.id] ?? 0;
                      if (count <= 0) return null;
                      const expiry = getEarliestExpiry(
                        user.couponIssuedAt,
                        ct.id,
                        storeConfig.couponExpiryDays,
                      );
                      return (
                        <View key={ct.id} style={styles.beverageBox}>
                          <View>
                            <Text style={styles.beverageTitleText}>
                              🎫 {ct.name} {count}장 무료로 사용 가능해요!
                            </Text>
                            <Text style={styles.beverageBodyText}>
                              {expiry ? `${expiry}까지 사용 가능` : `스탬프 ${storeConfig.stampsPerCoupon}개 소진`}
                            </Text>
                          </View>
                        </View>
                      );
                    })
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
                        color: '#0D2137',
                      },
                    ]}>
                    {isPointMode ? '현재 보유 포인트' : '현재 보유 스탬프'}
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
                  {isPointMode ? (
                    <>
                      <Text style={styles.stampLeftText}>
                        {user ? user.stamps.toLocaleString() : 0}
                      </Text>
                      <Text style={styles.stampRightText}>{storeConfig.pointUnit}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.stampLeftText}>
                        {user ? user.stamps % storeConfig.stampsPerCoupon : 0}
                      </Text>
                      <Text style={styles.stampRightText}>/{storeConfig.stampsPerCoupon}개</Text>
                    </>
                  )}
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
                {!isPointMode && BALL_POSITIONS.slice(0, (user?.stamps ?? 0) % storeConfig.stampsPerCoupon).map(
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
    backgroundColor: 'rgba(2, 136, 209, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(2, 136, 209, 0.4)',
    marginBottom: 10,
    gap: 4,
  },
  holidayBadgeText: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: SUMMER_COLORS.accent,
    letterSpacing: -0.5,
  },
  holidayBadgeSubText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: SUMMER_COLORS.softSky,
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
    color: '#0288D1',
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
    backgroundColor: '#0288D1',
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
