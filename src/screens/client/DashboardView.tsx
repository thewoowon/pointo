import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLayoutMode} from '../../hooks';
import {
  semanticColors as c,
  primitives as p,
  fontFamily as f,
} from '../../theme';
import {LeftArrowIcon} from '../../components/Icons';
import {StampNearOverlay, CouponEarnedOverlay} from '../../components/overlay';
import {STAMP_ICONS} from '../../components/decorations';
import {useDashboard} from './useDashboard';

const BRAND = c.surface.brand.primary;
const WHITE = c.etc.absolute.white;

type DashboardViewProps = {
  phoneNumber: string;
  onClose: () => void;
};

// i로부터 결정론적 유사난수(0~1). 지터/회전/크기 변주에 사용 — 매 렌더 동일.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// 해바라기 나선의 황금각(≈137.5°). 중심에서 바깥으로 고르게 퍼지는 핵심.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 스탬프 아이콘을 카드 하단 중심에서 바깥으로 퍼지듯(center-out) 채우는 장식 필드.
 * 단일 원(ring)이 아니라 phyllotaxis(해바라기 나선) 분포라, 스탬프 수(capacity)가
 * 적으면 중앙에 뭉치고 많으면 카드를 꽉 채운다 — 가운데가 비어 보이지 않음.
 * 적립 수(filled)만큼만 중심→제자리로 stagger bloom 시킨다.
 */
const HeroStampField = ({
  filled,
  capacity,
  topInset,
}: {
  filled: number;
  capacity: number;
  /** 전경 콘텐츠 높이 — 필드를 이만큼 아래로 내려 텍스트와 겹치지 않게 */
  topInset: number;
}) => {
  const [box, setBox] = useState({w: 0, h: 0});
  // capacity개의 애니메이션 값을 안정적으로 유지 (참조 고정)
  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== capacity) {
    animsRef.current = Array.from(
      {length: Math.max(capacity, 0)},
      (_, i) => animsRef.current[i] ?? new Animated.Value(0),
    );
  }

  const shown = Math.min(Math.max(filled, 0), capacity);

  useEffect(() => {
    if (box.w === 0 || shown === 0) return;
    const anims = animsRef.current.slice(0, shown);
    anims.forEach(v => v.setValue(0));
    const seq = anims.map(v =>
      Animated.spring(v, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 55,
      }),
    );
    // 55ms씩 어긋나게 시작해 "중심에서 퍼져나가는" 인상을 준다.
    Animated.stagger(55, seq).start();
  }, [shown, box.w, box.h]);

  if (capacity <= 0) return null;

  // box는 topInset 아래의 하단 영역. 그 영역의 중심에서 바깥으로 채운다.
  const cx = box.w / 2;
  const cy = box.h / 2;
  // 개수가 많을수록 아이콘을 작게 (겹침 방지)
  const baseSize = Math.max(26, Math.min(50, 150 / Math.sqrt(capacity)));
  // 채움 비율 — 1.0이면 영역 가장자리까지, >1이면 살짝 잘리며 꽉 참
  const FILL = 1.05;

  return (
    <View
      style={[s.heroIconLayer, {top: topInset}]}
      pointerEvents="none"
      onLayout={e => {
        const {width, height} = e.nativeEvent.layout;
        setBox(prev =>
          prev.w === width && prev.h === height ? prev : {w: width, h: height},
        );
      }}>
      {box.w > 0 &&
        Array.from({length: shown}).map((_, i) => {
          const Icon = STAMP_ICONS[i % STAMP_ICONS.length];
          const angle = i * GOLDEN_ANGLE + (hash(i + 100) - 0.5) * 0.5;
          // capacity로 정규화한 반지름(0~1) → 개수 대비 항상 알맞게 퍼짐
          const rNorm = Math.min(
            Math.sqrt(i + 0.5) / Math.sqrt(capacity) + (hash(i) - 0.5) * 0.1,
            1.05,
          );
          // 영역 종횡비에 맞춘 타원형 채움 — 가로로 넓은 하단을 꽉 채운다
          const tx = cx + rNorm * (box.w / 2) * FILL * Math.cos(angle);
          const ty = cy + rNorm * (box.h / 2) * FILL * Math.sin(angle);
          const rot = (hash(i + 200) - 0.5) * 36;
          const size = baseSize * (0.85 + hash(i + 300) * 0.3);
          const v = animsRef.current[i];
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: tx - size / 2,
                top: ty - size / 2,
                opacity: v.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [0, 0.9, 0.9],
                }),
                transform: [
                  {
                    translateX: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [cx - tx, 0],
                    }),
                  },
                  {
                    translateY: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [cy - ty, 0],
                    }),
                  },
                  {
                    scale: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 1],
                    }),
                  },
                  {rotate: `${rot}deg`},
                ],
              }}>
              <Icon size={size} color={WHITE} />
            </Animated.View>
          );
        })}
    </View>
  );
};

// ─── Blue hero card ──────────────────────────────────────────
const HeroCard = ({
  d,
  expanded,
}: {
  d: ReturnType<typeof useDashboard>;
  expanded: boolean;
}) => {
  const {user, isPointMode, storeConfig, levelInfo} = d;
  const last4 = d.phoneNumber ? d.phoneNumber.slice(-4) : '';
  const filled = user ? user.stamps % storeConfig.stampsPerCoupon : 0;
  const numFont = expanded ? 64 : 52;
  const numLine = expanded ? 72 : 60;
  // 전경 텍스트 높이 — 아이콘 필드를 이 아래로 밀어내기 위해 측정
  const [contentH, setContentH] = useState(0);

  return (
    <View style={[s.hero, expanded && s.heroExpanded]}>
      {/* 배경 아이콘 채움 (스탬프 모드) — 콘텐츠 아래에서 바깥으로 퍼지며 bloom */}
      {!isPointMode && (
        <HeroStampField
          filled={filled}
          capacity={storeConfig.stampsPerCoupon}
          topInset={contentH}
        />
      )}

      {/* 전경 콘텐츠 */}
      <View
        style={s.heroContent}
        onLayout={e => {
          // 카드 패딩 오프셋 포함한 콘텐츠 실제 하단 + 여백
          const {y, height} = e.nativeEvent.layout;
          setContentH(y + height + 8);
        }}>
        <View style={s.heroTopRow}>
          <Text style={s.heroGreeting}>
            <Text style={s.heroGreetingName}>{last4}</Text>님 안녕하세요
          </Text>
          {levelInfo && user && (
            <View style={s.levelPill}>
              <Text style={{fontSize: 12}}>{levelInfo.emoji}</Text>
              <Text style={s.levelPillText}>{levelInfo.name}</Text>
              <Text style={s.levelPillLv}>Lv.{user.level}</Text>
            </View>
          )}
        </View>

        {isPointMode ? (
          <>
            <Text style={s.heroLabel}>현재 보유 포인트</Text>
            <View style={s.heroValueRow}>
              <Text
                style={[
                  s.heroNumber,
                  {fontSize: numFont, lineHeight: numLine},
                ]}>
                {user ? user.stamps.toLocaleString() : 0}
              </Text>
              <Text style={s.heroUnit}>{storeConfig.pointUnit}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.heroLabel}>다음 무료 쿠폰까지</Text>
            <View style={s.heroValueRow}>
              <Text
                style={[
                  s.heroNumber,
                  {fontSize: numFont, lineHeight: numLine},
                ]}>
                {filled}
              </Text>
              <Text style={s.heroUnit}>/ {storeConfig.stampsPerCoupon}개</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

// ─── Available coupons / point ───────────────────────────────
const RewardSection = ({d}: {d: ReturnType<typeof useDashboard>}) => {
  if (d.isPointMode) {
    if (!d.user) return null;
    return (
      <View style={s.rewardSection}>
        <Text style={s.rewardTitle}>사용 가능 포인트</Text>
        <View style={s.rewardCard}>
          <Text style={s.rewardName}>💰 보유 포인트</Text>
          <Text style={s.rewardMeta}>
            {d.user.stamps.toLocaleString()}
            {d.storeConfig.pointUnit} 사용 가능
          </Text>
        </View>
      </View>
    );
  }

  const coupons = d.availableCoupons;
  return (
    <View style={s.rewardSection}>
      <Text style={s.rewardTitle}>사용 가능한 쿠폰</Text>
      {coupons.length > 0 ? (
        coupons.map((coupon: any) => (
          <View key={coupon.id} style={s.rewardCard}>
            <Text style={s.rewardName}>
              🎫 {coupon.name}
              <Text style={s.rewardCount}> {coupon.count}장</Text>
            </Text>
            <Text style={s.rewardMeta}>
              {coupon.expiry
                ? `${coupon.expiry}까지 사용 가능`
                : '무료로 사용 가능해요'}
            </Text>
          </View>
        ))
      ) : (
        <View style={[s.rewardCard, s.rewardEmpty]}>
          <Text style={s.rewardEmptyText}>
            조금만 더 모으면 무료 쿠폰이 나와요
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Overlay (적립 순간 연출) ─────────────────────────────────
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
        onDismiss={dismissOverlay}
      />
    );
  }
  if (context.dStamp === 'two') {
    return (
      <StampNearOverlay
        show={context.show}
        remaining={2}
        couponName={couponName}
        onDismiss={dismissOverlay}
      />
    );
  }
  if (context.dStamp === 'coupon') {
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

// 적립/사용 헤드라인 — 관리자가 실제로 적립했을 때(변화)만 노출
const buildHeadline = (d: ReturnType<typeof useDashboard>): string | null => {
  const cs = d.changeSummary;
  if (!cs) return null;
  if (d.isPointMode) {
    const amt = `${cs.amount.toLocaleString()}${cs.unit}`;
    return cs.type === 'earn'
      ? `${amt} 적립되었습니다`
      : `${amt} 사용되었습니다`;
  }
  return cs.type === 'earn'
    ? `스탬프 ${cs.amount}개가 적립되었습니다`
    : `쿠폰 ${cs.amount}장을 사용했습니다`;
};

// ─── Main ────────────────────────────────────────────────────
const DashboardView = ({phoneNumber, onClose}: DashboardViewProps) => {
  const {isExpanded} = useLayoutMode();
  const d = useDashboard(phoneNumber, onClose);
  const headline = buildHeadline(d);

  return (
    <View style={s.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={c.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={{flex: 1}}>
        {/* Header bar: 뒤로가기 + 카운트다운 */}
        <View style={s.headerBar}>
          <Pressable style={s.backButton} onPress={d.goBack} hitSlop={8}>
            <LeftArrowIcon color={c.texticon.onNormal.highestemp} />
            <Text style={s.backText}>뒤로가기</Text>
          </Pressable>
          {d.timeLeft < 15 && (
            <View style={s.timerChip}>
              <Text style={s.timerChipText}>
                <Text style={s.timerChipNum}>{d.timeLeft}</Text>초
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={[s.content, isExpanded && s.contentExpanded]}
          showsVerticalScrollIndicator={false}>
          {/* Top chrome: 상호명 + (조건부) 적립 헤드라인 */}
          <View style={s.topChrome}>
            {d.storeName ? (
              <Text style={s.storeName}>{d.storeName}</Text>
            ) : null}
            {headline && (
              <Text style={[s.headline, {fontSize: isExpanded ? 24 : 20}]}>
                {headline}
              </Text>
            )}
          </View>

          {/* Blue hero card */}
          <HeroCard d={d} expanded={isExpanded} />

          {/* 사용 가능한 쿠폰 / 포인트 */}
          <RewardSection d={d} />

          {/* Bottom timer */}
          <View style={s.bottomTimer}>
            <Text style={s.bottomTimerText}>
              <Text style={s.bottomTimerNum}>{d.timeLeft}</Text>초 후 화면이
              종료됩니다
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <OverlayRenderer
        context={d.overlayContext}
        getCouponName={d.getCouponName}
        dismissOverlay={d.dismissOverlay}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: c.surface.normal.bg1},

  // Header bar
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {flexDirection: 'row', alignItems: 'center', gap: 6},
  backText: {
    fontSize: 16,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highestemp,
    letterSpacing: -0.5,
  },
  timerChip: {
    backgroundColor: p.gray[100],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  timerChipText: {
    fontSize: 13,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },
  timerChipNum: {fontFamily: f.semibold, color: c.texticon.onNormal.highemp},

  // Content
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  contentExpanded: {maxWidth: 480},

  // Top chrome
  topChrome: {alignItems: 'center', gap: 10},
  storeName: {
    fontSize: 15,
    fontFamily: f.medium,
    color: c.texticon.onNormal.lowemp,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headline: {
    fontFamily: f.bold,
    color: c.texticon.onNormal.highestemp,
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
  },

  // Hero card
  hero: {
    width: '100%',
    minHeight: 493,
    borderRadius: 28,
    backgroundColor: BRAND,
    paddingHorizontal: 26,
    paddingVertical: 32,
    overflow: 'hidden',
    shadowColor: BRAND,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 6,
  },
  heroExpanded: {minHeight: 493, padding: 36},
  heroIconLayer: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  heroContent: {gap: 6},
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heroGreeting: {
    fontSize: 16,
    fontFamily: f.medium,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.5,
  },
  heroGreetingName: {fontFamily: 'SFUIDisplay-Semibold', color: WHITE},
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  levelPillText: {
    fontFamily: f.semibold,
    fontSize: 12,
    color: WHITE,
    letterSpacing: -0.3,
  },
  levelPillLv: {
    fontFamily: f.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  heroLabel: {
    marginTop: 6,
    fontSize: 15,
    fontFamily: f.regular,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: -0.3,
  },
  heroValueRow: {flexDirection: 'row', alignItems: 'baseline', gap: 10},
  heroNumber: {
    fontFamily: 'SFUIDisplay-Semibold',
    color: WHITE,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 22,
    fontFamily: f.medium,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.5,
  },

  // Reward section
  rewardSection: {gap: 10},
  rewardTitle: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: c.texticon.onNormal.highemp,
    letterSpacing: -0.5,
    marginLeft: 2,
  },
  rewardCard: {
    backgroundColor: p.blue[50],
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 4,
  },
  rewardName: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: f.medium,
    color: c.texticon.onNormal.highestemp,
    letterSpacing: -0.5,
  },
  rewardCount: {color: BRAND, fontFamily: f.semibold},
  rewardMeta: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
    letterSpacing: -0.3,
  },
  rewardEmpty: {backgroundColor: p.gray[100], alignItems: 'center'},
  rewardEmptyText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
    letterSpacing: -0.3,
  },

  // Bottom timer
  bottomTimer: {alignItems: 'center', paddingVertical: 4},
  bottomTimerText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },
  bottomTimerNum: {fontFamily: f.semibold, color: c.texticon.onNormal.highemp},
});

export default DashboardView;
