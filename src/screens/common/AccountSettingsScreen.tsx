import React, {useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {signOutOwner} from '../../services/auth';
import {RightChevronIcon} from '../../components/Icons';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

/**
 * 계정 설정 — Switcher(계정 허브)에서 진입한다.
 * 로그인 계정 확인 · 개인정보처리방침 · 로그아웃 · 회원 탈퇴.
 * 회원 탈퇴는 전용 확인 화면(DeletionConfirm)에서 진행하며, 즉시 삭제가 아니라
 * 30일 유예(soft delete) 후 서버가 실삭제한다.
 */
const AccountSettingsScreen = ({navigation}: any) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {ownerEmail, setOwnerUid, setOwnerEmail} = useAuth();

  const [privacyVisible, setPrivacyVisible] = useState(false);

  const handleLogout = async () => {
    await signOutOwner();
    setOwnerUid(null);
    setOwnerEmail(null);
    navigation.reset({index: 0, routes: [{name: 'Login'}]});
  };

  const handleDeleteAccount = () => {
    // 탈퇴로 사라지는 것을 명확히 보여주는 전용 확인 화면으로
    navigation.navigate('DeletionConfirm');
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
          <Pressable style={styles.row} onPress={() => setPrivacyVisible(true)}>
            <Text style={styles.rowText}>개인정보 처리방침</Text>
            <RightChevronIcon />
          </Pressable>

          {/* 계정 관리 */}
          <Text style={styles.sectionLabel}>계정</Text>
          <Pressable style={styles.row} onPress={handleLogout}>
            <Text style={styles.rowText}>로그아웃</Text>
            <RightChevronIcon />
          </Pressable>
          <Pressable
            style={({pressed}) => [styles.row, {opacity: pressed ? 0.6 : 1}]}
            onPress={handleDeleteAccount}>
            <Text style={styles.dangerText}>회원 탈퇴</Text>
            <RightChevronIcon />
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
      borderRadius: 14,
      paddingVertical: t.spacing[5],
      paddingHorizontal: t.spacing[5],
      // shadow
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
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
      borderRadius: 14,
      paddingVertical: t.spacing[4],
      paddingHorizontal: t.spacing[5],
      // shadow
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.02,
      shadowRadius: 6,
      elevation: 2,
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
