import React, {forwardRef, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import {useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {StatisticIcon, ProfileIcon} from '../../components/Icons';

export type SheetStore = {storeCode: string; name: string};

type Props = {
  store: SheetStore | null;
  onSupervisor: () => void;
  onClient: () => void;
  onLockClient: () => void;
};

/**
 * 스토어 선택 후 뜨는 모드 선택 바텀시트.
 *   관리자 모드 / 고객 모드 / 이 기기 고객 전용 고정(PIN)
 * 부모가 ref.present() 로 호출한다.
 */
const StoreModeSheet = forwardRef<BottomSheetModal, Props>(
  ({store, onSupervisor, onClient, onLockClient}, ref) => {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const snapPoints = useMemo(() => ['48%'], []);

    const renderBackdrop = (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.storeName}>{store?.name ?? '매장'}</Text>
          <Text style={styles.prompt}>어떤 모드로 열까요?</Text>

          <Pressable style={styles.row} onPress={onSupervisor}>
            <View style={styles.iconWrap}>
              <StatisticIcon width={24} height={24} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>관리자 모드</Text>
              <Text style={styles.rowSub}>매장 관리 · 통계 · 설정</Text>
            </View>
          </Pressable>

          <Pressable style={styles.row} onPress={onClient}>
            <View style={styles.iconWrap}>
              <ProfileIcon width={24} height={24} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>고객 모드</Text>
              <Text style={styles.rowSub}>적립 · 쿠폰 사용 (카운터용)</Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.lockRow} onPress={onLockClient}>
            <Text style={styles.lockText}>이 기기를 고객 전용으로 고정</Text>
            <Text style={styles.lockSub}>
              관리자 복귀 시 PIN이 필요해요 · 카운터 태블릿에 추천
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const createStyles = (t: Theme) =>
  StyleSheet.create({
    sheetBg: {
      backgroundColor: t.color.surface.normal.bg1,
    },
    handle: {
      backgroundColor: t.palette.gray[300],
      width: 40,
    },
    content: {
      paddingHorizontal: t.spacing[6],
      paddingBottom: t.spacing[8],
    },
    storeName: {
      fontSize: 22,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      marginTop: t.spacing[1],
    },
    prompt: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      marginTop: t.spacing[1],
      marginBottom: t.spacing[4],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[4],
      backgroundColor: t.color.surface.normal.container10,
      borderRadius: t.radius.lg,
      paddingVertical: t.spacing[4],
      paddingHorizontal: t.spacing[4],
      marginBottom: t.spacing[3],
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.color.surface.normal.bg1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: 17,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    rowSub: {
      fontSize: 13,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
    },
    divider: {
      height: 1,
      backgroundColor: t.palette.gray[200],
      marginVertical: t.spacing[3],
    },
    lockRow: {
      paddingVertical: t.spacing[2],
    },
    lockText: {
      fontSize: 15,
      fontFamily: t.font.semibold,
      color: t.color.surface.brand.primary,
    },
    lockSub: {
      fontSize: 13,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
      marginTop: 2,
    },
  });

StoreModeSheet.displayName = 'StoreModeSheet';

export default StoreModeSheet;
