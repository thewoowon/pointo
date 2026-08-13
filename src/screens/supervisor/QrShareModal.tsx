import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useStoreConfig, useTheme} from '../../hooks';
import type {Theme} from '../../theme';

// 고객 셀프 조회용 포인토 웹.
//
// 매장 코드를 쿼리스트링이 아니라 경로에 둔다. QR이 인쇄물로 붙는 경우가 있어
// 주소가 안정적이어야 하고, 공유·북마크도 자연스럽다.
const POINTO_WEB_URL = 'https://hellopointo.com';

/**
 * 손님이 스캔해 자기 스탬프를 확인하도록 매장 링크를 QR로 띄운다.
 *
 * **조회 전용이다.** 적립·사용은 이 태블릿에서만 한다 — 웹은 URL만 알면 누구나
 * 열 수 있어서, 전화번호만으로 쓰기를 허용하면 남의 번호로 스탬프를 찍거나 남의
 * 쿠폰을 쓸 수 있다. 웹 적립은 SMS 본인 인증이 붙은 뒤에 연다.
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
  // 생각한다. 웹은 번호를 받기 전이라 모드를 모르지만, 여기선 매장이 정해져 있다.
  const isPoint = useStoreConfig(storeCode).mode === 'point';

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
          <Text style={styles.title}>
            {isPoint ? '내 포인트 조회' : '내 스탬프 조회'}
          </Text>
          <View style={styles.qrFrame}>
            <QRCode
              value={
                storeCode
                  ? `${POINTO_WEB_URL}/s/${storeCode}`
                  : POINTO_WEB_URL
              }
              size={200}
              backgroundColor="white"
              color={theme.color.texticon.onNormal.highestemp}
            />
          </View>
          <Text style={styles.caption}>
            {isPoint
              ? '손님이 이 QR을 스캔하면 전화번호로 보유 포인트를 확인할 수 있어요. 적립·사용은 이 기기에서 해주세요.'
              : '손님이 이 QR을 스캔하면 전화번호로 스탬프와 쿠폰을 확인할 수 있어요. 적립은 이 기기에서 해주세요.'}
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
