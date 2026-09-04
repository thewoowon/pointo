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
import {
  SURVEY_QUESTIONS,
  SURVEY_ID,
  hasAnyAnswer,
  markSurveyDone,
  snoozeSurvey,
  submitSurvey,
  type SurveyAnswers,
} from '../../services/survey';

const CONTENT_MAX_WIDTH = 480;
/** 보기에 딸린 자유 입력 한 줄의 상한. 본문은 어차피 3번 문항이 받는다. */
const INLINE_TEXT_MAX = 120;
const FREE_TEXT_MAX = 1000;

/**
 * 이용 설문.
 *
 * 문자로 보낸 구글 폼은 회수가 2건이었고 그중 하나는 폼이 아니라 문자로 돌아왔다.
 * 점주는 링크를 누르지 않는다 — 그래서 이미 열어보는 화면 안에서 묻는다.
 *
 * 답을 강제하지 않는다. 한 문항만 답하고 보내도 받는다. 완결성보다 회수가
 * 중요한 단계이고, 부분 응답이라도 없는 것보다 낫다.
 */
const SurveyScreen = ({navigation}: any) => {
  const theme = useTheme();
  const {isExpanded} = useLayoutMode();
  const styles = useMemo(
    () => createStyles(theme, isExpanded),
    [theme, isExpanded],
  );

  const {ownerUid, ownerEmail, ownerProvider} = useAuth();
  const {track} = useAnalytics();

  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [isSending, setIsSending] = useState(false);
  // 전송 성공 뒤에도 화면이 한 프레임 남는다 — 그 사이 재탭으로 같은 응답이
  // 두 번 들어가지 않게 막는다 (OpinionScreen과 같은 이유).
  const sentRef = useRef(false);

  const canSubmit = hasAnyAnswer(answers) && !isSending;

  const pick = (qid: string, value: string) =>
    setAnswers(prev => {
      // 같은 보기를 다시 누르면 선택 해제. 잘못 누른 뒤 되돌릴 방법이 있어야 한다.
      if (prev[qid]?.value === value) {
        const rest = {...prev};
        delete rest[qid];
        return rest;
      }
      return {...prev, [qid]: {value, text: prev[qid]?.text}};
    });

  const write = (qid: string, text: string) =>
    setAnswers(prev => ({...prev, [qid]: {...prev[qid], text}}));

  /** 지금은 답하지 않겠다 — 일정 기간 뒤에 다시 묻는다. */
  const handleLater = async () => {
    if (ownerUid) await snoozeSurvey(ownerUid);
    navigation.goBack();
  };

  const handleSubmit = async () => {
    if (!canSubmit || sentRef.current) return;
    setIsSending(true);
    const ok = await submitSurvey(answers, {
      email: ownerEmail,
      provider: ownerProvider,
    });
    setIsSending(false);

    if (!ok) {
      Alert.alert(
        '보내지 못했어요',
        '네트워크 상태를 확인하고 다시 시도해주세요.',
      );
      return;
    }

    sentRef.current = true;
    if (ownerUid) await markSurveyDone(ownerUid);
    try {
      track(AnalyticsEvent.SURVEY_SUBMITTED, {
        survey_id: SURVEY_ID,
        answered: Object.keys(answers).length,
      });
    } catch (error) {
      console.log('Error logging survey event:', error);
    }

    Alert.alert('보내주셔서 감사해요', '남겨주신 답은 꼭 반영할게요.', [
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
            <Text style={styles.headerTitle}>이용 설문</Text>
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
            <Text style={styles.title}>30초만 여쭤볼게요</Text>
            <Text style={styles.subtitle}>
              답해주신 내용은 다음에 무엇을 만들지 정하는 데 그대로 쓰여요.
              {'\n'}편한 문항만 답하고 보내셔도 괜찮아요.
            </Text>

            <View style={styles.column}>
              {SURVEY_QUESTIONS.map((q, index) => {
                const answer = answers[q.id];
                const picked = q.options?.find(o => o.value === answer?.value);
                const showInlineText = Boolean(picked?.withText);

                return (
                  <View key={q.id} style={styles.question}>
                    <Text style={styles.questionTitle}>
                      {index + 1}. {q.title}
                      {q.optional && (
                        <Text style={styles.optional}> (선택)</Text>
                      )}
                    </Text>

                    {q.options && (
                      <View style={styles.options}>
                        {q.options.map(o => {
                          const active = answer?.value === o.value;
                          return (
                            <Pressable
                              key={o.value}
                              onPress={() => pick(q.id, o.value)}
                              disabled={isSending}
                              style={[
                                styles.option,
                                active && styles.optionActive,
                              ]}>
                              <Text
                                style={[
                                  styles.optionText,
                                  active && styles.optionTextActive,
                                ]}>
                                {o.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    {(q.freeText || showInlineText) && (
                      <TextInput
                        style={[
                          styles.input,
                          q.freeText ? styles.inputTall : styles.inputShort,
                        ]}
                        value={answer?.text ?? ''}
                        onChangeText={t => write(q.id, t)}
                        placeholder={
                          q.freeText
                            ? q.placeholder
                            : // 검색으로 왔다면 무슨 말로 찾았는지가 핵심이다.
                            // 이 한 줄이 우리가 잡아야 할 검색어를 알려준다.
                            q.id === 'acquisition'
                            ? '어떤 말로 검색하셨나요?'
                            : '자유롭게 적어주세요'
                        }
                        placeholderTextColor={
                          theme.color.texticon.onNormal.lowemp
                        }
                        multiline={q.freeText}
                        textAlignVertical={q.freeText ? 'top' : 'center'}
                        maxLength={q.freeText ? FREE_TEXT_MAX : INLINE_TEXT_MAX}
                        editable={!isSending}
                      />
                    )}
                  </View>
                );
              })}

              <Pressable
                style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
                onPress={handleSubmit}
                disabled={!canSubmit}>
                <Text
                  style={[
                    styles.submitText,
                    !canSubmit && styles.submitTextOff,
                  ]}>
                  {isSending ? '보내는 중…' : '보내기'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleLater}
                disabled={isSending}
                hitSlop={12}
                style={({pressed}) => [
                  styles.laterWrap,
                  {opacity: pressed ? 0.6 : 1},
                ]}>
                <Text style={styles.laterText}>다음에 할게요</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (t: Theme, isExpanded: boolean) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: t.color.surface.normal.container10},
    safeArea: {flex: 1},
    flex: {flex: 1},
    header: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    headerCenter: {flex: 1, justifyContent: 'center', alignItems: 'center'},
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
      paddingTop: isExpanded ? t.spacing[12] : t.spacing[8],
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

    column: {width: '100%', maxWidth: CONTENT_MAX_WIDTH},

    question: {marginTop: isExpanded ? t.spacing[10] : t.spacing[8]},
    questionTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.highestemp,
    },
    optional: {
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.lowemp,
    },

    options: {marginTop: t.spacing[3], gap: t.spacing[2]},
    option: {
      paddingVertical: 14,
      paddingHorizontal: t.spacing[4],
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.color.surface.normal.bg1,
      backgroundColor: t.color.surface.normal.bg1,
    },
    optionActive: {
      borderColor: t.color.border.brand.primary,
    },
    optionText: {
      fontSize: 15,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    optionTextActive: {fontFamily: t.font.semibold},

    input: {
      marginTop: t.spacing[2],
      backgroundColor: t.color.surface.normal.bg1,
      borderRadius: t.radius.md,
      borderWidth: 1.5,
      borderColor: t.color.surface.normal.bg1,
      paddingHorizontal: t.spacing[4],
      fontSize: 15,
      lineHeight: 22,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.highestemp,
    },
    inputShort: {height: 48, paddingVertical: 0},
    inputTall: {height: 120, paddingVertical: t.spacing[3]},

    submitBtn: {
      marginTop: isExpanded ? t.spacing[12] : t.spacing[10],
      height: 52,
      borderRadius: t.radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.color.surface.brand.primary,
    },
    submitBtnOff: {backgroundColor: t.color.surface.env.disabled},
    submitText: {
      fontSize: 16,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onBrand.onPrimary,
    },
    submitTextOff: {color: t.color.texticon.onEnv.onDisabled},

    laterWrap: {marginTop: t.spacing[5], alignItems: 'center'},
    laterText: {
      fontSize: 14,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
    },
  });

export default SurveyScreen;
