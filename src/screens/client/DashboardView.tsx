import React from 'react';
import {ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLayoutMode} from '../../hooks';
import {
  semanticColors as c,
  primitives as p,
  fontFamily as f,
} from '../../theme';
import {
  LevelPill,
  PointHeroCard,
  StampHeroCard,
  CouponList,
  PointHistoryList,
  RewardChips,
} from './dashboard';
import {useDashboard} from './useDashboard';

/** hero 카드는 아래 리스트보다 넓게 흐른다 (디자인상 의도된 블리드) */
const HERO_MAX_WIDTH = 430;
const SECTION_MAX_WIDTH = 350;

type DashboardViewProps = {
  phoneNumber: string;
  onClose: () => void;
};

/**
 * 고객이 번호를 입력한 뒤 뜨는 조회 화면.
 *
 * 화면은 세 덩어리로만 이뤄진다 — 무슨 일이 일어났는지 말하는 상단 문구,
 * 현재 상태를 보여주는 파란 카드, 그리고 가진 것들의 목록.
 * 적립은 관리자 쪽에서 일어나고 여기는 그 결과를 실시간으로 받아 비추기만 한다.
 */
const DashboardView = ({phoneNumber, onClose}: DashboardViewProps) => {
  const {isExpanded} = useLayoutMode();
  const d = useDashboard(phoneNumber, onClose);
  // 적립/사용이 일어난 뒤에만 "곧 닫힌다"고 알린다. 조회만 하는 동안은
  // 카운트다운이 재촉으로 읽혀서 굳이 띄우지 않는다.
  const showCountdown = !!d.changeSummary;

  return (
    <View style={s.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={c.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={s.safe}>
        <View style={s.headerBar}>
          {showCountdown && (
            <View style={s.timerChip}>
              <Text style={s.timerChipText}>
                <Text style={s.timerChipNum}>{d.timeLeft}</Text>초 뒤 화면이
                전환됩니다.
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}>
          <View style={s.topChrome}>
            {d.storeName ? (
              <Text style={s.storeName}>{d.storeName}</Text>
            ) : null}
            <View style={{gap: 0, alignItems: 'center'}}>
              <Text style={s.headline}>{d.headline}</Text>
              {d.subline ? <Text style={s.subline}>{d.subline}</Text> : null}
            </View>
            {/* 결과를 말하는 중엔 레벨 뱃지가 시선을 나눠 가져간다 */}
            {!d.changeSummary && d.levelInfo && d.user && (
              <LevelPill
                level={d.user.level}
                name={d.levelInfo.name}
                emoji={d.levelInfo.emoji}
              />
            )}
          </View>

          <View style={s.heroSlot}>
            {d.isPointMode ? (
              <PointHeroCard
                points={d.user?.stamps ?? 0}
                unit={d.storeConfig.pointUnit}
                delta={
                  d.changeSummary?.type === 'earn' ? d.changeSummary.amount : 0
                }
                expanded={isExpanded}
              />
            ) : (
              <StampHeroCard
                capacity={d.stampCapacity}
                filled={d.filledStamps}
                expanded={isExpanded}
              />
            )}
          </View>

          {!d.isPointMode &&
            d.isMultiReward &&
            d.rewards.current &&
            d.rewards.next && (
              <View style={s.sectionSlot}>
                <RewardChips
                  current={d.rewards.current}
                  next={d.rewards.next}
                />
              </View>
            )}

          <View style={s.sectionSlot}>
            {d.isPointMode ? (
              <PointHistoryList
                logs={d.recentLogs}
                unit={d.storeConfig.pointUnit}
              />
            ) : (
              <CouponList
                entries={d.couponEntries}
                expiryDays={d.storeConfig.couponExpiryDays}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: c.surface.normal.bg1},
  safe: {flex: 1},
  scroll: {flex: 1},

  // 카운트다운 칩만 사는 줄. 비어 있어도 높이를 잡아 상단 여백을 고정한다.
  headerBar: {
    minHeight: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  timerChip: {
    backgroundColor: p.slate[100],
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  timerChipText: {
    fontSize: 13,
    fontFamily: f.regular,
    color: p.gray[500],
    letterSpacing: -0.3,
  },
  timerChipNum: {fontFamily: f.semibold, color: p.gray[900]},

  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },

  topChrome: {alignItems: 'center', gap: 8},
  storeName: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headline: {
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.8,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 32,
  },
  subline: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: f.regular,
    color: p.gray[500],
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  heroSlot: {width: '100%', maxWidth: HERO_MAX_WIDTH, marginBottom: 20},
  sectionSlot: {width: '100%', maxWidth: SECTION_MAX_WIDTH},
});

export default DashboardView;
