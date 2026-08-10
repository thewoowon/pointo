import React from 'react';
import {Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {primitives as p, fontFamily as f} from '../../theme';
import {NewXIcon} from '../../components/Icons';
import {useGivePoint} from './useGivePoint';
import {
  SegmentedToggle,
  GiveBody,
  ConfirmButton,
  CustomerDetailPanel,
  canConfirm,
} from './givepoint';

/** 좌측 고객정보 컬럼 폭 */
const SIDE_WIDTH = 400;
/** 우측 입력 컬럼 폭 */
const PANEL_WIDTH = 342;
/** 쿠폰 목록에 내주는 높이 — 넘으면 스크롤되고 아래가 페이드된다 */
const COUPON_LIST_MAX_HEIGHT = 340;

/**
 * 태블릿(expanded) 전용 적립/사용 풀모달.
 * MainScreen이 `!isCompact`일 때만 렌더하므로 여기선 반응형 분기를 두지 않는다.
 * 모바일 대응은 GivePointSheet — 입력부(GiveBody)는 둘이 공유한다.
 */
const DetailView = ({
  phoneNumber,
  updateLogs,
  onClose,
  manual = false,
}: {
  navigation: any;
  phoneNumber: string;
  onClose: () => void;
  updateLogs: () => void;
  /** 관리자가 고객 검색으로 연 흐름 (고객 태블릿 세션과 무관) */
  manual?: boolean;
}) => {
  const g = useGivePoint(phoneNumber, updateLogs, {manual});

  // 세션 흐름에선 close()의 세션 리셋이 부모 모달을 닫지만,
  // 수동 흐름은 세션을 안 건드리므로 부모에게 직접 알려야 한다.
  const handleClose = async () => {
    await g.close();
    onClose();
  };

  const onConfirm = async () => {
    const ok =
      g.mode === 'earn'
        ? g.isPointMode
          ? await g.handleApprovePoint()
          : await g.handleApprove()
        : g.isPointMode
        ? await g.handleUsingPoint()
        : await g.handleUsing();
    // 수동 적립은 작업이 끝나면 목록으로 돌려보낸다 (스택을 쌓지 않음).
    if (ok && manual) handleClose();
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={p.base.white} />
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8}>
            <NewXIcon width={20} height={20} />
            <Text style={s.closeText}>닫기</Text>
          </Pressable>
        </View>

        <View style={s.columns}>
          <View style={s.side}>
            <CustomerDetailPanel
              phoneNumber={phoneNumber}
              user={g.user}
              isPointMode={g.isPointMode}
              pointUnit={g.storeConfig.pointUnit}
              stampsPerCoupon={g.storeConfig.stampsPerCoupon}
              showTitle
            />
          </View>

          <ScrollView
            style={s.main}
            contentContainerStyle={s.mainContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={s.panel}>
              <SegmentedToggle mode={g.mode} onChange={g.switchMode} />
              <GiveBody g={g} couponListMaxHeight={COUPON_LIST_MAX_HEIGHT} />
              <ConfirmButton enabled={canConfirm(g)} onPress={onConfirm} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: p.base.white},
  safe: {flex: 1},
  header: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: p.slate[100],
  },
  closeBtn: {flexDirection: 'row', alignItems: 'center', gap: 8},
  closeText: {
    fontSize: 16,
    fontFamily: f.medium,
    color: p.gray[900],
    letterSpacing: -0.4,
  },

  columns: {flex: 1, flexDirection: 'row'},
  side: {
    width: SIDE_WIDTH,
    backgroundColor: p.slate[50],
    borderRightWidth: 1,
    borderRightColor: p.slate[100],
  },
  main: {flex: 1},
  mainContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  panel: {width: '100%', maxWidth: PANEL_WIDTH, gap: 24},
});

export default DetailView;
