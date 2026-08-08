import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
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
import {signOutOwner} from '../../services/auth';
import {ClockIcon} from '../../components/Icons';

const GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO 문자열을 "2026년 8월 30일" 형태로 포맷. */
const formatKoreanDate = (d: Date): string =>
  `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

/**
 * 탈퇴 유예(pending_deletion) 상태 화면.
 * 탈퇴 접수 직후 또는 유예 기간 중 재로그인 시 진입한다. 매장 접근은 차단되고
 * 계정 복구 / 로그아웃만 가능하다. (Apple '즉시 접근 불가' 요건 충족)
 */
const DeletionPendingScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, setOwnerUid, setOwnerEmail} = useAuth();
  const {getOwnerProfile, restoreAccount} = useFirestore();

  const [requestedAt, setRequestedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!ownerUid) {
          setLoading(false);
          return;
        }
        const owner = await getOwnerProfile(ownerUid);
        if (!active) return;
        setRequestedAt(owner?.deletedAt ? new Date(owner.deletedAt) : new Date());
        setLoading(false);
      })();
      return () => {
        active = false;
      };
      // getOwnerProfile은 매 렌더 새 참조 — uid만 의존
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerUid]),
  );

  const purgeAt = useMemo(
    () =>
      requestedAt ? new Date(requestedAt.getTime() + GRACE_DAYS * DAY_MS) : null,
    [requestedAt],
  );

  const handleRestore = async () => {
    if (!ownerUid) return;
    setBusy(true);
    const ok = await restoreAccount(ownerUid);
    setBusy(false);
    if (!ok) {
      Alert.alert('오류', '복구 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    navigation.reset({index: 0, routes: [{name: 'Switcher'}]});
  };

  const handleLogout = async () => {
    await signOutOwner();
    setOwnerUid(null);
    setOwnerEmail(null);
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
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
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.color.surface.brand.primary} />
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.iconCircle}>
              <ClockIcon
                width={30}
                height={30}
                color={theme.color.surface.brand.primary}
              />
            </View>
            <Text style={styles.title}>탈퇴 처리가 시작됐어요</Text>
            <Text style={styles.subtitle}>
              완전한 탈퇴 처리까지 30일이 걸려요.{'\n'}
              그 전에는 언제든 계정을 복구할 수 있어요.
            </Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>탈퇴 요청일</Text>
                <Text style={styles.infoValue}>
                  {requestedAt ? formatKoreanDate(requestedAt) : '-'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>완전 삭제 예정일</Text>
                <Text style={styles.infoValueDanger}>
                  {purgeAt ? formatKoreanDate(purgeAt) : '-'}
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.note}>
                삭제 예정일까지 매장 운영과 적립 처리가 중단돼요. 계정을 복구하면
                매장과 적립내역이 그대로 돌아와요.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({pressed}) => [
              styles.primaryBtn,
              {opacity: busy || pressed ? 0.7 : 1},
            ]}
            onPress={handleRestore}
            disabled={busy}>
            <Text style={styles.primaryBtnText}>
              {busy ? '복구 중...' : '계정 복구하기'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleLogout}>
            <Text style={styles.secondaryBtnText}>로그아웃</Text>
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
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
      backgroundColor: t.palette.blue[50],
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
      paddingVertical: t.spacing[5],
      gap: t.spacing[3],
      // shadow
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    infoLabel: {
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
    },
    infoValue: {
      fontSize: 15,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    infoValueDanger: {
      fontSize: 15,
      fontFamily: t.font.semibold,
      color: t.palette.red[500],
    },
    divider: {
      height: 1,
      backgroundColor: t.palette.gray[200],
      marginVertical: t.spacing[1],
    },
    note: {
      fontSize: 13,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
      lineHeight: 20,
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
    secondaryBtn: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: 15,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.lowemp,
    },
  });

export default DeletionPendingScreen;
