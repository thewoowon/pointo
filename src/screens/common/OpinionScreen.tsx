import React, {useMemo, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAnalytics, useAuth, useLayoutMode, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {AnalyticsEvent} from '../../analytics/events';
import {LeftChevronIcon} from '../../components/Icons';
import {OPINION_MAX_LENGTH, submitOpinion} from '../../services/feedback';

/**
 * 의견 보내기 — Switcher(계정 허브) 맨 아래에서 진입한다.
 *
 * 지금 점주가 막혔을 때 우리에게 말할 방법이 앱 안에 없다. 스토어 리뷰나 지인
 * 연락으로 흘러나온 뒤에야 알게 되는데, 그건 이미 이탈한 뒤다. 홈에서 두 번
 * 터치로 닿는 자리에 두고, 카테고리 선택 같은 관문 없이 한 칸만 받는다 —
 * 분류는 우리가 하면 되고, 점주에게 분류를 시키면 그 자리에서 그만둔다.
 */
const OpinionScreen = ({navigation}: any) => {
  const theme = useTheme();
  const {isExpanded} = useLayoutMode();
  const styles = useMemo(
    () => createStyles(theme, isExpanded),
    [theme, isExpanded],
  );

  const {ownerEmail, ownerProvider} = useAuth();
  const {track} = useAnalytics();

  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // 전송 성공 직후에도 화면이 한 프레임 남는다. 그 사이 재탭으로 같은 의견이
  // 두 번 들어가지 않게 막는다 (isSending은 성공하면 곧 false로 돌아간다).
  const sentRef = useRef(false);

  const body = text.trim();
  const canSubmit = body.length > 0 && !isSending;

  const handleSubmit = async () => {
    if (!canSubmit || sentRef.current) return;
    setIsSending(true);
    const ok = await submitOpinion({
      text: body,
      email: ownerEmail,
      provider: ownerProvider,
    });
    setIsSending(false);

    if (!ok) {
      Alert.alert(
        '의견을 보내지 못했어요',
        '네트워크 상태를 확인하고 다시 시도해주세요.',
      );
      return;
    }

    sentRef.current = true;
    track(AnalyticsEvent.OPINION_SUBMITTED, {length: body.length});
    Alert.alert('의견을 보냈어요', '잘 읽고 다음 업데이트에 반영할게요.', [
      {text: '확인', onPress: () => navigation.goBack()},
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.container10}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>의견 보내기</Text>
          </View>
          <Pressable
            style={styles.backWrap}
            onPress={() => navigation.goBack()}
            hitSlop={12}>
            <LeftChevronIcon
              color={theme.color.texticon.onNormal.highestemp}
            />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <Text style={styles.title}>
              불편한 점이나 기능을 제안해주세요
            </Text>
            <Text style={styles.subtitle}>
              보내주신 의견은 서비스 개선에 참고해요
            </Text>

            <View style={styles.column}>
              <TextInput
                style={[styles.input, focused && styles.inputFocused]}
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="자유롭게 적어주세요."
                placeholderTextColor={theme.color.texticon.onNormal.lowemp}
                multiline
                textAlignVertical="top"
                maxLength={OPINION_MAX_LENGTH}
                editable={!isSending}
                autoFocus
              />

              <Pressable
                style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
                onPress={handleSubmit}
                disabled={!canSubmit}>
                <Text
                  style={[
                    styles.submitText,
                    !canSubmit && styles.submitTextOff,
                  ]}>
                  {isSending ? '보내는 중...' : '작성 완료'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

// 태블릿에서 한 줄이 지나치게 길어지지 않도록 캡하는 단일 컬럼 폭 (Switcher와 동일)
const CONTENT_MAX_WIDTH = 480;

const createStyles = (t: Theme, isExpanded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.container10,
    },
    safeArea: {
      flex: 1,
    },
    flex: {
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

    scrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: t.spacing[5],
      paddingTop: isExpanded ? t.spacing[16] : t.spacing[10],
      paddingBottom: t.spacing[10],
    },
    title: {
      fontSize: isExpanded ? 20 : 18,
      fontFamily: t.font.bold,
      color: t.color.texticon.onNormal.highestemp,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: t.spacing[2],
      fontSize: isExpanded ? 14 : 13,
      lineHeight: 20,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
    },

    column: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
    },
    input: {
      marginTop: isExpanded ? t.spacing[12] : t.spacing[8],
      height: isExpanded ? 250 : 200,
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.lg,
      borderWidth: 1.5,
      // 평소엔 테두리를 배경에 묻어두고 포커스에서만 드러낸다. 두께를 유지해야
      // 포커스 순간에 입력칸이 2px 흔들리지 않는다.
      borderColor: t.color.surface.normal.bg1,
      paddingHorizontal: t.spacing[4],
      paddingVertical: t.spacing[4],
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    inputFocused: {
      borderColor: t.color.border.brand.primary,
    },

    submitBtn: {
      marginTop: isExpanded ? t.spacing[12] : t.spacing[8],
      height: 52,
      borderRadius: t.radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.color.surface.brand.primary,
    },
    submitBtnOff: {
      backgroundColor: t.color.surface.env.disabled,
    },
    submitText: {
      fontSize: 16,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onBrand.onPrimary,
    },
    submitTextOff: {
      color: t.color.texticon.onEnv.onDisabled,
    },
  });

export default OpinionScreen;
