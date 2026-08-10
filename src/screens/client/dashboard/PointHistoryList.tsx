import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import {formatRecentLogTime} from '../../../utils/recentLogs';

/** 화면에 띄우는 줄 수. 문서엔 더 쌓여 있어도 세션 화면에선 이만큼만. */
const VISIBLE_ROWS = 5;

type PointHistoryListProps = {
  logs: RecentLog[];
  unit: string;
};

/**
 * 포인트 모드 하단 최근내역.
 * 색은 적립내역 화면과 한 세트 — 적립=주황, 사용=파랑 (supervisor/logDisplay).
 */
const PointHistoryList = ({logs, unit}: PointHistoryListProps) => {
  const rows = logs.slice(0, VISIBLE_ROWS);

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>최근내역</Text>

      {rows.length > 0 ? (
        <View style={s.card}>
          {rows.map((log, i) => {
            const isEarn = log.action === 'stamp_saved';
            return (
              <View key={`${log.at}-${i}`} style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.label}>
                    포인트 {isEarn ? '적립' : '사용'}
                  </Text>
                  <Text style={s.time}>{formatRecentLogTime(log.at)}</Text>
                </View>
                <Text style={[s.amount, isEarn ? s.earn : s.use]}>
                  {isEarn ? '+' : '-'}
                  {log.amount.toLocaleString()}
                  {unit}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={s.empty}>내역이 없습니다</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  section: {width: '100%', gap: 12},
  sectionTitle: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.3,
    marginLeft: 2,
  },
  card: {
    backgroundColor: p.base.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.slate[200],
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {gap: 3},
  label: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
  time: {
    fontSize: 13,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
  amount: {fontSize: 15, fontFamily: f.semibold, letterSpacing: -0.4},
  earn: {color: p.orange[400]},
  use: {color: p.blue[500]},
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 14,
    fontFamily: f.regular,
    color: p.gray[300],
    letterSpacing: -0.3,
  },
});

export default PointHistoryList;
