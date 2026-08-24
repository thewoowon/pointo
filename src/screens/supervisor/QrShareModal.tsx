import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useFirestore, useStoreConfig, useTheme} from '../../hooks';
import type {Theme} from '../../theme';

// 고객 셀프 조회용 포인토 웹.
//
// 매장 코드를 쿼리스트링이 아니라 경로에 둔다. QR이 인쇄물로 붙는 경우가 있어
// 주소가 안정적이어야 하고, 공유·북마크도 자연스럽다.
const POINTO_WEB_URL = 'https://hellopointo.com';

/** QR의 용도. 하나는 매 손님마다, 하나는 인쇄물에 붙는다. */
type QrKind = 'give' | 'lookup';

/**
 * 손님 휴대폰을 향해 띄우는 QR. 용도가 둘이다.
 *
 * **적립(give)** — 여분의 고객용 기기가 없을 때 손님 폰을 두 번째 기기로 쓴다.
 * 손님이 스캔해서 번호를 넣으면 `sessions/session_{매장코드}`에 실리고, 이 화면의
 * 세션 리스너가 그걸 받아 적립 시트를 띄운다. 카운터 태블릿이 하던 일과 정확히
 * 같은 경로다 — **적립 쓰기는 여전히 점주 기기에서 일어난다.** 손님 폰은 번호
 * 입력기일 뿐이라 웹에 쓰기 권한을 열지 않는다.
 *
 * **조회(lookup)** — 손님이 자기 스탬프·쿠폰을 확인한다. 조회 전용이고, 테이블
 * 텐트 같은 인쇄물에 붙여둘 수 있게 주소가 고정이다.
 */
const QrShareModal = ({
  visible,
  storeCode,
  onClose,
}: {
  visible: boolean;
  storeCode: string | null;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // 포인트 매장에서 '스탬프'라고 안내하면 손님이 자기 적립금 화면이 아니라고
  // 생각한다. 웹은 번호를 받기 전이라 모드를 모르지만, 여긴 매장이 정해져 있다.
  const isPoint = useStoreConfig(storeCode).mode === 'point';
  const {updateSession} = useFirestore(storeCode);

  // 매 손님마다 쓰는 쪽이 적립이라 그쪽을 기본으로 연다.
  const [kind, setKind] = useState<QrKind>('give');
  useEffect(() => {
    if (visible) setKind('give');
  }, [visible]);

  /**
   * 적립용 QR을 띄운 시각을 세션에 남긴다. 웹은 이 시각이 최근일 때만 적립 요청을
   * 받는다 — QR을 사진으로 찍어둔 사람이 나중에 집에서 요청을 넣는 걸 막는다.
   *
   * 이건 보안 장치가 아니라 정직한 손님을 위한 가드다. 세션 문서는 익명 세션도
   * 쓸 수 있어서 우회 자체는 가능하지만, 우회해서 얻는 건 **관리자 화면에 적립
   * 창이 하나 뜨는 것**뿐이다. 실제 적립은 점주가 개수를 넣고 확인을 눌러야 한다.
   */
  useEffect(() => {
    if (!visible || kind !== 'give' || !storeCode) return;
    updateSession(`session_${storeCode}`, {
      qr_opened_at: new Date().toISOString(),
    });
    // updateSession은 매 렌더 새 참조 — 실제 입력만 의존성에 둔다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, kind, storeCode]);

  const url = storeCode
    ? kind === 'give'
      ? `${POINTO_WEB_URL}/s/${storeCode}/give`
      : `${POINTO_WEB_URL}/s/${storeCode}`
    : POINTO_WEB_URL;

  const unit = isPoint ? '포인트' : '스탬프';

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <View style={styles.track}>
            {(['give', 'lookup'] as const).map(value => {
              const active = kind === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setKind(value)}>
                  <Text
                    style={[styles.segmentText, active && styles.segmentTextOn]}>
                    {value === 'give' ? '적립하기' : '조회용'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.title}>
            {kind === 'give'
              ? '손님 휴대폰으로 적립하기'
              : `내 ${unit} 조회`}
          </Text>

          <View style={styles.qrFrame}>
            <QRCode
              value={url}
              size={200}
              backgroundColor="white"
              color={theme.color.texticon.onNormal.highestemp}
            />
          </View>

          <Text style={styles.caption}>
            {kind === 'give'
              ? '손님이 이 QR을 스캔해 번호를 입력하면 이 화면에 적립 창이 떠요. 여분의 고객용 기기가 없을 때 쓰세요.'
              : `손님이 이 QR을 스캔하면 전화번호로 보유 ${unit}과 쿠폰을 확인할 수 있어요. 조회 전용이라 인쇄해서 붙여둬도 돼요.`}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 24,
      padding: 32,
      width: '90%',
      maxWidth: 380,
      alignItems: 'center',
      gap: 16,
    },
    track: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      backgroundColor: theme.palette.slate[100],
      borderRadius: 12,
      padding: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 9,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.color.surface.brand.primary,
    },
    segmentText: {
      fontFamily: theme.font.medium,
      fontSize: 14,
      color: theme.color.texticon.onNormal.lowemp,
    },
    segmentTextOn: {
      fontFamily: theme.font.semibold,
      color: theme.color.etc.absolute.white,
    },
    title: {
      fontFamily: theme.font.semibold,
      fontSize: 20,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    qrFrame: {
      width: 232,
      height: 232,
      borderRadius: 20,
      backgroundColor: theme.color.etc.absolute.white,
      justifyContent: 'center',
      alignItems: 'center',
    },
    caption: {
      fontFamily: theme.font.regular,
      fontSize: 14,
      lineHeight: 22,
      letterSpacing: -0.3,
      textAlign: 'center',
      color: theme.color.texticon.onNormal.midemp,
    },
  });

export default QrShareModal;
