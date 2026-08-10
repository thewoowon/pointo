import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import {
  useAuth,
  useFirestore,
  useStoreConfig,
  useDeviceType,
  useTheme,
} from '../../hooks';
import type {Theme} from '../../theme';
import {useFocusEffect} from '@react-navigation/native';
import {
  computePortfolioKpis,
  fmtFloat,
  fmtInt,
  fmtPct,
  PortfolioKpis,
} from '../../analytics/kpis';

type Period = 'today' | '7days' | '30days' | 'month';

type DayStat = {
  date: string;
  saved: number;
  used: number;
};

type HourStat = {
  label: string;
  count: number;
};

const PERIOD_TABS: {label: string; value: Period}[] = [
  {label: '오늘', value: 'today'},
  {label: '7일', value: '7days'},
  {label: '30일', value: '30days'},
  {label: '이번달', value: 'month'},
];

const HOUR_BLOCKS: {label: string; from: number; to: number}[] = [
  {label: '6~9시', from: 6, to: 9},
  {label: '9~12시', from: 9, to: 12},
  {label: '12~15시', from: 12, to: 15},
  {label: '15~18시', from: 15, to: 18},
  {label: '18~21시', from: 18, to: 21},
  {label: '21시~', from: 21, to: 24},
];

const StatisticsScreen = ({navigation}: any) => {
  const theme = useTheme();
  const c = theme.color;
  const pal = theme.palette;
  const f = theme.font;
  // 단일 브랜드 액센트 (차트/활성 상태에만 절제해서 사용)
  const ACCENT = c.surface.brand.primary;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {StatCard, KpiCard, SummaryItem} = useMemo(
    () => createSubComponents(styles),
    [styles],
  );
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPhone = useDeviceType() === 'phone';
  const {
    getStores,
    getUserCount,
    getLogsInRange,
    getAllUsers,
    getAllLogs,
  } = useFirestore(storeCode);

  const isPoint = storeConfig.mode === 'point';
  const rewardLabel = isPoint ? '포인트' : '스탬프';
  const rewardUnit = isPoint ? storeConfig.pointUnit : '개';

  const [period, setPeriod] = useState<Period>('today');
  const [storeName, setStoreName] = useState<string>('');
  const [memberCount, setMemberCount] = useState<number>(0);
  const [todaySaved, setTodaySaved] = useState<number>(0);
  const [todayUsed, setTodayUsed] = useState<number>(0);
  const [todayVisitors, setTodayVisitors] = useState<number>(0);
  const [periodStats, setPeriodStats] = useState<DayStat[]>([]);
  const [hourStats, setHourStats] = useState<HourStat[]>([]);
  const [todayVisitorList, setTodayVisitorList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<PortfolioKpis | null>(null);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [kpiLastLoaded, setKpiLastLoaded] = useState<string>('');

  const getDateRange = (p: Period): {start: string; end: string} => {
    const today = dayjs().format('YYYY-MM-DD');
    if (p === 'today') return {start: today, end: today};
    if (p === '7days')
      return {start: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), end: today};
    if (p === '30days')
      return {start: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), end: today};
    return {
      start: dayjs().startOf('month').format('YYYY-MM-DD'),
      end: today,
    };
  };

  const loadData = useCallback(
    async (p: Period) => {
      if (!storeCode) return;
      setIsLoading(true);
      try {
        const {start, end} = getDateRange(p);
        const [storeInfo, count, logs] = await Promise.all([
          getStores(storeCode),
          getUserCount(),
          getLogsInRange(start, end),
        ]);

        setStoreName((storeInfo as any)?.name ?? storeCode);
        setMemberCount(count);

        // 오늘 기준 집계 (항상)
        const today = dayjs().format('YYYY-MM-DD');
        const todayLogs = logs.filter(
          l => dayjs(l.timestamp).format('YYYY-MM-DD') === today,
        );
        const todaySavedLogs = todayLogs.filter(l => l.action === 'stamp_saved');
        const todayUsedLogs = todayLogs.filter(l => l.action === 'stamp_used');
        if (isPoint) {
          setTodaySaved(todaySavedLogs.reduce((s, l) => s + (Number(l.stamp) || 0), 0));
          setTodayUsed(todayUsedLogs.reduce((s, l) => s + (Number(l.stamp) || 0), 0));
        } else {
          setTodaySaved(todaySavedLogs.length);
          setTodayUsed(todayUsedLogs.length);
        }
        const uniquePhones = [...new Set(todayLogs.map(l => l.phone_number))];
        setTodayVisitors(uniquePhones.length);
        setTodayVisitorList(uniquePhones);

        // 시간대별 차트 (오늘 기준)
        setHourStats(
          HOUR_BLOCKS.map(block => ({
            label: block.label,
            count: todayLogs.filter(l => {
              const h = dayjs(l.timestamp).hour();
              return h >= block.from && h < block.to;
            }).length,
          })),
        );

        // 기간 일별 통계
        const dayCount =
          p === 'today'
            ? 1
            : p === '7days'
            ? 7
            : p === '30days'
            ? 30
            : dayjs().date();

        const stats: DayStat[] = Array.from({length: dayCount}, (_, i) => {
          const d =
            p === 'month'
              ? dayjs().startOf('month').add(i, 'day')
              : dayjs().subtract(dayCount - 1 - i, 'day');
          const key = d.format('YYYY-MM-DD');
          const dayLogs = logs.filter(
            l => dayjs(l.timestamp).format('YYYY-MM-DD') === key,
          );
          const savedLogs = dayLogs.filter(l => l.action === 'stamp_saved');
          const usedLogs = dayLogs.filter(l => l.action === 'stamp_used');
          return {
            date: d.format('M/D'),
            saved: isPoint
              ? savedLogs.reduce((s, l) => s + (Number(l.stamp) || 0), 0)
              : savedLogs.length,
            used: isPoint
              ? usedLogs.reduce((s, l) => s + (Number(l.stamp) || 0), 0)
              : usedLogs.length,
          };
        });
        setPeriodStats(stats);
      } finally {
        setIsLoading(false);
      }
    },
    [storeCode],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(period);
    }, [loadData, period]),
  );

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    loadData(p);
  };

  const loadKpis = useCallback(async () => {
    setIsLoadingKpis(true);
    try {
      const [users, logs] = await Promise.all([getAllUsers(), getAllLogs()]);
      const sorted = [...storeConfig.levelTiers].sort((a, b) => a.maxLevel - b.maxLevel);
      const loyalLevelThreshold = sorted.length >= 3 ? sorted[1].maxLevel + 1 : 4;
      setKpis(computePortfolioKpis(users, logs, {
        stampsPerCoupon: storeConfig.stampsPerCoupon,
        loyalLevelThreshold,
      }));
      setKpiLastLoaded(dayjs().format('YYYY-MM-DD HH:mm'));
    } finally {
      setIsLoadingKpis(false);
    }
  }, [getAllUsers, getAllLogs]);

  const totalSaved = periodStats.reduce((s, d) => s + d.saved, 0);
  const totalUsed = periodStats.reduce((s, d) => s + d.used, 0);
  const maxHour = Math.max(...hourStats.map(h => h.count), 1);

  // 30일/이번달은 주별로 묶어서 표시
  const chartStats =
    period === '30days' || period === 'month'
      ? (() => {
          const weeks: DayStat[] = [];
          for (let i = 0; i < periodStats.length; i += 7) {
            const chunk = periodStats.slice(i, i + 7);
            weeks.push({
              date: chunk[0].date,
              saved: chunk.reduce((s, d) => s + d.saved, 0),
              used: chunk.reduce((s, d) => s + d.used, 0),
            });
          }
          return weeks;
        })()
      : periodStats;
  const chartMax = Math.max(...chartStats.map(s => s.saved), 1);

  const peakHour = hourStats.reduce(
    (max, h) => (h.count > max.count ? h : max),
    {label: '', count: 0},
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={c.surface.normal.bg1} translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        {/* 헤더 — Switcher 기준 (투명 · 중앙 타이틀) */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>통계</Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={() => loadData(period)} hitSlop={8}>
            <Text style={styles.refreshText}>새로고침</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 회원 요약 */}
            <View style={styles.storeInfoRow}>
              <View style={{flex: 1}}>
                <Text style={styles.storeNameLine}>{storeName}</Text>
                <Text style={styles.memberBadgeLabel}>총 회원</Text>
                <Text style={styles.memberCountLarge}>
                  {memberCount.toLocaleString()}
                  <Text style={styles.memberCountUnit}> 명</Text>
                </Text>
              </View>
            </View>

            {/* ─── 종합 성과 (포트폴리오 섹션) ─── */}
            <View style={styles.kpiSection}>
              <View style={styles.kpiHeader}>
                <View style={{flex: 1, paddingRight: 12}}>
                  <Text style={styles.kpiTitle}>종합 성과</Text>
                  <Text style={styles.kpiSubtitle}>
                    {kpiLastLoaded
                      ? `마지막 집계 ${kpiLastLoaded}`
                      : '버튼을 눌러 전체 데이터를 집계합니다'}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.kpiLoadBtn,
                    isLoadingKpis && styles.kpiLoadBtnDisabled,
                  ]}
                  onPress={loadKpis}
                  disabled={isLoadingKpis}>
                  {isLoadingKpis ? (
                    <ActivityIndicator size="small" color={c.etc.absolute.white} />
                  ) : (
                    <Text style={styles.kpiLoadBtnText}>
                      {kpis ? '다시 집계' : '집계 시작'}
                    </Text>
                  )}
                </Pressable>
              </View>

              {kpis && (
                <>
                  {/* 규모 */}
                  <Text style={styles.kpiGroupLabel}>규모</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="누적 가입자"
                      value={fmtInt(kpis.totalUsers)}
                      unit="명"
                    />
                    <KpiCard
                      label={`누적 ${rewardLabel}`}
                      value={fmtInt(kpis.totalStampsEarned)}
                      unit={rewardUnit}
                    />
                  </View>

                  {/* 활성도 */}
                  <Text style={styles.kpiGroupLabel}>활성도</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="DAU"
                      value={fmtInt(kpis.dau)}
                      unit="명"
                      subtitle="최근 1일"
                    />
                    <KpiCard
                      label="WAU"
                      value={fmtInt(kpis.wau)}
                      unit="명"
                      subtitle="최근 7일"
                    />
                    <KpiCard
                      label="MAU"
                      value={fmtInt(kpis.mau)}
                      unit="명"
                      subtitle="최근 30일"
                    />
                  </View>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="평균 방문 빈도"
                      value={fmtFloat(kpis.avgVisitsPerUser, 1)}
                      unit="회/인"
                    />
                    <KpiCard
                      label="재방문율 (D7)"
                      value={fmtPct(kpis.retention7d)}
                      unit=""
                      subtitle={`n=${fmtInt(kpis.retention7dSampleSize)}`}
                    />
                  </View>

                  {/* 리워드 */}
                  {!isPoint && (
                    <>
                      <Text style={styles.kpiGroupLabel}>리워드</Text>
                      <View style={styles.kpiCardRow}>
                        <KpiCard
                          label="쿠폰 발행"
                          value={fmtInt(kpis.totalCouponsIssued)}
                          unit="장"
                        />
                        <KpiCard
                          label="쿠폰 사용"
                          value={fmtInt(kpis.totalCouponsRedeemed)}
                          unit="장"
                        />
                        <KpiCard
                          label="사용률"
                          value={fmtPct(kpis.couponRedemptionRate)}
                          unit=""
                        />
                      </View>
                    </>
                  )}

                  {/* 로열티 */}
                  <Text style={styles.kpiGroupLabel}>로열티</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="충성 고객 (Lv.4↑)"
                      value={fmtPct(kpis.loyalRatio)}
                      unit=""
                      subtitle={`${fmtInt(kpis.loyalCount)}명`}
                    />
                    <KpiCard
                      label="활성 유저"
                      value={fmtPct(kpis.activeRatio)}
                      unit=""
                      subtitle={`${fmtInt(kpis.activeCount)}명`}
                    />
                    <KpiCard
                      label="이탈 유저 (30d+)"
                      value={fmtPct(kpis.churnedRatio)}
                      unit=""
                      subtitle={`${fmtInt(kpis.churnedCount)}명`}
                    />
                  </View>
                </>
              )}
            </View>

            {/* 기간 탭 */}
            <View style={styles.tabRow}>
              {PERIOD_TABS.map(tab => (
                <Pressable
                  key={tab.value}
                  style={[
                    styles.tab,
                    period === tab.value && styles.tabActive,
                  ]}
                  onPress={() => handlePeriod(tab.value)}>
                  <Text
                    style={[
                      styles.tabText,
                      period === tab.value && styles.tabTextActive,
                    ]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 오늘 현황 카드 */}
            <Text style={styles.sectionTitle}>오늘 현황</Text>
            <View style={[styles.cardRow, isPhone && {flexWrap: 'wrap'}]}>
              <StatCard
                label="방문 고객"
                value={todayVisitors}
                unit="명"
                minWidth={isPhone ? '45%' : undefined}
              />
              <StatCard
                label={`${rewardLabel} 적립`}
                value={todaySaved}
                unit={rewardUnit}
                minWidth={isPhone ? '45%' : undefined}
              />
              <StatCard
                label={isPoint ? '포인트 사용' : '쿠폰 사용'}
                value={todayUsed}
                unit={rewardUnit}
                minWidth={isPhone ? '45%' : undefined}
              />
            </View>

            {/* 시간대별 방문 차트 */}
            <Text style={styles.sectionTitle}>
              오늘 시간대별 방문
              {peakHour.count > 0 && (
                <Text style={styles.peakLabel}>
                  {'  '}피크 {peakHour.label}
                </Text>
              )}
            </Text>
            <View style={styles.chartCard}>
              <View style={[styles.barChart, {height: 110}]}>
                {hourStats.map((stat, i) => {
                  const barHeight = Math.max((stat.count / maxHour) * 80, 2);
                  const isPeak =
                    stat.count > 0 && stat.count === peakHour.count;
                  return (
                    <View key={i} style={styles.barGroup}>
                      <Text style={styles.barValue}>
                        {stat.count > 0 ? stat.count : ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            width: 36,
                            backgroundColor: isPeak
                              ? ACCENT
                              : pal.blue[100],
                          },
                        ]}
                      />
                      <Text style={[styles.barLabel, {fontSize: 10}]}>
                        {stat.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 기간 스탬프 바 차트 */}
            <Text style={styles.sectionTitle}>
              {period === 'today'
                ? '오늘'
                : period === '7days'
                ? '최근 7일'
                : period === '30days'
                ? '최근 30일 (주별)'
                : '이번달 (주별)'}{' '}
              {rewardLabel} 적립
            </Text>
            <View style={styles.chartCard}>
              <View style={styles.barChart}>
                {chartStats.map((stat, i) => {
                  const isLast = i === chartStats.length - 1;
                  const barHeight = Math.max(
                    (stat.saved / chartMax) * 100,
                    2,
                  );
                  return (
                    <View key={i} style={styles.barGroup}>
                      <Text style={styles.barValue}>
                        {stat.saved > 0 ? stat.saved : ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: isLast
                              ? ACCENT
                              : pal.blue[100],
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.barLabel,
                          isLast && {
                            color: ACCENT,
                            fontFamily: f.semibold,
                          },
                        ]}>
                        {stat.date}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 기간 합계 */}
            <View style={styles.summaryRow}>
              <SummaryItem
                label={period === 'today' ? '오늘 적립' : '기간 적립'}
                value={totalSaved}
                unit={rewardUnit}
              />
              <SummaryItem
                label={period === 'today' ? '오늘 사용' : '기간 사용'}
                value={totalUsed}
                unit={rewardUnit}
              />
              <SummaryItem
                label="순증"
                value={totalSaved - totalUsed}
                unit={rewardUnit}
              />
            </View>

            {/* 오늘 방문 고객 목록 */}
            {todayVisitorList.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  오늘 방문 고객 ({todayVisitorList.length}명)
                </Text>
                <View style={styles.visitorCard}>
                  {todayVisitorList.map((phone, i) => (
                    <View
                      key={phone}
                      style={[
                        styles.visitorRow,
                        i === todayVisitorList.length - 1 && {borderBottomWidth: 0},
                      ]}>
                      <Text style={styles.visitorIndex}>{i + 1}</Text>
                      <Text style={styles.visitorPhone}>
                        {phone.replace(
                          /(\d{3})(\d{4})(\d{4})/,
                          '$1-****-$3',
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

// ─── 서브 컴포넌트 ────────────────────────────────────────────
// styles에 바인딩해 한 번만 생성 (컴포넌트 안 useMemo에서 호출).

type Styles = ReturnType<typeof createStyles>;

const createSubComponents = (styles: Styles) => {
  const StatCard = ({
    label,
    value,
    unit,
    minWidth,
  }: {
    label: string;
    value: number;
    unit: string;
    minWidth?: `${number}%`;
  }) => (
    <View
      style={[
        styles.statCard,
        minWidth
          ? {minWidth: minWidth as any, flex: undefined, flexBasis: minWidth as any}
          : undefined,
      ]}>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const KpiCard = ({
    label,
    value,
    unit,
    subtitle,
  }: {
    label: string;
    value: string;
    unit: string;
    subtitle?: string;
  }) => (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiCardLabel}>{label}</Text>
      <Text style={styles.kpiCardValue}>
        {value}
        {unit ? <Text style={styles.kpiCardUnit}> {unit}</Text> : null}
      </Text>
      {subtitle ? <Text style={styles.kpiCardSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  const SummaryItem = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: number;
    unit: string;
  }) => (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryUnit}>{unit}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );

  return {StatCard, KpiCard, SummaryItem};
};

// ─── 스타일 ──────────────────────────────────────────────────

const createStyles = (theme: Theme) => {
  const c = theme.color;
  const f = theme.font;
  const ACCENT = c.surface.brand.primary;
  const TEXT_PRIMARY = c.texticon.onNormal.highestemp;
  const TEXT_SECONDARY = c.texticon.onNormal.midemp;
  const TEXT_MUTED = c.texticon.onNormal.lowemp;
  const SURFACE = c.surface.normal.bg1;
  const TRACK = c.surface.normal.container10;

  // 보더 대신 옅은 섀도우로 카드를 띄운다 (리뉴얼 방향)
  const CARD_SHADOW = {
    shadowColor: c.etc.absolute.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  } as const;

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface.normal.container10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: f.medium,
    color: TEXT_PRIMARY,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highestemp,
  },
  refreshBtn: {
    position: 'absolute',
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  refreshText: {
    fontSize: 14,
    fontFamily: f.medium,
    color: ACCENT,
  },
  storeNameLine: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  storeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    ...CARD_SHADOW,
  },
  memberBadgeLabel: {
    fontSize: 13,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
    letterSpacing: -0.2,
  },
  memberCountLarge: {
    fontSize: 32,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  memberCountUnit: {
    fontSize: 16,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: TRACK,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: SURFACE,
    shadowColor: c.etc.absolute.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: TEXT_MUTED,
  },
  tabTextActive: {
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
  },
  peakLabel: {
    fontSize: 12,
    fontFamily: f.regular,
    color: ACCENT,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: f.semibold,
    color: TEXT_SECONDARY,
    letterSpacing: -0.2,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    ...CARD_SHADOW,
  },
  statValue: {
    fontSize: 28,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
  },
  statUnit: {
    fontSize: 14,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  chartCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    ...CARD_SHADOW,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barValue: {
    fontSize: 11,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
    height: 14,
  },
  bar: {
    width: 24,
    borderRadius: 6,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: f.regular,
    color: TEXT_MUTED,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 2,
    ...CARD_SHADOW,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
  },
  summaryUnit: {
    fontSize: 12,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: f.regular,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  visitorCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
    ...CARD_SHADOW,
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.surface.normal.container10,
    gap: 16,
  },
  visitorIndex: {
    fontSize: 13,
    fontFamily: f.regular,
    color: TEXT_MUTED,
    width: 20,
    textAlign: 'right',
  },
  visitorPhone: {
    fontSize: 15,
    fontFamily: 'SFUIDisplay-Regular',
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },
  kpiSection: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    ...CARD_SHADOW,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTitle: {
    fontSize: 17,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  kpiSubtitle: {
    fontSize: 12,
    fontFamily: f.regular,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  kpiLoadBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 94,
    alignItems: 'center',
  },
  kpiLoadBtnDisabled: {
    opacity: 0.6,
  },
  kpiLoadBtnText: {
    color: c.etc.absolute.white,
    fontSize: 13,
    fontFamily: f.semibold,
  },
  kpiGroupLabel: {
    fontSize: 12,
    fontFamily: f.semibold,
    color: TEXT_SECONDARY,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  kpiCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: c.surface.normal.container10,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  kpiCardLabel: {
    fontSize: 11,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  kpiCardValue: {
    fontSize: 20,
    fontFamily: f.semibold,
    color: TEXT_PRIMARY,
  },
  kpiCardUnit: {
    fontSize: 11,
    fontFamily: f.regular,
    color: TEXT_SECONDARY,
  },
  kpiCardSubtitle: {
    fontSize: 10,
    fontFamily: f.regular,
    color: TEXT_MUTED,
  },
  });
};

export default StatisticsScreen;
