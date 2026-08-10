import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useTheme} from '../../hooks';
import type {Theme} from '../../theme';

// 고객 셀프 적립용 포인토 웹. 스토어 코드를 붙여 해당 매장으로 진입시킴.
const POINTO_WEB_URL = 'https://pointo-web-chi.vercel.app';

/** 손님이 스캔해 웹에서 직접 적립하도록 매장 링크를 QR로 띄운다. */
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
          <Text style={styles.title}>고객 셀프 적립</Text>
          <View style={styles.qrFrame}>
            <QRCode
              value={
                storeCode
                  ? `${POINTO_WEB_URL}?store=${storeCode}`
                  : POINTO_WEB_URL
              }
              size={200}
              backgroundColor="white"
              color={theme.color.texticon.onNormal.highestemp}
            />
          </View>
          <Text style={styles.caption}>
            손님이 이 QR을 스캔하면 웹에서 전화번호로 로그인해 직접 적립할 수
            있어요.
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
