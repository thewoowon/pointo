import React, {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import dayjs from 'dayjs';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
import {AnalyticsEvent, hashPhone} from '../../analytics/events';
import {getFirestore, doc, onSnapshot} from '@react-native-firebase/firestore';
import {
  LeftArrowIcon,
} from '../../components/Icons';
import {normalizeUser, getEarliestExpiry, filterExpiredCoupons} from '../../utils/coupons';
import {AnimatedBall, SnowflakeEffect} from '../../components/decorations';
import {
  StampNearOverlay,
  CouponEarnedOverlay,
} from '../../components/overlay';
// import {BackgroundDeco} from '../../components/background';
import LinearGradient from 'react-native-linear-gradient';

type LevelInfo = {
  emoji: string;
  name: string;
  color: string;
  bgColor: string;
};

const getLevelInfo = (level: number, tiers: LevelTier[]): LevelInfo => {
  const sorted = [...tiers].sort((a, b) => a.maxLevel - b.maxLevel);
  for (const tier of sorted) {
    if (level <= tier.maxLevel) return tier;
  }
  return sorted[sorted.length - 1];
};

const getLastVisitMessage = (lastUsed: string): string => {
  if (!lastUsed) return '';
  const diff = dayjs().startOf('day').diff(dayjs(lastUsed), 'day');
  if (diff === 0) return '오늘도 찾아주셨네요 ><';
  if (diff === 1) return '어제 다녀가셨군요!';
  if (diff < 30) return `${diff}일 만에 오셨네요!`;
  return `${Math.floor(diff / 30)}달 만에 오셨네요!`;
};

const SUMMER_COLORS = {
  backgroundStart: '#E8F4FD',
  backgroundEnd: '#C5E3F6',
  accent: '#0288D1',
  primary: '#0D2137',
  waveBlue: '#4FC3F7',
  sandCream: '#FFF8E7',
};

// 여름 바다 에디션 스탬프 (총 21개)
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
    position: {bottom: -11, left: -55},
    color: '#FFEB3B',
    size: 171,
    zIndex: 1,
  }, // 1 - 노랑
  {position: {bottom: -128, left: 45}, color: '#4FC3F7', size: 171, zIndex: 6}, // 2 - 하늘
  {position: {bottom: -42, left: 177}, color: '#FF7043', size: 171, zIndex: 5}, // 3 - 오렌지
  {position: {bottom: -59, right: 78}, color: '#E8F5E9', size: 171, zIndex: 3}, // 4 - 민트
  {position: {bottom: -34, right: -36}, color: '#FFEB3B', size: 171, zIndex: 4}, // 5 - 노랑

  {position: {bottom: 98, left: -48}, color: '#81D4FA', size: 171, zIndex: 6}, // 6 - 연하늘
  {position: {bottom: 13, left: 67}, color: '#FF7043', size: 171, zIndex: 13}, // 7 - 오렌지
  {position: {bottom: 70, left: 210}, color: '#B2EBF2', size: 171, zIndex: 2}, // 8 - 연민트
  {position: {bottom: 78, right: 36}, color: '#FFEB3B', size: 171, zIndex: 7}, // 9 - 노랑

  {position: {bottom: 191, left: -42}, color: '#4FC3F7', size: 171, zIndex: 4}, // 10 - 하늘
  {position: {bottom: 160, left: 103}, color: '#E8F5E9', size: 171, zIndex: 5}, // 11 - 민트
  {position: {bottom: 192, right: 62}, color: '#FF7043', size: 171, zIndex: 1}, // 12 - 오렌지
  {position: {bottom: 160, right: -57}, color: '#81D4FA', size: 171, zIndex: 6}, // 13 - 연하늘
  {
    position: {bottom: 287, left: -53},
    color: '#FFEB3B',
    size: 171,
    zIndex: 3,
  }, // 14 - 노랑
  {position: {bottom: 262, left: 61}, color: '#4FC3F7', size: 171, zIndex: 2}, // 15 - 하늘
  {position: {bottom: 279, left: 167}, color: '#FF7043', size: 171, zIndex: 3}, // 16 - 오렌지
  {position: {bottom: 334, left: 278}, color: '#B2EBF2', size: 171, zIndex: 13}, // 17 - 연민트
  {position: {bottom: 300, right: -38}, color: '#E8F5E9', size: 171, zIndex: 5}, // 18 - 민트

  {position: {top: 144, left: -5}, color: '#FFEB3B', size: 171, zIndex: 5}, // 19 - 노랑
  {position: {top: 172, left: 135}, color: '#81D4FA', size: 171, zIndex: 1}, // 20 - 연하늘
  {position: {top: 204, right: -31}, color: '#4FC3F7', size: 171, zIndex: 5}, // 21 - 하늘
];

type DashboardViewProps = {
  phoneNumber: string;
  onClose: () => void;
};

const DashboardView = ({phoneNumber, onClose}: DashboardViewProps) => {
  const {width: screenWidth} = useWindowDimensions();
  const isCompact = screenWidth < 768;
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPointMode = storeConfig.mode === 'point';
  const [timeLeft, setTimeLeft] = useState(60);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [prevUser, setPrevUser] = useState<User | null>(null);
  const [dStampOverlayContext, setDStampOverlayContext] = useState({
    show: false,
    type: 'americano' as string,
    dStamp: 'one' as 'one' | 'two' | 'coupon',
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef<User | null>(null);
  const prevUserRef = useRef<User | null>(null);

  const {updateSession, resolveUserDocId} = useFirestore(storeCode);
  const {track} = useAnalytics();

  const phoneNumberLabel = () => {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber || '';
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(
      3,
      7,
    )}-${phoneNumber.slice(7)}`;
  };

  const goBack = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setTimeLeft(0);
  };

  const dismissOverlay = () => {
    setDStampOverlayContext(prev => ({...prev, show: false}));
  };

  const getCouponName = (typeId: string) => {
    return storeConfig.couponTypes.find(c => c.id === typeId)?.name;
  };

  const showOverlay = (overlayContext: {
    show: boolean;
    type: string;
    dStamp: 'one' | 'two' | 'coupon';
  }) => {
    const {show, type, dStamp} = overlayContext;
    const couponName = getCouponName(type);

    if (dStamp === 'one') {
      return <StampNearOverlay show={show} remaining={1} couponName={couponName} />;
    } else if (dStamp === 'two') {
      return <StampNearOverlay show={show} remaining={2} couponName={couponName} />;
    } else if (dStamp === 'coupon') {
      return <CouponEarnedOverlay show={show} onDismiss={dismissOverlay} couponName={couponName} />;
    }

    return null;
  };

  const delayBeforeUpdate = (
    type: string,
    dStamp: 'one' | 'two' | 'coupon',
  ) => {
    console.log('타이머 시작');
    async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    };
    console.log('타이머 종료');
    setDStampOverlayContext({
      show: true,
      type,
      dStamp,
    });
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

          const raw = normalizeUser(data, storeConfig.couponTypes);
          const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(raw.coupons, raw.couponIssuedAt, storeConfig.couponExpiryDays);
          const updatedUser = {...raw, coupons: vc, couponIssuedAt: vi};

          setPrevUser(userRef.current);
          setUser(updatedUser);

          console.log('updatedUser', updatedUser);
          console.log('userRef.current: ', userRef.current);
          // 포인트 모드에서는 쿠폰/오버레이 없음
          if (!isPointMode) {
            // 쿠폰 증가 감지 (스탬프 카드 모델: modulo로 stamps가 줄어도 쿠폰이 늘면 적립)
            const prevTotal = Object.values(userRef.current?.coupons ?? {}).reduce((s, v) => s + v, 0);
            const newTotal = Object.values(updatedUser.coupons).reduce((s, v) => s + v, 0);
            if (newTotal > prevTotal) {
              console.log('쿠폰 획득 감지');
              delayBeforeUpdate(updatedUser.phase, 'coupon');
            } else if (updatedUser.stamps > (userRef.current?.stamps || 0)) {
              console.log('스탬프 증가 감지');
              if (updatedUser.stamps === storeConfig.stampsPerCoupon - 1) {
                delayBeforeUpdate(updatedUser.phase, 'one');
              } else if (updatedUser.stamps === storeConfig.stampsPerCoupon - 2) {
                delayBeforeUpdate(updatedUser.phase, 'two');
              }
            }
          }
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
      console.log("'세션 리스너 작동 중...'");
      if (doc.exists) {
        const data = doc.data();
        console.log('Dashboard Current Session data: ', data);
        if (!data) {
          console.log('No data found');
          return;
        }

        if (data.phone === '' && data.mode === 'waiting') {
          setTimeLeft(3);
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
        console.log('timer 세션 종료');
        try {
          track(AnalyticsEvent.SESSION_ENDED, {
            store_code: storeCode,
            user_id: hashPhone(session.phone),
            reason: 'timeout',
          });
        } catch (error) {
          console.log('Analytics error: ', error);
        }
        updateSession(`session_${storeCode}`, {
          last_used: new Date().toISOString().split('T')[0],
          phone: '',
          mode: 'waiting',
        });
      }

      onClose();
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
        <SnowflakeEffect count={25} />
        <View style={[styles.flexRowBox]}>
          <View
            style={[
              {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
              },
              {gap: isCompact ? 0 : 60},
            ]}>
            {!isCompact && (user && prevUser && (() => {
              const prevCouponTotal = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
              const newCouponTotal = Object.values(user.coupons).reduce((s, v) => s + v, 0);
              const stampsChanged = user.stamps !== prevUser.stamps;
              const couponsChanged = newCouponTotal !== prevCouponTotal;
              return stampsChanged || couponsChanged;
            })() ? (
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    height: '100%',
                    gap: 39,
                    width: 340,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: 134,
                    paddingBottom: 134,
                  },
                ]}>
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
                      // 스탬프 적립 (modulo 보정)
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
                    // 쿠폰 사용 (스탬프 변동 없음)
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
                    height: '100%',
                    gap: 58,
                    width: 340,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: 134,
                    paddingBottom: 134,
                  },
                ]}>
                <Pressable style={[styles.flexBox, {gap: 7}]} onPress={goBack}>
                  <LeftArrowIcon color={SUMMER_COLORS.primary}/>
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: 'Pretendard-Regular',
                      color: SUMMER_COLORS.primary,
                      lineHeight: 28,
                      letterSpacing: -1,
                    }}>
                    뒤로가기
                  </Text>
                </Pressable>
                <View style={styles.labelBox}>
                  {/* 등급 뱃지 */}
                  {user && (() => {
                    const lvl = getLevelInfo(user.level, storeConfig.levelTiers);
                    return (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: lvl.bgColor,
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        alignSelf: 'flex-start',
                        gap: 6,
                        marginBottom: 4,
                      }}>
                        <Text style={{fontSize: 16}}>{lvl.emoji}</Text>
                        <Text style={{
                          fontFamily: 'Pretendard-SemiBold',
                          fontSize: 14,
                          color: lvl.color,
                          letterSpacing: -0.3,
                        }}>{lvl.name}</Text>
                        <Text style={{
                          fontFamily: 'Pretendard-Regular',
                          fontSize: 12,
                          color: lvl.color,
                          opacity: 0.7,
                        }}>Lv.{user.level}</Text>
                      </View>
                    );
                  })()}
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
                    {user?.last_used
                      ? getLastVisitMessage(user.last_used)
                      : '오늘도 좋은 하루 되세요 ><'}
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
            ))}
            <View
              style={[
                styles.flexColumnBox,
                {
                  justifyContent: 'flex-end',
                  height: '100%',
                },
              ]}>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
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
                          color: SUMMER_COLORS.primary,
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
                      zIndex: 100,
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
        </View>
        {/* <BackgroundDeco /> */}
      </SafeAreaView>
      {showOverlay(dStampOverlayContext)}
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
  innerContainer: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 24,
    paddingBottom: 24,
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
  santaCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(2, 136, 209, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(2, 136, 209, 0.35)',
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
    color: SUMMER_COLORS.accent,
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
    color: 'rgba(13, 33, 55, 0.65)',
    lineHeight: 20,
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
    color: SUMMER_COLORS.primary,
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
    color: SUMMER_COLORS.primary,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 28,
    letterSpacing: -1,
    color: 'rgba(13, 33, 55, 0.65)',
  },
  stampLeftText: {
    fontSize: 76,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 86,
    letterSpacing: -1,
    color: SUMMER_COLORS.accent,
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
    backgroundColor: 'rgba(2, 136, 209, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beverageTitleText: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Pretendard-Medium',
    color: SUMMER_COLORS.primary,
    letterSpacing: -1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(13, 33, 55, 0.65)',
    letterSpacing: -1,
  },
});

export default DashboardView;
