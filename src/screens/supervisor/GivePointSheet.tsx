import React, {useEffect, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {primitives as p, fontFamily as f} from '../../theme';
import {NewXIcon, RightChevronIcon} from '../../components/Icons';
import {useGivePoint} from './useGivePoint';
import {maskPhone} from './logDisplay';
import {
  SegmentedToggle,
  GiveBody,
  ConfirmButton,
  CustomerDetailPanel,
  canConfirm,
  confirmLabel,
} from './givepoint';

/** 쿠폰 목록에 내주는 높이 (모바일은 화면이 좁아 태블릿보다 짧게) */
const COUPON_LIST_MAX_HEIGHT = 300;

/**
 * 모바일 적립/사용 풀스크린.
 *
 * 이전엔 2스텝 바텀시트(선택 → 입력)였는데, 적립은 카운터에서 몇 초 안에
 * 끝나야 하는 일이라 단계를 없애고 토글 하나로 합쳤다. 계산 로직과 입력부는
 * 태블릿 DetailView와 같은 소스(useGivePoint / GiveBody)를 쓴다.
 */
const GivePointSheet = ({
  visible,
  phoneNumber,
  updateLogs,
  manual = false,
  onClose,
}: {
  visible: boolean;
  phoneNumber: string;
  updateLogs: () => void;
  /** 관리자가 고객 검색으로 연 흐름 (고객 태블릿 세션과 무관) */
  manual?: boolean;
  onClose?: () => void;
}) => {
  const g = useGivePoint(phoneNumber, updateLogs, {manual});
  const [detailVisible, setDetailVisible] = useState(false);

  // 새 고객이 열릴 때마다 상세 시트는 닫아둔다
  useEffect(() => {
    if (visible) setDetailVisible(false);
  }, [visible, phoneNumber]);

  // 세션 흐름에선 close()가 세션을 리셋해 부모의 모달이 닫히지만,
  // 수동 흐름은 세션을 안 건드리므로 부모에게 직접 닫힘을 알려야 한다.
  const handleClose = async () => {
    await g.close();
    onClose?.();
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
    if (ok && manual) handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={handleClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <Pressable onPress={handleClose} hitSlop={10}>
            <NewXIcon width={22} height={22} />
          </Pressable>
        </View>

        <View style={s.togglePad}>
          <SegmentedToggle mode={g.mode} onChange={g.switchMode} />
        </View>

        <Pressable style={s.customerRow} onPress={() => setDetailVisible(true)}>
          <View style={s.customerText}>
            <Text style={s.customerLabel}>고객 번호</Text>
            <Text style={s.customerPhone}>{maskPhone(phoneNumber)}</Text>
          </View>
          <View style={s.moreBtn}>
            <Text style={s.moreText}>자세히</Text>
            <RightChevronIcon width={16} height={16} color={p.gray[400]} />
          </View>
        </Pressable>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <GiveBody g={g} couponListMaxHeight={COUPON_LIST_MAX_HEIGHT} />
        </ScrollView>

        <View style={s.footer}>
          <ConfirmButton
                enabled={canConfirm(g)}
                label={confirmLabel(g)}
                onPress={onConfirm}
              />
        </View>
      </SafeAreaView>

      <Modal
        visible={detailVisible}
        transparent
        animationType="slide"
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setDetailVisible(false)}>
        <Pressable style={s.backdrop} onPress={() => setDetailVisible(false)}>
          <Pressable style={s.detailSheet} onPress={e => e.stopPropagation()}>
            <View style={s.detailHeader}>
              <Text style={s.detailTitle}>고객정보 상세</Text>
              <Pressable onPress={() => setDetailVisible(false)} hitSlop={10}>
                <NewXIcon width={20} height={20} />
              </Pressable>
            </View>
            <CustomerDetailPanel
              phoneNumber={phoneNumber}
              user={g.user}
              isPointMode={g.isPointMode}
              pointUnit={g.storeConfig.pointUnit}
              stampsPerCoupon={g.storeConfig.stampsPerCoupon}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: p.base.white},
  header: {height: 44, justifyContent: 'center', paddingHorizontal: 20},
  togglePad: {paddingHorizontal: 16, paddingBottom: 12},

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.slate[100],
    gap: 12,
  },
  customerText: {gap: 2},
  customerLabel: {
    fontSize: 12,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
  customerPhone: {
    fontSize: 17,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
  moreBtn: {flexDirection: 'row', alignItems: 'center', gap: 2},
  moreText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },

  scroll: {flex: 1},
  scrollContent: {paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16},
  footer: {paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16},

  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  detailSheet: {
    // maxHeight가 아니라 확정 높이여야 한다 — 안의 패널이 flex:1 ScrollView라
    // 부모 높이가 콘텐츠로 정해지면 서로를 기다리다 0으로 접힌다.
    height: '72%',
    backgroundColor: p.base.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  detailTitle: {
    fontSize: 17,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -0.4,
  },
});

export default GivePointSheet;
