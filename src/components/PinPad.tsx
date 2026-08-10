import React, {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTheme} from '../hooks';
import type {Theme} from '../theme';

type PinPadProps = {
  visible: boolean;
  /** 'set' = 새 PIN 설정(입력+확인 2단계), 'verify' = 기존 PIN 검증 */
  mode: 'set' | 'verify';
  title: string;
  subtitle?: string;
  /** verify 모드에서 비교 대상 */
  expectedPin?: string | null;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
};

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/** 4자리 PIN 입력 오버레이. 설정(확인 2회)과 검증 모두 지원. */
const PinPad = ({
  visible,
  mode,
  title,
  subtitle,
  expectedPin,
  onSuccess,
  onCancel,
}: PinPadProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null); // set 모드 1단계 값
  const [error, setError] = useState('');

  // 열릴 때마다 초기화
  useEffect(() => {
    if (visible) {
      setEntry('');
      setFirstPin(null);
      setError('');
    }
  }, [visible]);

  const isConfirmStep = mode === 'set' && firstPin !== null;

  const heading = isConfirmStep ? 'PIN을 한 번 더 입력해주세요' : title;

  const handleComplete = (value: string) => {
    if (mode === 'verify') {
      if (value === expectedPin) {
        onSuccess(value);
      } else {
        setError('PIN이 일치하지 않아요.');
        setEntry('');
      }
      return;
    }
    // set 모드
    if (firstPin === null) {
      setFirstPin(value);
      setEntry('');
      setError('');
    } else if (value === firstPin) {
      onSuccess(value);
    } else {
      setError('두 번 입력한 PIN이 달라요. 다시 시도해주세요.');
      setFirstPin(null);
      setEntry('');
    }
  };

  const press = (key: string) => {
    if (key === 'del') {
      setEntry(prev => prev.slice(0, -1));
      return;
    }
    if (key === '') return;
    setError('');
    setEntry(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + key;
      if (next.length === PIN_LENGTH) {
        // 상태 업데이트 후 완료 처리
        setTimeout(() => handleComplete(next), 80);
      }
      return next;
    });
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onCancel}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>

          <Text style={styles.title}>{heading}</Text>
          {subtitle && !isConfirmStep ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}

          <View style={styles.dots}>
            {Array.from({length: PIN_LENGTH}).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < entry.length && styles.dotFilled]}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}

          <View style={styles.keypad}>
            {KEYS.map((key, i) => (
              <Pressable
                key={i}
                style={({pressed}) => [
                  styles.key,
                  key === '' && styles.keyDisabled,
                  pressed && key !== '' && styles.keyPressed,
                ]}
                onPress={() => press(key)}
                disabled={key === ''}>
                <Text style={styles.keyText}>
                  {key === 'del' ? '⌫' : key}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: t.color.surface.normal.bg1,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: t.spacing[6],
      paddingTop: t.spacing[5],
      paddingBottom: t.spacing[10],
      alignItems: 'center',
    },
    closeBtn: {
      alignSelf: 'flex-end',
      paddingVertical: t.spacing[1],
      paddingHorizontal: t.spacing[2],
    },
    closeText: {
      fontSize: 15,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.midemp,
    },
    title: {
      fontSize: 20,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      textAlign: 'center',
      marginTop: t.spacing[2],
    },
    subtitle: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      marginTop: t.spacing[2],
      lineHeight: 21,
    },
    dots: {
      flexDirection: 'row',
      gap: t.spacing[4],
      marginTop: t.spacing[6],
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.palette.gray[200],
    },
    dotFilled: {
      backgroundColor: t.color.surface.brand.primary,
    },
    error: {
      fontSize: 13,
      fontFamily: t.font.medium,
      color: t.palette.red?.[500] ?? '#E5484D',
      marginTop: t.spacing[3],
      height: 18,
    },
    errorSpacer: {
      height: 18,
      marginTop: t.spacing[3],
    },
    keypad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: t.spacing[4],
      width: 264,
    },
    key: {
      width: 88,
      height: 72,
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyDisabled: {
      opacity: 0,
    },
    keyPressed: {
      opacity: 0.4,
    },
    keyText: {
      fontSize: 28,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highestemp,
    },
  });

export default PinPad;
