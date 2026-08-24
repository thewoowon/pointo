import React, {forwardRef, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import {useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {
  StatisticIcon,
  ProfileIcon,
  RightChevronIcon,
} from '../../components/Icons';

export type SheetStore = {storeCode: string; name: string};

type Props = {
  store: SheetStore | null;
  onSupervisor: () => void;
  onClient: () => void;
  onLockClient: () => void;
};

/**
 * 스토어 선택 후 뜨는 **기기 역할** 선택 바텀시트.
 *   관리자용 / 고객용 / 이 기기 고객 전용 고정(PIN)
 * 부모가 ref.present() 로 호출한다.
 *
 * "모드를 고른다"가 아니라 "역할을 배정한다"로 말하는 이유:
 * 둘 중 하나만 고르면 되는 것처럼 읽히면, 기기 한 대로 들어와 아무것도 못 하고
 * 나가는 일이 생긴다(자연유입 점주의 실제 이탈 경로다). 두 화면이 짝이라는 사실을
 * 알려주기 가장 좋은 순간이 고르는 바로 이 순간이라 여기서 한 줄 못 박는다.
 */
const StoreModeSheet = forwardRef<BottomSheetModal, Props>(
  ({store, onSupervisor, onClient, onLockClient}, ref) => {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const snapPoints = useMemo(() => ['56%'], []);

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
          <Text style={styles.prompt}>이 기기의 역할을 정해주세요</Text>
          <Text style={styles.note}>
            두 화면이 짝을 이뤄 동작해요. 고객용 기기가 없으면 관리자 화면의 QR로
            손님 휴대폰을 대신 쓸 수 있어요.
          </Text>

          <Pressable style={styles.row} onPress={onSupervisor}>
            <View style={styles.rowWrap}>
              <View style={styles.iconWrapBlue}>
                <StatisticIcon
                  width={24}
                  height={24}
                  color={theme.color.texticon.onNormal.primary}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>관리자용</Text>
                <Text style={styles.rowSub}>
                  사장님이 보는 화면 · 적립내역 · 통계
                </Text>
              </View>
            </View>
            <RightChevronIcon />
          </Pressable>

          <Pressable style={styles.row} onPress={onClient}>
            <View style={styles.rowWrap}>
              <View style={styles.iconWrapEmber}>
                <ProfileIcon width={24} height={24} color={'#F97316'} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>고객용</Text>
                <Text style={styles.rowSub}>
                  손님에게 내주는 화면 · 번호 입력
                </Text>
              </View>
            </View>
            <RightChevronIcon />
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
      fontSize: 14,
      lineHeight: 24,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.primary,
      marginTop: t.spacing[1],
    },
    prompt: {
      fontSize: 20,
      fontFamily: t.font.bold,
      color: t.color.texticon.onNormal.highemp,
      lineHeight: 28,
    },
    note: {
      fontSize: 13,
      lineHeight: 20,
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
      borderRadius: t.radius.md,
      paddingVertical: t.spacing[4],
      paddingHorizontal: t.spacing[4],
      marginBottom: t.spacing[2.5],
    },
    rowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[3.5],
      flex: 1,
    },
    iconWrapBlue: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#D9E9FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconWrapEmber: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#FFEDD5',
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highemp,
    },
    rowSub: {
      fontSize: 12,
      lineHeight: 19,
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
