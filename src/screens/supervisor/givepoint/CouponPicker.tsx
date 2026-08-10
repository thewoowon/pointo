import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import {primitives as p, fontFamily as f} from '../../../theme';
import {CouponIcon} from '../../../components/Icons';
import type {CouponEntry} from '../../../utils/coupons';

/** 목록이 잘릴 때 아래쪽을 흐리게 덮는 높이 */
const FADE_HEIGHT = 44;

const CircleCheck = () => (
  <View style={s.check}>
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M2.8 7.4L5.6 10L11.2 4"
        stroke={p.base.white}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

type CouponPickerProps = {
  entries: CouponEntry[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  /** 유효기간(일). 0이면 무기한 */
  expiryDays: number;
  /** 목록 영역 최대 높이. 넘으면 스크롤되고 아래가 페이드된다 */
  maxHeight: number;
};

/**
 * 사용할 쿠폰 고르기 — 타입별 개수가 아니라 **장 단위**로 나열한다.
 * 같은 이름이라도 만료일이 다른 별개의 장이라, 관리자가 어느 장을 쓰는지
 * 직접 고를 수 있어야 한다 (차감도 고른 장 그대로 나간다).
 */
const CouponPicker = ({
  entries,
  selectedKeys,
  onToggle,
  onClear,
  expiryDays,
  maxHeight,
}: CouponPickerProps) => {
  // 콘텐츠가 실제로 넘칠 때만 페이드를 올린다 (짧은 목록엔 군더더기)
  const [overflowing, setOverflowing] = useState(false);

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title}>
          사용 가능한 쿠폰 <Text style={s.count}>{entries.length}</Text>
        </Text>
        {selectedKeys.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={s.clear}>선택 초기화</Text>
          </Pressable>
        )}
      </View>

      {entries.length > 0 ? (
        <View>
          <ScrollView
            style={{maxHeight}}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            onContentSizeChange={(_, h) => setOverflowing(h > maxHeight)}>
            {entries.map(entry => {
              const selected = selectedKeys.includes(entry.key);
              return (
                <Pressable
                  key={entry.key}
                  onPress={() => onToggle(entry.key)}
                  style={[s.row, selected && s.rowSelected]}>
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
                  {selected && <CircleCheck />}
                </Pressable>
              );
            })}
          </ScrollView>

          {overflowing && (
            <LinearGradient
              colors={['rgba(255,255,255,0)', p.base.white]}
              style={s.fade}
              pointerEvents="none"
            />
          )}
        </View>
      ) : (
        <Text style={s.empty}>사용 가능한 쿠폰이 없습니다</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  section: {width: '100%', gap: 10},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
  count: {fontFamily: f.semibold, color: p.blue[500]},
  clear: {
    fontSize: 13,
    fontFamily: f.medium,
    color: p.gray[500],
    letterSpacing: -0.3,
  },
  list: {gap: 12, paddingBottom: 4},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.slate[100],
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  rowSelected: {backgroundColor: p.blue[50]},
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: p.blue[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE_HEIGHT,
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

export default CouponPicker;
