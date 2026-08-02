import React, {useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {signOutGoogle} from '../../services/auth';
import {ShortRightArrowIcon} from '../../components/Icons';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

/**
 * 계정 설정 — Switcher(계정 허브)에서 진입한다.
 * 로그인 계정 확인 · 개인정보처리방침 · 로그아웃 · 회원 탈퇴.
 * 회원 탈퇴는 즉시 삭제가 아니라 30일 유예(soft delete) 후 서버가 실삭제한다.
 */
const AccountSettingsScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerUid, ownerEmail, setOwnerUid, setOwnerEmail} = useAuth();
  const {requestAccountDeletion} = useFirestore();

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    await signOutGoogle();
    setOwnerUid(null);
    setOwnerEmail(null);
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
  };

  const proceedDeletion = async () => {
    if (!ownerUid) return;
    setBusy(true);
    const ok = await requestAccountDeletion(ownerUid);
    setBusy(false);
    if (!ok) {
      Alert.alert('오류', '탈퇴 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    // 유예 상태 화면으로 이동 — 복구/영구삭제 안내는 거기서 담당
    navigation.reset({index: 0, routes: [{name: 'DeletionPending'}]});
  };

  const handleDeleteAccount = () => {
    // 1단계: 무슨 일이 벌어지는지 안내
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 30일 후 계정과 개인정보가 영구 삭제돼요.\n30일 안에 다시 로그인하면 복구할 수 있어요.\n\n계속할까요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '탈퇴 진행',
          style: 'destructive',
          // 2단계: 최종 확인
          onPress: () =>
            Alert.alert('정말 탈퇴하시겠어요?', '이 계정으로 더 이상 매장에 접근할 수 없어요.', [
              {text: '취소', style: 'cancel'},
              {text: '탈퇴하기', style: 'destructive', onPress: proceedDeletion},
            ]),
        },
      ],
    );
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
            <Text style={styles.headerTitle}>설정</Text>
          </View>
          <Pressable
            style={styles.backWrap}
            onPress={() => navigation.goBack()}
            hitSlop={8}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 로그인 계정 */}
          <Text style={styles.sectionLabel}>로그인 계정</Text>
          <View style={styles.accountCard}>
            <Text style={styles.accountEmail}>{ownerEmail ?? '-'}</Text>
          </View>

          {/* 약관/정책 */}
          <Text style={styles.sectionLabel}>약관</Text>
          <Pressable
            style={styles.row}
            onPress={() => setPrivacyVisible(true)}>
            <Text style={styles.rowText}>개인정보 처리방침</Text>
            <ShortRightArrowIcon width={20} height={20} />
          </Pressable>

          {/* 계정 관리 */}
          <Text style={styles.sectionLabel}>계정</Text>
          <Pressable style={styles.row} onPress={handleLogout}>
            <Text style={styles.rowText}>로그아웃</Text>
            <ShortRightArrowIcon width={20} height={20} />
          </Pressable>
          <Pressable
            style={({pressed}) => [styles.row, {opacity: busy || pressed ? 0.6 : 1}]}
            onPress={handleDeleteAccount}
            disabled={busy}>
            <Text style={styles.dangerText}>회원 탈퇴</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <PrivacyPolicyModal
        visible={privacyVisible}
        onClose={() => setPrivacyVisible(false)}
      />
    </View>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.container10,
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
    headerTitle: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highestemp,
    },
    scrollContent: {
      padding: t.spacing[5],
      gap: t.spacing[2],
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.lowemp,
      marginTop: t.spacing[4],
      marginBottom: t.spacing[1],
      marginLeft: t.spacing[1],
    },
    accountCard: {
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.palette.gray[200],
      paddingVertical: t.spacing[5],
      paddingHorizontal: t.spacing[5],
    },
    accountEmail: {
      fontSize: 16,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.palette.gray[200],
      paddingVertical: t.spacing[4],
      paddingHorizontal: t.spacing[5],
    },
    rowText: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.color.texticon.onNormal.highestemp,
    },
    dangerText: {
      fontSize: 16,
      fontFamily: t.font.medium,
      color: t.palette.red[500],
    },
  });

export default AccountSettingsScreen;
