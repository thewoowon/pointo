import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import {CouponIcon} from '../../../components/Icons';
import type {CouponEntry} from '../../../utils/coupons';

type CouponListProps = {
  entries: CouponEntry[];
  /** 유효기간(일). 0이면 무기한 */
  expiryDays: number;
};

/** 사용 가능한 쿠폰 — 장 단위로 한 줄씩. 장마다 만료일이 다르다. */
const CouponList = ({entries, expiryDays}: CouponListProps) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>
      사용 가능한 쿠폰 <Text style={s.count}>{entries.length}</Text>
    </Text>

    {entries.length > 0 ? (
      <View style={s.list}>
        {entries.map(entry => (
          <View key={entry.key} style={s.row}>
            <View style={s.iconBox}>
              <CouponIcon width={20} height={20} color={p.blue[500]} />
            </View>
            <View style={s.rowText}>
              <Text style={s.name}>{entry.name}</Text>
              <Text style={s.meta}>
                {entry.expiry
                  ? `${entry.expiry} 까지 (${expiryDays}일)`
                  : '기한 없이 사용 가능'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    ) : (
      <Text style={s.empty}>사용 가능한 쿠폰이 없습니다</Text>
    )}
  </View>
);

const s = StyleSheet.create({
  section: {width: '100%', gap: 12},
  sectionTitle: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.3,
    marginLeft: 2,
  },
  count: {fontFamily: f.semibold, color: p.blue[500]},
  list: {gap: 12},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.slate[100],
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: p.base.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {flex: 1, gap: 3},
  name: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 13,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 14,
    fontFamily: f.regular,
    color: p.gray[300],
    letterSpacing: -0.3,
  },
});

export default CouponList;
