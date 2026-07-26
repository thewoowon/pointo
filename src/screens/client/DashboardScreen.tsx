import React, {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useStoreConfig, useDeviceType} from '../../hooks';
import {semanticColors as c, primitives as p, fontFamily as f} from '../../theme';
import {getFirestore, doc, onSnapshot} from '@react-native-firebase/firestore';
import {LeftArrowIcon} from '../../components/Icons';
import {normalizeUser, getEarliestExpiry, filterExpiredCoupons} from '../../utils/coupons';
import {AnimatedBall} from '../../components/decorations';
import LinearGradient from 'react-native-linear-gradient';

const SUMMER_COLORS = {
  backgroundStart: p.blue[50],
  backgroundEnd: p.blue[100],
  accent: c.surface.brand.primary,
  primary: c.texticon.onNormal.highestemp,
  softSky: p.blue[100],
};

const BALL_POSITIONS: {
  position: {top?: number; left?: number; right?: number; bottom?: number};
  color: string;
  size: number;
  zIndex: number;
}[] = [
  {position: {bottom: -11, left: -55}, color: p.yellow[400], size: 128, zIndex: 1},
  {position: {bottom: -90, left: 30}, color: p.blue[300], size: 128, zIndex: 6},
  {position: {bottom: -30, left: 130}, color: p.orange[400], size: 128, zIndex: 5},
  {position: {bottom: -40, right: 60}, color: p.green[100], size: 128, zIndex: 3},
  {position: {bottom: -20, right: -30}, color: p.yellow[400], size: 128, zIndex: 4},
  {position: {bottom: 75, left: -35}, color: p.blue[200], size: 128, zIndex: 6},
  {position: {bottom: 10, left: 50}, color: p.orange[400], size: 128, zIndex: 13},
  {position: {bottom: 55, left: 160}, color: p.blue[100], size: 128, zIndex: 2},
  {position: {bottom: 60, right: 28}, color: p.yellow[400], size: 128, zIndex: 7},
  {position: {bottom: 145, left: -30}, color: p.blue[300], size: 128, zIndex: 4},
  {position: {bottom: 120, left: 78}, color: p.green[100], size: 128, zIndex: 5},
  {position: {bottom: 145, right: 47}, color: p.orange[400], size: 128, zIndex: 1},
  {position: {bottom: 120, right: -43}, color: p.blue[200], size: 128, zIndex: 6},
];

const DashboardScreen = ({navigation, route}: any) => {
  const phoneNumber = route.params?.phoneNumber;
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPointMode = storeConfig.mode === 'point';
  const deviceType = useDeviceType();
  const isPhone = deviceType === 'phone';

  const [timeLeft, setTimeLeft] = useState(60);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [prevUser, setPrevUser] = useState<User | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<User | null>(null);
  const prevUserRef = useRef<User | null>(null);

  const {updateSession, resolveUserDocId} = useFirestore(storeCode);

  const phoneNumberLabel = () => {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber || '';
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`;
  };

  const goBack = async () => {
    setTimeLeft(3);
  };

  const hasChange =
    user &&
    prevUser &&
    (() => {
      const prevCT = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
      const newCT = Object.values(user.coupons).reduce((s, v) => s + v, 0);
      return user.stamps !== prevUser.stamps || newCT !== prevCT;
    })();

  const changeSummary = (() => {
    if (!user || !prevUser || !hasChange) return null;
    if (isPointMode) {
      const diff = user.stamps - prevUser.stamps;
      return {
        type: diff > 0 ? ('earn' as const) : ('use' as const),
        amount: Math.abs(diff),
        unit: storeConfig.pointUnit,
      };
    }
    const prevCT = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
    const newCT = Object.values(user.coupons).reduce((s, v) => s + v, 0);
    const couponsEarned = newCT - prevCT;
    if (user.stamps !== prevUser.stamps || couponsEarned > 0) {
      const earned =
        couponsEarned * storeConfig.stampsPerCoupon +
        user.stamps -
        prevUser.stamps;
      return {type: 'earn' as const, amount: earned, unit: '개'};
    }
    const used = prevCT - newCT;
    return {type: 'use' as const, amount: used, unit: '장'};
  })();

  const availableCoupons = user
    ? storeConfig.couponTypes
        .map(ct => {
          const count = user.coupons[ct.id] ?? 0;
          if (count <= 0) return null;
          const expiry = getEarliestExpiry(
            user.couponIssuedAt,
            ct.id,
            storeConfig.couponExpiryDays,
          );
          return {id: ct.id, name: ct.name, count, expiry};
        })
        .filter(Boolean)
    : [];

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

      unsubscribe = onSnapshot(_userRef, docSnap => {
        if (docSnap.exists) {
          const data = docSnap.data();
          if (!data) return;

          if (!userRef.current && !prevUserRef.current) {
            const initial = normalizeUser(data, storeConfig.couponTypes);
            const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
              initial.coupons,
              initial.couponIssuedAt,
              storeConfig.couponExpiryDays,
            );
            setUser({...initial, coupons: vc, couponIssuedAt: vi});
            return;
          }

          setPrevUser(userRef.current);
          const raw = normalizeUser(data, storeConfig.couponTypes);
          const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
            raw.coupons,
            raw.couponIssuedAt,
            storeConfig.couponExpiryDays,
          );
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

    const unsubscribe = onSnapshot(sessionRef, docSnap => {
      if (docSnap.exists) {
        const data = docSnap.data();
        if (!data) return;

        if (data.phone === '' && data.mode === 'waiting') {
          setTimeLeft(3);
        }

        setSession(data as Session);
      }
    });

    return () => unsubscribe();
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

  // --- Change Info Panel ---
  const renderChangeInfo = () => {
    if (!changeSummary) return null;
    return (
      <View style={s.labelBox}>
        {(() => {
          if (isPointMode) {
            return (
              <>
                <Text style={[s.labelTitleText, isPhone && {fontSize: 24, lineHeight: 34}]}>
                  <Text style={{color: SUMMER_COLORS.accent}}>
                    {changeSummary.amount.toLocaleString()}
                    {changeSummary.unit}
                  </Text>
                  이
                </Text>
                <Text style={[s.labelTitleText, isPhone && {fontSize: 24, lineHeight: 34}]}>
                  {changeSummary.type === 'earn'
                    ? '적립되었습니다.'
                    : '사용되었습니다.'}
                </Text>
              </>
            );
          }
          return (
            <>
              <Text style={[s.labelTitleText, isPhone && {fontSize: 24, lineHeight: 34}]}>
                <Text style={{color: SUMMER_COLORS.accent}}>
                  {changeSummary.type === 'earn'
                    ? `스탬프 ${changeSummary.amount}개`
                    : `쿠폰 ${changeSummary.amount}장`}
                </Text>
                {changeSummary.type === 'earn' ? '가' : '이'}
              </Text>
              <Text style={[s.labelTitleText, isPhone && {fontSize: 24, lineHeight: 34}]}>
                {changeSummary.type === 'earn'
                  ? '적립되었습니다.'
                  : '사용되었습니다.'}
              </Text>
            </>
          );
        })()}
      </View>
    );
  };

  // --- Coupon/Point Info ---
  const renderRewardInfo = () => (
    <View style={s.beverageWrapper}>
      {isPointMode
        ? user && (
            <View style={[s.beverageBox, isPhone && {height: 72}]}>
              <View>
                <Text style={[s.beverageTitleText, isPhone && {fontSize: 16}]}>
                  💰 보유 포인트
                </Text>
                <Text style={[s.beverageBodyText, isPhone && {fontSize: 13}]}>
                  {user.stamps.toLocaleString()}
                  {storeConfig.pointUnit} 사용 가능
                </Text>
              </View>
            </View>
          )
        : availableCoupons.map((c: any) => (
            <View key={c.id} style={[s.beverageBox, isPhone && {height: 72}]}>
              <View>
                <Text style={[s.beverageTitleText, isPhone && {fontSize: 16}]}>
                  🎫 {c.name} {c.count}장 무료로 사용 가능해요!
                </Text>
                <Text style={[s.beverageBodyText, isPhone && {fontSize: 13}]}>
                  {c.expiry
                    ? `${c.expiry}까지 사용 가능`
                    : `스탬프 ${storeConfig.stampsPerCoupon}개 소진`}
                </Text>
              </View>
            </View>
          ))}
    </View>
  );

  // --- Stamp Card ---
  const renderStampCard = () => {
    const cardSize = isPhone
      ? {width: '100%' as const, height: 280}
      : {width: '90%' as const, maxWidth: 420, height: 552};
    const stampFont = isPhone ? 52 : 76;
    const stampLine = isPhone ? 62 : 86;
    const unitFont = isPhone ? 20 : 28;

    return (
      <View
        style={[
          {
            borderRadius: 35,
            backgroundColor: c.surface.normal.bg1,
            shadowColor: c.etc.absolute.black,
            shadowOffset: {width: 0, height: 4.5},
            shadowOpacity: 0.07,
            shadowRadius: 22,
            elevation: 6,
            position: 'relative',
          },
          cardSize,
        ]}>
        <View
          style={{
            flex: 1,
            paddingTop: isPhone ? 24 : 59,
            paddingLeft: isPhone ? 24 : 37,
            paddingRight: isPhone ? 24 : 37,
            paddingBottom: isPhone ? 16 : 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
            }}>
            <Text style={[s.labelSubText, {color: c.texticon.onNormal.highestemp, fontSize: isPhone ? 16 : 20}]}>
              {isPointMode ? '현재 보유 포인트' : '현재 보유 스탬프'}
            </Text>
          </View>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'baseline',
              gap: 18,
            }}>
            {isPointMode ? (
              <>
                <Text style={[s.stampLeftText, {fontSize: stampFont, lineHeight: stampLine}]}>
                  {user ? user.stamps.toLocaleString() : 0}
                </Text>
                <Text style={[s.stampRightText, {fontSize: unitFont}]}>
                  {storeConfig.pointUnit}
                </Text>
              </>
            ) : (
              <>
                <Text style={[s.stampLeftText, {fontSize: stampFont, lineHeight: stampLine}]}>
                  {user ? user.stamps % storeConfig.stampsPerCoupon : 0}
                </Text>
                <Text style={[s.stampRightText, {fontSize: unitFont}]}>
                  /{storeConfig.stampsPerCoupon}개
                </Text>
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
          {!isPointMode &&
            BALL_POSITIONS.slice(
              0,
              (user?.stamps ?? 0) % storeConfig.stampsPerCoupon,
            ).map((ball, index) => (
              <AnimatedBall key={index} index={index} ball={ball} />
            ))}
        </View>
      </View>
    );
  };

  // --- Phone Layout ---
  if (isPhone) {
    return (
      <LinearGradient
        colors={[SUMMER_COLORS.backgroundStart, SUMMER_COLORS.backgroundEnd]}
        style={s.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={SUMMER_COLORS.backgroundStart}
          translucent={false}
        />
        <SafeAreaView style={s.backgroundStyle}>
          <ScrollView
            contentContainerStyle={{paddingBottom: 40, gap: 20}}
            showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Pressable style={{flexDirection: 'row', alignItems: 'center', gap: 7}} onPress={goBack}>
                <LeftArrowIcon color={SUMMER_COLORS.primary} />
                <Text style={{fontSize: 16, fontFamily: f.regular, color: SUMMER_COLORS.primary}}>
                  뒤로가기
                </Text>
              </Pressable>
              {timeLeft < 15 && (
                <Text style={{fontSize: 14, fontFamily: f.regular, color: c.texticon.onNormal.midemp}}>
                  <Text style={{fontFamily: f.semibold}}>{timeLeft}</Text>초
                </Text>
              )}
            </View>

            {/* Holiday badge */}
            <View style={s.holidayBadge}>
              <Text style={s.holidayBadgeText}>Summer vibes 🏖️</Text>
              <Text style={[s.holidayBadgeSubText, {color: SUMMER_COLORS.primary}]}>
                시원한 여름 바다 느낌으로 즐겨보세요
              </Text>
            </View>

            {/* User Info */}
            <View style={{gap: 4}}>
              <Text style={{fontSize: 16, fontFamily: f.regular, color: c.texticon.onNormal.highemp, letterSpacing: -0.5}}>
                <Text style={{color: SUMMER_COLORS.accent, fontFamily: 'SFUIDisplay-Semibold'}}>
                  {phoneNumberLabel()}
                </Text>
                {' 님 반갑습니다.'}
              </Text>
              <Text style={{fontSize: 24, fontFamily: f.medium, color: SUMMER_COLORS.primary, letterSpacing: -1, lineHeight: 34}}>
                오늘도 좋은 하루 되세요 {'><'}
              </Text>
            </View>

            {/* Change summary */}
            {hasChange && (
              <View style={{backgroundColor: p.blue[50], borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: p.blue[100]}}>
                {renderChangeInfo()}
              </View>
            )}

            {/* Stamp Card */}
            <View style={{alignItems: 'center'}}>
              {renderStampCard()}
            </View>

            {/* Reward Info */}
            {renderRewardInfo()}

            {/* Timer */}
            <View style={{alignItems: 'center', paddingVertical: 8}}>
              <Text style={{fontSize: 14, fontFamily: f.regular, color: c.texticon.onNormal.midemp}}>
                <Text style={{fontFamily: f.semibold}}>{timeLeft}</Text>초 후 화면이 종료됩니다
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- Tablet Layout ---
  return (
    <LinearGradient
      colors={[SUMMER_COLORS.backgroundStart, SUMMER_COLORS.backgroundEnd]}
      style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={SUMMER_COLORS.backgroundStart}
        translucent={false}
      />
      <SafeAreaView style={s.backgroundStyle}>
        <View style={[s.flexRowBox]}>
          <View
            style={[
              {display: 'flex', flexDirection: 'row', justifyContent: 'center'},
              {gap: 110},
            ]}>
            {hasChange ? (
              <View
                style={[
                  s.flexColumnBox,
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
                <View style={s.holidayBadge}>
                  <Text style={s.holidayBadgeText}>Summer vibes 🏖️</Text>
                  <Text style={s.holidayBadgeSubText}>
                    시원한 여름 바다 느낌으로 즐겨보세요
                  </Text>
                </View>
                {renderChangeInfo()}
                <View style={s.labelBox}>
                  <Text style={[s.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                    감사합니다
                  </Text>
                  <Text style={s.labelSubText}>
                    <Text
                      style={[
                        s.labelSubText,
                        {width: 24, fontFamily: f.semibold},
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
                  s.flexColumnBox,
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
                <View style={s.holidayBadge}>
                  <Text style={s.holidayBadgeText}>Summer vibes 🏖️</Text>
                  <Text style={s.holidayBadgeSubText}>
                    시원한 여름 바다 느낌으로 즐겨보세요
                  </Text>
                </View>
                <Pressable
                  style={[s.flexBox, {gap: 7}]}
                  onPress={goBack}>
                  <LeftArrowIcon />
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: f.regular,
                      color: SUMMER_COLORS.softSky,
                      lineHeight: 28,
                      letterSpacing: -1,
                    }}>
                    뒤로가기
                  </Text>
                </Pressable>
                <View style={s.labelBox}>
                  <Text style={s.labelSubText}>
                    <Text
                      style={[
                        s.labelSubText,
                        {
                          color: SUMMER_COLORS.accent,
                          fontFamily: 'SFUIDisplay-Semibold',
                        },
                      ]}>
                      {phoneNumberLabel()}
                    </Text>
                    {' 님 반갑습니다.'}
                  </Text>
                  <Text style={s.labelTitleText}>
                    오늘도 좋은 하루 되세요 {'><'}
                  </Text>
                  {timeLeft < 10 && (
                    <Text>
                      <Text
                        style={[
                          s.labelSubText,
                          {width: 24, fontFamily: f.semibold},
                        ]}>
                        {timeLeft}
                      </Text>{' '}
                      초 후 화면이 종료됩니다
                    </Text>
                  )}
                </View>
                {renderRewardInfo()}
              </View>
            )}

            {renderStampCard()}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const s = StyleSheet.create({
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
    backgroundColor: p.blue[50],
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.blue[200],
    marginBottom: 10,
    gap: 4,
  },
  holidayBadgeText: {
    fontSize: 16,
    fontFamily: f.semibold,
    color: SUMMER_COLORS.accent,
    letterSpacing: -0.5,
  },
  holidayBadgeSubText: {
    fontSize: 12,
    fontFamily: f.regular,
    color: SUMMER_COLORS.softSky,
  },
  labelTitleText: {
    fontSize: 32,
    fontFamily: f.medium,
    lineHeight: 45,
    letterSpacing: -1,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: f.regular,
    lineHeight: 28,
    letterSpacing: -1,
  },
  stampLeftText: {
    fontSize: 76,
    fontFamily: f.medium,
    lineHeight: 86,
    letterSpacing: -1,
    color: c.surface.brand.primary,
  },
  stampRightText: {
    fontSize: 28,
    fontFamily: f.medium,
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
    marginTop: 20,
  },
  beverageBox: {
    width: '100%',
    height: 98,
    backgroundColor: c.surface.brand.primary,
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
    fontFamily: f.medium,
    color: c.etc.absolute.white,
    letterSpacing: -1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: f.regular,
    color: c.etc.absolute.white,
    letterSpacing: -1,
  },
});

export default DashboardScreen;
