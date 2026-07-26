import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDeviceType} from '../../hooks';
import {semanticColors as c, primitives as p, fontFamily as f} from '../../theme';
import {LeftArrowIcon} from '../../components/Icons';
import {AnimatedBall, SnowflakeEffect} from '../../components/decorations';
import {StampNearOverlay, CouponEarnedOverlay} from '../../components/overlay';
import LinearGradient from 'react-native-linear-gradient';
import {useDashboard} from './useDashboard';

const SUMMER_COLORS = {
  backgroundStart: p.blue[50],
  backgroundEnd: p.blue[100],
  accent: c.surface.brand.primary,
  primary: c.texticon.onNormal.highestemp,
  waveBlue: p.blue[300],
  sandCream: p.amber[50],
};

const BALL_POSITIONS: {
  position: {top?: number; left?: number; right?: number; bottom?: number};
  color: string;
  size: number;
  zIndex: number;
}[] = [
  {position: {bottom: -11, left: -55}, color: p.yellow[400], size: 171, zIndex: 1},
  {position: {bottom: -128, left: 45}, color: p.blue[300], size: 171, zIndex: 6},
  {position: {bottom: -42, left: 177}, color: p.orange[400], size: 171, zIndex: 5},
  {position: {bottom: -59, right: 78}, color: p.green[100], size: 171, zIndex: 3},
  {position: {bottom: -34, right: -36}, color: p.yellow[400], size: 171, zIndex: 4},
  {position: {bottom: 98, left: -48}, color: p.blue[200], size: 171, zIndex: 6},
  {position: {bottom: 13, left: 67}, color: p.orange[400], size: 171, zIndex: 13},
  {position: {bottom: 70, left: 210}, color: p.blue[100], size: 171, zIndex: 2},
  {position: {bottom: 78, right: 36}, color: p.yellow[400], size: 171, zIndex: 7},
  {position: {bottom: 191, left: -42}, color: p.blue[300], size: 171, zIndex: 4},
  {position: {bottom: 160, left: 103}, color: p.green[100], size: 171, zIndex: 5},
  {position: {bottom: 192, right: 62}, color: p.orange[400], size: 171, zIndex: 1},
  {position: {bottom: 160, right: -57}, color: p.blue[200], size: 171, zIndex: 6},
  {position: {bottom: 287, left: -53}, color: p.yellow[400], size: 171, zIndex: 3},
  {position: {bottom: 262, left: 61}, color: p.blue[300], size: 171, zIndex: 2},
  {position: {bottom: 279, left: 167}, color: p.orange[400], size: 171, zIndex: 3},
  {position: {bottom: 334, left: 278}, color: p.blue[100], size: 171, zIndex: 13},
  {position: {bottom: 300, right: -38}, color: p.green[100], size: 171, zIndex: 5},
  {position: {top: 144, left: -5}, color: p.yellow[400], size: 171, zIndex: 5},
  {position: {top: 172, left: 135}, color: p.blue[200], size: 171, zIndex: 1},
  {position: {top: 204, right: -31}, color: p.blue[300], size: 171, zIndex: 5},
];

type DashboardViewProps = {
  phoneNumber: string;
  onClose: () => void;
};

// --- Stamp Card ---
const StampCard = ({
  user,
  isPointMode,
  storeConfig,
  compact,
}: {
  user: User | null;
  isPointMode: boolean;
  storeConfig: any;
  compact?: boolean;
}) => {
  const cardHeight = compact ? 320 : 734;
  const stampFontSize = compact ? 56 : 76;
  const stampLineHeight = compact ? 66 : 86;
  const unitFontSize = compact ? 20 : 28;
  const labelFontSize = compact ? 16 : 20;
  const padding = compact ? 24 : 37;

  return (
    <View
      style={[
        styles.flexColumnBox,
        {
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          width: compact ? '100%' : 533,
          height: compact ? cardHeight : cardHeight,
          backgroundColor: c.surface.normal.bg1,
          shadowColor: c.etc.absolute.black,
          shadowOffset: {width: 0, height: 4.5},
          shadowOpacity: 0.07,
          shadowRadius: 22,
          elevation: 6,
          position: 'relative',
        },
      ]}>
      <View
        style={{
          flex: 1,
          paddingTop: compact ? 28 : 59,
          paddingLeft: padding,
          paddingRight: padding,
          paddingBottom: compact ? 16 : 28,
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
              {color: SUMMER_COLORS.primary, fontSize: labelFontSize},
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
              <Text
                style={[
                  styles.stampLeftText,
                  {fontSize: stampFontSize, lineHeight: stampLineHeight},
                ]}>
                {user ? user.stamps.toLocaleString() : 0}
              </Text>
              <Text style={[styles.stampRightText, {fontSize: unitFontSize}]}>
                {storeConfig.pointUnit}
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.stampLeftText,
                  {fontSize: stampFontSize, lineHeight: stampLineHeight},
                ]}>
                {user ? user.stamps % storeConfig.stampsPerCoupon : 0}
              </Text>
              <Text style={[styles.stampRightText, {fontSize: unitFontSize}]}>
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

// --- Change Summary Banner ---
const ChangeBanner = ({
  changeSummary,
  isPointMode,
  storeConfig,
}: {
  changeSummary: {type: 'earn' | 'use'; amount: number; unit: string} | null;
  isPointMode: boolean;
  storeConfig: any;
}) => {
  if (!changeSummary) return null;

  const label = isPointMode
    ? changeSummary.type === 'earn'
      ? '적립'
      : '사용'
    : changeSummary.type === 'earn'
    ? '스탬프 적립'
    : '쿠폰 사용';

  return (
    <View style={phoneSt.changeBanner}>
      <Text style={phoneSt.changeBannerText}>
        <Text
          style={[
            phoneSt.changeBannerText,
            {color: SUMMER_COLORS.accent, fontFamily: f.semibold},
          ]}>
          {isPointMode
            ? `${changeSummary.amount.toLocaleString()}${changeSummary.unit}`
            : `${label} ${changeSummary.amount}${changeSummary.unit}`}
        </Text>
        {changeSummary.type === 'earn' ? ' 적립되었습니다' : ' 사용되었습니다'}
      </Text>
    </View>
  );
};

// --- Phone Layout ---
const PhoneLayout = ({d}: {d: ReturnType<typeof useDashboard>}) => {
  return (
    <ScrollView
      style={{flex: 1, paddingHorizontal: 20, paddingVertical: 20}}
      contentContainerStyle={phoneSt.scrollContent}
      showsVerticalScrollIndicator={false}>
      {/* Header: back + timer */}
      <View style={phoneSt.header}>
        <Pressable style={phoneSt.backButton} onPress={d.goBack}>
          <LeftArrowIcon color={SUMMER_COLORS.primary} />
          <Text style={phoneSt.backText}>뒤로가기</Text>
        </Pressable>
        {d.timeLeft < 15 && (
          <Text style={phoneSt.timerText}>
            <Text
              style={[phoneSt.timerText, {fontFamily: f.semibold}]}>
              {d.timeLeft}
            </Text>
            초
          </Text>
        )}
      </View>

      {/* User Info */}
      <View style={phoneSt.userInfo}>
        {d.levelInfo && d.user && (
          <View
            style={[
              phoneSt.levelBadge,
              {backgroundColor: d.levelInfo.bgColor},
            ]}>
            <Text style={{fontSize: 14}}>{d.levelInfo.emoji}</Text>
            <Text style={[phoneSt.levelName, {color: d.levelInfo.color}]}>
              {d.levelInfo.name}
            </Text>
            <Text style={[phoneSt.levelNum, {color: d.levelInfo.color}]}>
              Lv.{d.user.level}
            </Text>
          </View>
        )}
        <Text style={phoneSt.welcomeText}>
          <Text
            style={[
              phoneSt.welcomeText,
              {color: SUMMER_COLORS.accent, fontFamily: 'SFUIDisplay-Semibold'},
            ]}>
            {d.phoneNumberLabel()}
          </Text>
          {' 님 반갑습니다.'}
        </Text>
        <Text style={phoneSt.visitText}>{d.lastVisitMessage}</Text>
      </View>

      {/* Change summary */}
      {d.hasChange && (
        <ChangeBanner
          changeSummary={d.changeSummary}
          isPointMode={d.isPointMode}
          storeConfig={d.storeConfig}
        />
      )}

      {/* Stamp Card */}
      <StampCard
        user={d.user}
        isPointMode={d.isPointMode}
        storeConfig={d.storeConfig}
        compact
      />

      {/* Point/Coupon Info */}
      <View style={phoneSt.infoSection}>
        {d.isPointMode
          ? d.user && (
              <View style={phoneSt.infoCard}>
                <Text style={phoneSt.infoTitle}>💰 보유 포인트</Text>
                <Text style={phoneSt.infoBody}>
                  {d.user.stamps.toLocaleString()}
                  {d.storeConfig.pointUnit} 사용 가능
                </Text>
              </View>
            )
          : d.availableCoupons.map((c: any) => (
              <View key={c.id} style={phoneSt.infoCard}>
                <Text style={phoneSt.infoTitle}>
                  🎫 {c.name} {c.count}장 무료로 사용 가능해요!
                </Text>
                <Text style={phoneSt.infoBody}>
                  {c.expiry
                    ? `${c.expiry}까지 사용 가능`
                    : `스탬프 ${d.storeConfig.stampsPerCoupon}개 소진`}
                </Text>
              </View>
            ))}
      </View>

      {/* Timer banner at bottom */}
      <View style={phoneSt.timerBanner}>
        <Text style={phoneSt.timerBannerText}>
          <Text
            style={[
              phoneSt.timerBannerText,
              {fontFamily: f.semibold},
            ]}>
            {d.timeLeft}
          </Text>
          초 후 화면이 종료됩니다
        </Text>
      </View>
    </ScrollView>
  );
};

// --- Tablet Layout ---
const TabletLayout = ({d}: {d: ReturnType<typeof useDashboard>}) => {
  return (
    <View style={[styles.flexRowBox]}>
      <View
        style={[
          {display: 'flex', flexDirection: 'row', justifyContent: 'center'},
          {gap: 60},
        ]}>
        {/* Left Panel */}
        {d.hasChange ? (
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
                if (!d.changeSummary) return null;
                if (d.isPointMode) {
                  return (
                    <>
                      <Text style={styles.labelTitleText}>
                        <Text
                          style={[
                            styles.labelTitleText,
                            {color: SUMMER_COLORS.accent},
                          ]}>
                          {d.changeSummary.amount.toLocaleString()}
                          {d.changeSummary.unit}
                        </Text>
                        이
                      </Text>
                      <Text style={styles.labelTitleText}>
                        {d.changeSummary.type === 'earn'
                          ? '적립되었습니다.'
                          : '사용되었습니다.'}
                      </Text>
                    </>
                  );
                }
                return (
                  <>
                    <Text style={styles.labelTitleText}>
                      <Text
                        style={[
                          styles.labelTitleText,
                          {color: SUMMER_COLORS.accent},
                        ]}>
                        {d.changeSummary.type === 'earn'
                          ? `스탬프 ${d.changeSummary.amount}개`
                          : `쿠폰 ${d.changeSummary.amount}장`}
                      </Text>
                      {d.changeSummary.type === 'earn' ? '가' : '이'}
                    </Text>
                    <Text style={styles.labelTitleText}>
                      {d.changeSummary.type === 'earn'
                        ? '적립되었습니다.'
                        : '사용되었습니다.'}
                    </Text>
                  </>
                );
              })()}
            </View>
            <View style={styles.labelBox}>
              <Text
                style={[styles.labelTitleText, {color: SUMMER_COLORS.accent}]}>
                감사합니다
              </Text>
              <Text style={styles.labelSubText}>
                <Text
                  style={[
                    styles.labelSubText,
                    {width: 24, fontFamily: f.semibold},
                  ]}>
                  {d.timeLeft}
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
            <Pressable style={[styles.flexBox, {gap: 7}]} onPress={d.goBack}>
              <LeftArrowIcon color={SUMMER_COLORS.primary} />
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: f.regular,
                  color: SUMMER_COLORS.primary,
                  lineHeight: 28,
                  letterSpacing: -1,
                }}>
                뒤로가기
              </Text>
            </Pressable>
            <View style={styles.labelBox}>
              {d.levelInfo && d.user && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: d.levelInfo.bgColor,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    alignSelf: 'flex-start',
                    gap: 6,
                    marginBottom: 4,
                  }}>
                  <Text style={{fontSize: 16}}>{d.levelInfo.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: f.semibold,
                      fontSize: 14,
                      color: d.levelInfo.color,
                      letterSpacing: -0.3,
                    }}>
                    {d.levelInfo.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: f.regular,
                      fontSize: 12,
                      color: d.levelInfo.color,
                      opacity: 0.7,
                    }}>
                    Lv.{d.user.level}
                  </Text>
                </View>
              )}
              <Text style={styles.labelSubText}>
                <Text
                  style={[
                    styles.labelSubText,
                    {
                      color: SUMMER_COLORS.accent,
                      fontFamily: 'SFUIDisplay-Semibold',
                    },
                  ]}>
                  {d.phoneNumberLabel()}
                </Text>
                {' 님 반갑습니다.'}
              </Text>
              <Text style={styles.labelTitleText}>{d.lastVisitMessage}</Text>
              {d.timeLeft < 10 && (
                <Text>
                  <Text
                    style={[
                      styles.labelSubText,
                      {width: 24, fontFamily: f.semibold},
                    ]}>
                    {d.timeLeft}
                  </Text>{' '}
                  초 후 화면이 종료됩니다
                </Text>
              )}
            </View>
            <View style={styles.beverageWrapper}>
              {d.isPointMode
                ? d.user && (
                    <View style={styles.beverageBox}>
                      <View>
                        <Text style={styles.beverageTitleText}>
                          💰 보유 포인트
                        </Text>
                        <Text style={styles.beverageBodyText}>
                          {d.user.stamps.toLocaleString()}
                          {d.storeConfig.pointUnit} 사용 가능
                        </Text>
                      </View>
                    </View>
                  )
                : d.availableCoupons.map((c: any) => (
                    <View key={c.id} style={styles.beverageBox}>
                      <View>
                        <Text style={styles.beverageTitleText}>
                          🎫 {c.name} {c.count}장 무료로 사용 가능해요!
                        </Text>
                        <Text style={styles.beverageBodyText}>
                          {c.expiry
                            ? `${c.expiry}까지 사용 가능`
                            : `스탬프 ${d.storeConfig.stampsPerCoupon}개 소진`}
                        </Text>
                      </View>
                    </View>
                  ))}
            </View>
          </View>
        )}

        {/* Right: Stamp Card */}
        <View
          style={[
            styles.flexColumnBox,
            {justifyContent: 'flex-end'},
          ]}>
          <StampCard
            user={d.user}
            isPointMode={d.isPointMode}
            storeConfig={d.storeConfig}
          />
        </View>
      </View>
    </View>
  );
};

// --- Overlay ---
const OverlayRenderer = ({
  context,
  getCouponName,
  dismissOverlay,
}: {
  context: {show: boolean; type: string; dStamp: 'one' | 'two' | 'coupon'};
  getCouponName: (id: string) => string | undefined;
  dismissOverlay: () => void;
}) => {
  const couponName = getCouponName(context.type);

  if (context.dStamp === 'one') {
    return (
      <StampNearOverlay
        show={context.show}
        remaining={1}
        couponName={couponName}
      />
    );
  } else if (context.dStamp === 'two') {
    return (
      <StampNearOverlay
        show={context.show}
        remaining={2}
        couponName={couponName}
      />
    );
  } else if (context.dStamp === 'coupon') {
    return (
      <CouponEarnedOverlay
        show={context.show}
        onDismiss={dismissOverlay}
        couponName={couponName}
      />
    );
  }
  return null;
};

// --- Main Component ---
const DashboardView = ({phoneNumber, onClose}: DashboardViewProps) => {
  const deviceType = useDeviceType();
  const d = useDashboard(phoneNumber, onClose);

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
        {deviceType === 'phone' ? (
          <PhoneLayout d={d} />
        ) : (
          <TabletLayout d={d} />
        )}
      </SafeAreaView>
      <OverlayRenderer
        context={d.overlayContext}
        getCouponName={d.getCouponName}
        dismissOverlay={d.dismissOverlay}
      />
    </LinearGradient>
  );
};

// --- Shared Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundStyle: {
    flex: 1,
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
    alignItems: 'flex-end',
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
  labelTitleText: {
    fontSize: 32,
    fontFamily: f.medium,
    lineHeight: 45,
    letterSpacing: -1,
    color: SUMMER_COLORS.primary,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: f.regular,
    lineHeight: 28,
    letterSpacing: -1,
    color: c.texticon.onNormal.highemp,
  },
  stampLeftText: {
    fontSize: 76,
    fontFamily: f.medium,
    lineHeight: 86,
    letterSpacing: -1,
    color: SUMMER_COLORS.accent,
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
    marginTop: 40,
  },
  beverageBox: {
    width: '100%',
    height: 98,
    backgroundColor: p.blue[50],
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
    fontFamily: f.medium,
    color: SUMMER_COLORS.primary,
    letterSpacing: -1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highemp,
    letterSpacing: -1,
  },
});

// --- Phone Styles ---
const phoneSt = StyleSheet.create({
  scrollContent: {
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  backText: {
    fontSize: 16,
    fontFamily: f.regular,
    color: SUMMER_COLORS.primary,
    letterSpacing: -0.5,
  },
  timerText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },
  userInfo: {
    gap: 6,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 2,
  },
  levelName: {
    fontFamily: f.semibold,
    fontSize: 12,
    letterSpacing: -0.3,
  },
  levelNum: {
    fontFamily: f.regular,
    fontSize: 10,
    opacity: 0.7,
  },
  welcomeText: {
    fontSize: 16,
    fontFamily: f.regular,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: c.texticon.onNormal.highemp,
  },
  visitText: {
    fontSize: 24,
    fontFamily: f.medium,
    lineHeight: 34,
    letterSpacing: -1,
    color: SUMMER_COLORS.primary,
  },
  changeBanner: {
    backgroundColor: p.blue[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: p.blue[100],
  },
  changeBannerText: {
    fontSize: 16,
    fontFamily: f.regular,
    color: SUMMER_COLORS.primary,
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  infoSection: {
    gap: 10,
  },
  infoCard: {
    backgroundColor: p.blue[50],
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 2,
  },
  infoTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: f.medium,
    color: SUMMER_COLORS.primary,
    letterSpacing: -0.5,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highemp,
    letterSpacing: -0.5,
  },
  timerBanner: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  timerBannerText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },
});

export default DashboardView;
