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
import {signOutGoogle} from '../../services/auth';

const GRACE_DAYS = 30;

/** deletedAt(ISO)로부터 남은 유예 일수 계산. */
const daysLeft = (deletedAt?: string | null): number => {
  if (!deletedAt) return GRACE_DAYS;
  const purgeAt = new Date(deletedAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
};

/**
 * 탈퇴 유예(pending_deletion) 상태 화면.
 * 탈퇴 접수 직후 또는 유예 기간 중 재로그인 시 진입한다. 매장 접근은 차단되고
 * 복구하기 / 로그아웃만 가능하다. (Apple '즉시 접근 불가' 요건 충족)
 */
const DeletionPendingScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, ownerEmail, setOwnerUid, setOwnerEmail} = useAuth();
  const {getOwnerProfile, restoreAccount} = useFirestore();

  const [remaining, setRemaining] = useState<number>(GRACE_DAYS);
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
        setRemaining(daysLeft(owner?.deletedAt));
        setLoading(false);
      })();
      return () => {
        active = false;
      };
      // getOwnerProfile은 매 렌더 새 참조 — uid만 의존
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ownerUid]),
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
    await signOutGoogle();
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
        <View style={styles.body}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>탈퇴가 접수되었어요</Text>
          {loading ? (
            <ActivityIndicator
              style={{marginTop: theme.spacing[4]}}
              color={theme.color.surface.brand.primary}
            />
          ) : (
            <Text style={styles.subtitle}>
              {ownerEmail ? `${ownerEmail}\n` : ''}
              <Text style={styles.strong}>{remaining}일</Text> 후 계정과 모든
              데이터가 영구 삭제돼요.{'\n'}그 전에 언제든 복구할 수 있어요.
            </Text>
          )}
        </View>

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
      backgroundColor: t.color.surface.normal.bg1,
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: t.spacing[6],
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[3],
    },
    emoji: {
      fontSize: 64,
    },
    title: {
      fontSize: 24,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      lineHeight: 23,
    },
    strong: {
      fontFamily: t.font.semibold,
      color: t.color.surface.brand.primary,
    },
    actions: {
      paddingBottom: t.spacing[8],
      gap: t.spacing[3],
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
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: 15,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.midemp,
    },
  });

export default DeletionPendingScreen;
