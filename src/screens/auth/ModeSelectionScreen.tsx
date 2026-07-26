import React, {useMemo} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ProfileIcon, StatisticIcon} from '../../components/Icons';
import {useLayoutMode, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
// import {BackgroundDeco} from '../../components/background';

const ModeSelectionScreen = ({navigation}: any) => {
  const {isCompact} = useLayoutMode();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSignIn = (mode: 'supervisor' | 'client') => {
    navigation.navigate('SignIn', {mode});
  };

  const compactCard = isCompact && {
    flex: undefined,
    width: '100%' as const,
    paddingVertical: theme.spacing[10],
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.wrapper}>
          <View style={styles.flexBox}>
            <View>
              <Text style={styles.title}>모드를 선택해주세요</Text>
            </View>
            <View style={isCompact ? styles.flexBoxColumn : styles.flexBoxRow}>
              <Pressable
                style={[styles.modeContainer, compactCard]}
                onPress={() => {
                  navigation.navigate('EmailAuth');
                }}>
                <StatisticIcon />
                <Text style={styles.buttonText}>관리자 모드</Text>
              </Pressable>
              <Pressable
                style={[styles.modeContainer, compactCard]}
                onPress={() => {
                  handleSignIn('client');
                }}>
                <ProfileIcon />
                <Text style={styles.buttonText}>고객 모드</Text>
              </Pressable>
            </View>
          </View>
        </View>
        <Pressable
          style={styles.registerLink}
          onPress={() => navigation.navigate('StoreRegister')}>
          <Text style={styles.registerLinkText}>
            처음 사용하시나요? 가게 등록하기 →
          </Text>
        </Pressable>
        {/* <BackgroundDeco /> */}
      </SafeAreaView>
    </View>
  );
};

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    wrapper: {
      flex: 1,
      paddingLeft: t.spacing[5],
      paddingRight: t.spacing[5],
    },
    backgroundStyle: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
      lineHeight: 32,
      letterSpacing: 1,
    },
    flexBox: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[8],
    },
    flexBoxRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[4],
    },
    flexBoxColumn: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing[4],
      width: '100%',
    },
    modeContainer: {
      flex: 1,
      maxWidth: 391,
      gap: t.spacing[1],
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 88,
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.md,
      // shadow
      shadowColor: t.color.etc.absolute.black,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 10,
    },
    buttonText: {
      color: t.color.texticon.onNormal.highestemp,
      fontSize: 24,
      fontFamily: t.font.semibold,
    },
    registerLink: {
      position: 'absolute',
      bottom: t.spacing[8],
      alignSelf: 'center',
    },
    registerLinkText: {
      fontSize: 16,
      fontFamily: t.font.regular,
      // 링크 강조 = 브랜드 프라이머리(블루). 옛 오렌지(#D4845A) 폐기.
      color: t.color.texticon.onNormal.primary,
    },
  });

export default ModeSelectionScreen;
