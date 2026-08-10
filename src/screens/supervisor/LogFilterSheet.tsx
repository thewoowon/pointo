import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useLayoutMode, useTheme} from '../../hooks';
import {CheckIcon, NewXIcon} from '../../components/Icons';
import type {Theme} from '../../theme';

export type LogFilter = 'all' | 'used' | 'saved';

export const FILTER_LIST: {label: string; value: LogFilter}[] = [
  {label: '전체', value: 'all'},
  {label: '사용내역', value: 'used'},
  {label: '적립내역', value: 'saved'},
];

export const FILTER_MAP: Record<LogFilter, string> = {
  all: '전체',
  used: '사용내역',
  saved: '적립내역',
};

/**
 * 적립내역 목록의 타입 필터(전체/사용/적립).
 * 모바일은 바텀시트, 태블릿은 중앙 모달 — CustomerSearchSheet와 같은 규격.
 */
const LogFilterSheet = ({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: LogFilter;
  onSelect: (filter: LogFilter) => void;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const {isCompact} = useLayoutMode();
  const styles = useMemo(
    () => createStyles(theme, isCompact),
    [theme, isCompact],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isCompact ? 'slide' : 'fade'}
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>
          <View style={styles.topRow}>
            <View style={styles.topBtn} />
            <Text style={styles.title}>내역 타입</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.topBtn}>
              <NewXIcon width={20} height={20} />
            </Pressable>
          </View>

          <View style={styles.options}>
            {FILTER_LIST.map(item => {
              const isSelected = selected === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.row, isSelected && styles.rowSelected]}
                  onPress={() => onSelect(item.value)}>
                  <Text
                    style={[
                      styles.rowText,
                      isSelected && styles.rowTextSelected,
                    ]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <CheckIcon
                      width={20}
                      height={20}
                      color={theme.color.surface.brand.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme, isCompact: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: isCompact ? 'flex-end' : 'center',
      alignItems: isCompact ? undefined : 'center',
    },
    panel: {
      backgroundColor: theme.color.surface.normal.bg1,
      paddingHorizontal: 24,
      paddingTop: 16,
      gap: 20,
      ...(isCompact
        ? {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: 32,
          }
        : {
            borderRadius: 28,
            paddingBottom: 28,
            width: '90%',
            maxWidth: 400,
          }),
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBtn: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      textAlign: 'center',
      fontFamily: theme.font.semibold,
      fontSize: 20,
      lineHeight: 30,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    options: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    rowSelected: {
      backgroundColor: theme.color.surface.normal.container10,
    },
    rowText: {
      fontFamily: theme.font.regular,
      fontSize: 17,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.highestemp,
    },
    rowTextSelected: {
      fontFamily: theme.font.semibold,
      color: theme.color.texticon.onNormal.primary,
    },
  });

export default LogFilterSheet;
