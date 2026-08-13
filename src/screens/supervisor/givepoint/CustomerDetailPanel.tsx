import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import {formatRecentLogTime} from '../../../utils/recentLogs';
import {totalCoupons} from '../../../utils/coupons';
import {maskPhone} from '../logDisplay';

/** 패널에 띄우는 이력 줄 수 */
const VISIBLE_ROWS = 5;

type CustomerDetailPanelProps = {
  phoneNumber: string;
  user: User;
  isPointMode: boolean;
  pointUnit: string;
  stampsPerCoupon: number;
  /** 태블릿 좌측 컬럼처럼 제목을 함께 그릴지 */
  showTitle?: boolean;
};

/**
 * 고객정보 상세 — 보유 현황 + 최근내역.
 * 태블릿은 왼쪽 고정 컬럼으로, 모바일은 '자세히' 바텀시트로 같은 걸 쓴다.
 *
 * 최근내역 소스는 `logs`가 아니라 users 문서의 `recentLogs`다. 쿠폰 사용 로그는
 * logs에 장수가 숫자로 안 남아서(note 문자열뿐) 개수를 정확히 못 세는 반면,
 * recentLogs는 amount를 그대로 들고 있고 이미 구독 중이라 실시간이다.
 * 전체 이력은 적립내역 화면이 담당한다.
 */
const CustomerDetailPanel = ({
  phoneNumber,
  user,
  isPointMode,
  pointUnit,
  stampsPerCoupon,
  showTitle = false,
}: CustomerDetailPanelProps) => {
  const rows = (user.recentLogs ?? []).slice(0, VISIBLE_ROWS);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>
      {showTitle && <Text style={s.panelTitle}>고객정보 상세</Text>}

      <View style={s.card}>
        <View style={[s.summaryRow, s.summaryHead]}>
          <Text style={s.summaryLabel}>고객 번호</Text>
          <Text style={s.phone}>{maskPhone(phoneNumber)}</Text>
        </View>
        {isPointMode ? (
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>보유 포인트</Text>
            <Text style={s.summaryValue}>
              {user.points.toLocaleString()}
              {pointUnit}
            </Text>
          </View>
        ) : (
          <>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>보유 쿠폰</Text>
              <Text style={s.summaryValue}>{totalCoupons(user.coupons)}개</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>보유 스탬프</Text>
              <Text style={s.summaryValue}>
                {user.stamps % stampsPerCoupon}개
              </Text>
            </View>
          </>
        )}
      </View>

      <Text style={s.sectionTitle}>최근내역</Text>
      {rows.length > 0 ? (
        <View style={s.card}>
          {rows.map((log, i) => {
            const isEarn = log.action === 'stamp_saved';
            const label = isPointMode
              ? `포인트 ${isEarn ? '적립' : '사용'}`
              : isEarn
              ? '스탬프 적립'
              : '쿠폰 사용';
            // 포인트는 증감이라 부호를 붙이고, 스탬프/쿠폰은 '몇 개 처리했다'로 읽는다
            const amount = isPointMode
              ? `${isEarn ? '+' : '-'}${log.amount.toLocaleString()}${pointUnit}`
              : `${log.amount}개`;
            return (
              <View key={`${log.at}-${i}`} style={s.logRow}>
                <View style={s.logText}>
                  <Text style={s.logLabel}>{label}</Text>
                  <Text style={s.logTime}>{formatRecentLogTime(log.at)}</Text>
                </View>
                <Text style={[s.logAmount, isEarn ? s.earn : s.use]}>
                  {amount}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={s.empty}>내역이 없습니다</Text>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  root: {flex: 1},
  content: {padding: 24, gap: 12},
  panelTitle: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[500],
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  card: {
    backgroundColor: p.base.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.slate[200],
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  summaryHead: {borderBottomWidth: 1, borderBottomColor: p.slate[200]},
  summaryLabel: {
    fontSize: 14,
    fontFamily: f.regular,
    color: p.gray[500],
    letterSpacing: -0.3,
  },
  phone: {
    fontSize: 18,
    fontFamily: f.bold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.3,
    marginTop: 8,
    marginLeft: 2,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  logText: {gap: 3},
  logLabel: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
  logTime: {
    fontSize: 13,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
  logAmount: {fontSize: 15, fontFamily: f.semibold, letterSpacing: -0.4},
  earn: {color: p.orange[400]},
  use: {color: p.blue[500]},
  empty: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
    fontFamily: f.regular,
    color: p.gray[300],
    letterSpacing: -0.3,
  },
});

export default CustomerDetailPanel;
