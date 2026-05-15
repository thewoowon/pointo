import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import {useAuth, useFirestore, useStoreConfig} from '../../hooks';
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
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {
    getStores,
    getUserCount,
    getLogsInRange,
    getAllUsers,
    getAllLogs,
  } = useFirestore(storeCode);

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
        setTodaySaved(todayLogs.filter(l => l.action === 'stamp_saved').length);
        setTodayUsed(todayLogs.filter(l => l.action === 'stamp_used').length);
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
          return {
            date: d.format('M/D'),
            saved: dayLogs.filter(l => l.action === 'stamp_saved').length,
            used: dayLogs.filter(l => l.action === 'stamp_used').length,
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFAF4" />
      <SafeAreaView style={styles.safeArea}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>대시보드</Text>
          <Pressable
            style={styles.refreshBtn}
            onPress={() => loadData(period)}>
            <Text style={styles.refreshText}>새로고침</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4845A" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 가게 정보 */}
            <View style={styles.storeInfoRow}>
              <View>
                <Text style={styles.storeName}>{storeName}</Text>
                <Text style={styles.storeCode}>코드: {storeCode}</Text>
              </View>
              <View style={styles.memberBadge}>
                <Text style={styles.memberBadgeNumber}>{memberCount}</Text>
                <Text style={styles.memberBadgeLabel}>총 회원</Text>
              </View>
            </View>

            {/* ─── 종합 성과 (포트폴리오 섹션) ─── */}
            <View style={styles.kpiSection}>
              <View style={styles.kpiHeader}>
                <View>
                  <Text style={styles.kpiTitle}>📊 종합 성과</Text>
                  <Text style={styles.kpiSubtitle}>
                    {kpiLastLoaded
                      ? `마지막 집계: ${kpiLastLoaded}`
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
                    <ActivityIndicator size="small" color="#fff" />
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
                      accent="#D4845A"
                    />
                    <KpiCard
                      label="누적 스탬프"
                      value={fmtInt(kpis.totalStampsEarned)}
                      unit="개"
                      accent="#6B9E78"
                    />
                  </View>

                  {/* 활성도 */}
                  <Text style={styles.kpiGroupLabel}>활성도</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="DAU"
                      value={fmtInt(kpis.dau)}
                      unit="명"
                      accent="#3D2416"
                      subtitle="최근 1일"
                    />
                    <KpiCard
                      label="WAU"
                      value={fmtInt(kpis.wau)}
                      unit="명"
                      accent="#3D2416"
                      subtitle="최근 7일"
                    />
                    <KpiCard
                      label="MAU"
                      value={fmtInt(kpis.mau)}
                      unit="명"
                      accent="#3D2416"
                      subtitle="최근 30일"
                    />
                  </View>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="평균 방문 빈도"
                      value={fmtFloat(kpis.avgVisitsPerUser, 1)}
                      unit="회/인"
                      accent="#C89A2E"
                    />
                    <KpiCard
                      label="재방문율 (D7)"
                      value={fmtPct(kpis.retention7d)}
                      unit=""
                      accent="#C89A2E"
                      subtitle={`n=${fmtInt(kpis.retention7dSampleSize)}`}
                    />
                  </View>

                  {/* 리워드 */}
                  <Text style={styles.kpiGroupLabel}>리워드</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="쿠폰 발행"
                      value={fmtInt(kpis.totalCouponsIssued)}
                      unit="장"
                      accent="#7B8ED4"
                    />
                    <KpiCard
                      label="쿠폰 사용"
                      value={fmtInt(kpis.totalCouponsRedeemed)}
                      unit="장"
                      accent="#7B8ED4"
                    />
                    <KpiCard
                      label="사용률"
                      value={fmtPct(kpis.couponRedemptionRate)}
                      unit=""
                      accent="#7B8ED4"
                    />
                  </View>

                  {/* 로열티 */}
                  <Text style={styles.kpiGroupLabel}>로열티</Text>
                  <View style={styles.kpiCardRow}>
                    <KpiCard
                      label="충성 고객 (Lv.4↑)"
                      value={fmtPct(kpis.loyalRatio)}
                      unit=""
                      accent="#9B59B6"
                      subtitle={`${fmtInt(kpis.loyalCount)}명`}
                    />
                    <KpiCard
                      label="활성 유저"
                      value={fmtPct(kpis.activeRatio)}
                      unit=""
                      accent="#6B9E78"
                      subtitle={`${fmtInt(kpis.activeCount)}명`}
                    />
                    <KpiCard
                      label="이탈 유저 (30d+)"
                      value={fmtPct(kpis.churnedRatio)}
                      unit=""
                      accent="#B85C5C"
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
            <View style={styles.cardRow}>
              <StatCard
                emoji="👥"
                label="방문 고객"
                value={todayVisitors}
                unit="명"
                color="#D4845A"
              />
              <StatCard
                emoji="✅"
                label="스탬프 적립"
                value={todaySaved}
                unit="개"
                color="#6B9E78"
              />
              <StatCard
                emoji="🎁"
                label="쿠폰 사용"
                value={todayUsed}
                unit="개"
                color="#7B8ED4"
              />
            </View>

            {/* 시간대별 방문 차트 */}
            <Text style={styles.sectionTitle}>
              오늘 시간대별 방문
              {peakHour.count > 0 && (
                <Text style={styles.peakLabel}>
                  {'  '}피크: {peakHour.label}
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
                              ? '#D4845A'
                              : 'rgba(212, 132, 90, 0.25)',
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
              스탬프 적립
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
                              ? '#D4845A'
                              : 'rgba(212, 132, 90, 0.3)',
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.barLabel,
                          isLast && {
                            color: '#D4845A',
                            fontFamily: 'Pretendard-SemiBold',
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
                unit="개"
              />
              <SummaryItem
                label={period === 'today' ? '오늘 사용' : '기간 사용'}
                value={totalUsed}
                unit="개"
              />
              <SummaryItem
                label="순증"
                value={totalSaved - totalUsed}
                unit="개"
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

const StatCard = ({
  emoji,
  label,
  value,
  unit,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  color: string;
}) => (
  <View style={[styles.statCard, {borderTopColor: color}]}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={[styles.statValue, {color}]}>
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
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  subtitle?: string;
}) => (
  <View style={[styles.kpiCard, {borderLeftColor: accent}]}>
    <Text style={styles.kpiCardLabel}>{label}</Text>
    <Text style={[styles.kpiCardValue, {color: accent}]}>
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

// ─── 스타일 ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#EDE5DC',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
  },
  backText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: '#3D2416',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  refreshBtn: {
    position: 'absolute',
    right: 16,
  },
  refreshText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: '#D4845A',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  storeName: {
    fontSize: 22,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  storeCode: {
    fontSize: 13,
    fontFamily: 'SFUIDisplay-Regular',
    color: 'rgba(61, 36, 22, 0.45)',
    marginTop: 4,
    letterSpacing: 1,
  },
  memberBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(212, 132, 90, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 132, 90, 0.2)',
  },
  memberBadgeNumber: {
    fontSize: 28,
    fontFamily: 'Pretendard-SemiBold',
    color: '#D4845A',
  },
  memberBadgeLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.55)',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#D4845A',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.45)',
  },
  tabTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  peakLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: '#D4845A',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: 'rgba(61, 36, 22, 0.5)',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'Pretendard-SemiBold',
  },
  statUnit: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.6)',
    height: 14,
  },
  bar: {
    width: 24,
    borderRadius: 6,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.45)',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  summaryUnit: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.45)',
    marginTop: 2,
  },
  visitorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 36, 22, 0.06)',
    gap: 16,
  },
  visitorIndex: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.35)',
    width: 20,
    textAlign: 'right',
  },
  visitorPhone: {
    fontSize: 15,
    fontFamily: 'SFUIDisplay-Regular',
    color: '#3D2416',
    letterSpacing: 1,
  },
  kpiSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(212, 132, 90, 0.12)',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
  },
  kpiSubtitle: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
    marginTop: 3,
  },
  kpiLoadBtn: {
    backgroundColor: '#D4845A',
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
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Pretendard-SemiBold',
  },
  kpiGroupLabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-SemiBold',
    color: 'rgba(61, 36, 22, 0.55)',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  kpiCardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FAF6F1',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    gap: 2,
  },
  kpiCardLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.6)',
  },
  kpiCardValue: {
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
  },
  kpiCardUnit: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
  },
  kpiCardSubtitle: {
    fontSize: 10,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.4)',
  },
});

export default StatisticsScreen;
