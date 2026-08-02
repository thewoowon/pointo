import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {AlertCircleIcon} from '../../components/Icons';

/**
 * 회원 탈퇴 확인 화면.
 * 시스템 Alert 더블 컨펌 대신, 탈퇴로 사라지는 것을 명확히 보여주고
 * 안전한 액션("계속 이용할게요")을 primary로 둔다. (confirm-shy 패턴)
 * 실제 탈퇴는 즉시 삭제가 아니라 30일 유예(soft delete)로 접수된다.
 */
const DeletionConfirmScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, ownerEmail} = useAuth();
  const {getOwnerSlotInfo, requestAccountDeletion} = useFirestore();

  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!ownerUid) return;
        const info = await getOwnerSlotInfo(ownerUid);
        if (active) setStoreCount(info.current);
      })();
      return () => {
        active = false;
      };
      // getOwnerSlotInfo는 매 렌더 새 참조 — uid만 의존
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerUid]),
  );

  const handleWithdraw = async () => {
    if (!ownerUid || busy) return;
    setBusy(true);
    const ok = await requestAccountDeletion(ownerUid);
    setBusy(false);
    if (!ok) {
      Alert.alert(
        '오류',
        '탈퇴 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
      );
      return;
    }
    // 유예 상태 화면으로 이동 — 복구/로그아웃 안내는 거기서 담당
    navigation.reset({index: 0, routes: [{name: 'DeletionPending'}]});
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>회원탈퇴</Text>
          </View>
          <Pressable
            style={styles.backWrap}
            onPress={() => navigation.goBack()}
            hitSlop={8}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <AlertCircleIcon
              width={30}
              height={30}
              color={theme.palette.red[500]}
            />
          </View>
          <Text style={styles.title}>정말 탈퇴하시겠습니까?</Text>
          <Text style={styles.subtitle}>
            탈퇴하면 아래 정보가 모두 사라져요.
            {ownerEmail ? `\n${ownerEmail}` : ''}
          </Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.dot} />
              <Text style={styles.infoText}>
                운영 중인 매장{' '}
                <Text style={styles.infoStrong}>{storeCount ?? 0}곳</Text>이
                비활성화돼요
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.dot} />
              <Text style={styles.infoText}>
                손님들의 스탬프·쿠폰 적립 내역을 더 이상 관리할 수 없어요
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.dot} />
              <Text style={styles.infoText}>
                계정 정보는 30일 후 완전히 삭제돼요
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({pressed}) => [
              styles.primaryBtn,
              pressed && {opacity: 0.9},
            ]}
            onPress={() => navigation.goBack()}
            disabled={busy}>
            <Text style={styles.primaryBtnText}>계속 이용할게요</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [
              styles.withdrawBtn,
              {opacity: busy || pressed ? 0.5 : 1},
            ]}
            onPress={handleWithdraw}
            disabled={busy}>
            <Text style={styles.withdrawText}>
              {busy ? '처리 중...' : '탈퇴하기'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.container0,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    headerCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highestemp,
    },
    backWrap: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      paddingHorizontal: t.spacing[5],
    },
    backText: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: t.spacing[6],
      paddingTop: t.spacing[10],
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.palette.red[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: t.spacing[5],
    },
    title: {
      fontSize: 20,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: t.spacing[3],
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      lineHeight: 23,
    },
    infoCard: {
      width: '100%',
      marginTop: t.spacing[8],
      backgroundColor: t.color.surface.normal.container10,
      borderRadius: 16,
      paddingHorizontal: t.spacing[5],
      paddingVertical: t.spacing[2],
      // shadow
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing[3],
      paddingVertical: t.spacing[4],
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.palette.red[500],
      marginTop: 7,
    },
    infoText: {
      flex: 1,
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highemp,
      lineHeight: 22,
    },
    infoStrong: {
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    divider: {
      height: 1,
      backgroundColor: t.palette.gray[200],
    },
    actions: {
      paddingHorizontal: t.spacing[6],
      paddingBottom: t.spacing[6],
      gap: t.spacing[2],
    },
    primaryBtn: {
      height: 56,
      backgroundColor: t.color.surface.brand.primary,
      borderRadius: t.radius.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryBtnText: {
      fontSize: 16,
      fontFamily: t.font.semibold,
      color: t.color.etc.absolute.white,
    },
    withdrawBtn: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    withdrawText: {
      fontSize: 15,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.lowemp,
    },
  });

export default DeletionConfirmScreen;
