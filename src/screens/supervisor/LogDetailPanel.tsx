import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import dayjs from 'dayjs';
import {useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {ShortRightArrowIcon, XIcon} from '../../components/Icons';
import {logActionStyle} from './logDisplay';

export type SelectedLogContext = {
  selectedLog: Log | null;
  /** 'detail' = 선택한 한 건, 'list' = 그 고객의 전체 이력 */
  viewMode: 'detail' | 'list';
  logList: Log[];
};

const formatPhone = (phone: string) =>
  phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');

/**
 * 적립내역 우측 상세 패널.
 * 태블릿은 목록 옆에 상주하고, 모바일은 목록을 덮는 전체 화면으로 열린다
 * (MainScreen의 useMasterDetail이 어느 쪽을 보일지 결정).
 *
 * 네비게이션은 헤더만 갖는다 — 좌측은 언제나 "한 단계 뒤로", 우측 ✕는 패널을
 * 비우는 태블릿 전용 동작이다. 본문에는 뒤로 가는 버튼을 두지 않는다.
 * (모바일에서 "나가기"는 곧 뒤로이므로 ✕가 없고, 그래서 선택만 비워진 빈 패널에
 *  갇히는 막다른 길도 생기지 않는다.)
 */
const LogDetailPanel = ({
  context,
  onContextChange,
  isCompact,
  onBack,
}: {
  context: SelectedLogContext;
  onContextChange: (next: SelectedLogContext) => void;
  isCompact: boolean;
  /** 모바일에서 목록으로 되돌아가기 */
  onBack: () => void;
}) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {selectedLog, viewMode} = context;
  const isHistory = viewMode === 'list';

  /** 태블릿 전용 — 패널이 상주하므로 선택을 비울 수단이 따로 필요하다. */
  const clearSelection = () =>
    onContextChange({selectedLog: null, viewMode: 'detail', logList: []});

  const showDetailOf = () => onContextChange({...context, viewMode: 'detail'});

  // 한 단계 뒤로: 전체내역 → 상세, 상세 → 목록(모바일뿐. 태블릿은 목록이 옆에 있다).
  const goBack = isHistory ? showDetailOf : isCompact ? onBack : null;

  if (!selectedLog) {
    return (
      <View
        style={[
          styles.panel,
          styles.panelEmpty,
          !isCompact && styles.panelExpanded,
        ]}>
        <Text style={styles.emptyText}>내역을 선택하면</Text>
        <Text style={styles.emptyText}>자세한 정보를 볼 수 있어요</Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, !isCompact && styles.panelExpanded]}>
      {/* 헤더 — Switcher 기준 (투명 · 중앙 타이틀) */}
      <View style={styles.header}>
        {goBack && (
          <Pressable style={styles.headerLeft} onPress={goBack} hitSlop={8}>
            <Text style={styles.headerLeftText}>뒤로</Text>
          </Pressable>
        )}
        <Text style={styles.headerTitle}>
          {isHistory ? '고객 전체내역' : '적립내역 상세'}
        </Text>
        {!isCompact && (
          <Pressable
            style={styles.headerRight}
            onPress={clearSelection}
            hitSlop={8}>
            <XIcon />
          </Pressable>
        )}
      </View>

      <View style={styles.phoneRow}>
        <Text style={styles.phoneLabel}>고객 번호</Text>
        <Text style={styles.phoneValue}>
          {formatPhone(selectedLog.phone_number)}
        </Text>
      </View>

      {!isHistory ? (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <ActionPill log={selectedLog} theme={theme} styles={styles} />
              <Text style={styles.cardTime}>
                {dayjs(selectedLog.timestamp).format('M월 D일 HH:mm')}
              </Text>
            </View>
            <View style={styles.cardBodyRow}>
              <Text style={styles.cardNote}>
                {selectedLog.action === 'stamp_saved'
                  ? '스탬프 적립'
                  : selectedLog.note}
              </Text>
              <Text style={styles.cardAmount}>
                {selectedLog.action === 'stamp_saved'
                  ? `+${selectedLog.stamp}`
                  : `-${selectedLog.stamp}`}
              </Text>
            </View>
          </View>
          {/* 유일한 전진 동작 — 어딘가로 넘어간다는 걸 ›로 알린다. */}
          <Pressable
            style={({pressed}) => [styles.navRow, pressed && styles.pressed]}
            onPress={() => onContextChange({...context, viewMode: 'list'})}>
            <Text style={styles.navRowText}>고객 전체내역 보기</Text>
            <ShortRightArrowIcon width={18} height={18} />
          </Pressable>
        </>
      ) : (
        <View style={[styles.card, styles.fill]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {context.logList.map((log, index) => (
              <View key={index} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <ActionPill log={log} theme={theme} styles={styles} />
                  <Text style={styles.historyNote}>{log.note}</Text>
                </View>
                <Text style={styles.historyTime}>
                  {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm')}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

/** 적립/사용 pill — 색·라벨은 목록과 같은 logDisplay 규칙을 따른다. */
const ActionPill = ({
  log,
  theme,
  styles,
}: {
  log: Log;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}) => {
  const st = logActionStyle(log.action, theme);
  return (
    <View style={[styles.pill, {backgroundColor: st.bg}]}>
      <Text style={[styles.pillText, {color: st.fg}]}>
        {st.label} {log.stamp}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    panel: {
      flex: 1,
      height: '100%',
      backgroundColor: theme.color.surface.normal.container10,
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    panelEmpty: {justifyContent: 'center', alignItems: 'center'},
    /** 태블릿에선 목록과 나란히 놓이므로 폭을 제한한다. */
    panelExpanded: {maxWidth: 536},
    fill: {flex: 1},
    pressed: {opacity: 0.7},
    emptyText: {
      color: theme.palette.gray[300],
      fontFamily: theme.font.medium,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: -1,
    },
    header: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    headerTitle: {
      color: theme.color.texticon.onNormal.highestemp,
      fontFamily: theme.font.medium,
      fontSize: 16,
      lineHeight: 26,
      letterSpacing: -1,
    },
    headerLeft: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    headerLeftText: {
      fontFamily: theme.font.regular,
      fontSize: 14,
      color: theme.color.texticon.onNormal.highestemp,
    },
    headerRight: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    phoneRow: {
      flexDirection: 'row',
      marginBottom: 24,
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 10,
    },
    phoneLabel: {
      color: theme.color.texticon.onNormal.midemp,
      fontFamily: theme.font.medium,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
    },
    phoneValue: {
      color: theme.color.texticon.onNormal.highestemp,
      fontFamily: theme.font.semibold,
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -1,
    },
    card: {
      paddingVertical: 20,
      paddingHorizontal: 16,
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 8,
      flexDirection: 'column',
      gap: 20,
    },
    cardHeadRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    cardTime: {
      color: theme.color.texticon.onNormal.midemp,
      fontFamily: theme.font.regular,
      fontSize: 12,
      lineHeight: 19,
      letterSpacing: -1,
    },
    cardBodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
    },
    cardNote: {
      color: theme.color.texticon.onNormal.highestemp,
      fontFamily: theme.font.medium,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
    },
    cardAmount: {
      color: theme.color.texticon.onNormal.highestemp,
      fontFamily: theme.font.semibold,
      fontSize: 16,
      lineHeight: 26,
      letterSpacing: -1,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.surface.normal.bg1,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginTop: 12,
    },
    navRowText: {
      color: theme.color.texticon.onNormal.highestemp,
      fontFamily: theme.font.medium,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.gray[200],
      paddingVertical: 16,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 16,
      flex: 1,
    },
    historyNote: {
      color: theme.color.texticon.onNormal.highestemp,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
      fontFamily: theme.font.regular,
    },
    historyTime: {
      width: 120,
      color: theme.color.texticon.onNormal.midemp,
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
    },
    pill: {
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 999,
      width: 62,
      height: 32,
    },
    pillText: {
      fontSize: 14,
      lineHeight: 24,
      letterSpacing: -1,
      fontFamily: theme.font.semibold,
    },
  });

export default LogDetailPanel;
