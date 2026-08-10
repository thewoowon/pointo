import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import {useAuth, useLayoutMode, useStoreConfig, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {MagnifierIcon, NewXIcon} from '../../components/Icons';
import {maskPhone} from './logDisplay';
import {
  MIN_QUERY_LENGTH,
  useCustomerSearch,
  type CustomerHit,
} from './useCustomerSearch';

/** 'YYYY-MM-DD' → '오늘' / '어제' / 'N일 전' / 'YY.MM.DD' */
function lastVisitLabel(lastUsed?: string): string {
  if (!lastUsed) return '방문 기록 없음';
  const day = dayjs(lastUsed);
  if (!day.isValid()) return '방문 기록 없음';
  const diff = dayjs().startOf('day').diff(day.startOf('day'), 'day');
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 30) return `${diff}일 전`;
  return day.format('YY.MM.DD');
}

/**
 * 매장 귀속 고객을 번호로 찾아 적립/사용 시트로 넘기는 관리자 전용 검색.
 * 모바일은 바텀시트, 태블릿은 중앙 모달 — 내용은 동일.
 */
const CustomerSearchSheet = ({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (phone: string) => void;
}) => {
  const theme = useTheme();
  const {isCompact} = useLayoutMode();
  const s = useMemo(() => createStyles(theme, isCompact), [theme, isCompact]);
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {query, setQuery, digits, results, loading, isEmpty} =
    useCustomerSearch(visible);

  const holdingLabel = (c: CustomerHit) =>
    storeConfig.mode === 'point'
      ? `${(c.stamps ?? 0).toLocaleString()}${storeConfig.pointUnit}`
      : `${(c.stamps ?? 0) % storeConfig.stampsPerCoupon}/${
          storeConfig.stampsPerCoupon
        }개`;

  const body = (
    <>
      <View style={s.topRow}>
        <View style={s.topBtn} />
        <Text style={s.title}>고객 검색</Text>
        <Pressable onPress={onClose} hitSlop={8} style={s.topBtn}>
          <NewXIcon width={20} height={20} />
        </Pressable>
      </View>

      <View>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={query}
            onChangeText={t => setQuery(t.replace(/\D/g, ''))}
            placeholder="전화번호 뒷자리"
            placeholderTextColor={theme.color.texticon.onNormal.lowemp}
            keyboardType="number-pad"
            maxLength={11}
            autoFocus
          />
          <MagnifierIcon />
        </View>
        <Text style={s.helper}>뒷자리만 입력해도 찾을 수 있어요</Text>
      </View>

      <View style={s.resultArea}>
        {loading ? (
          <View style={s.stateBox}>
            <ActivityIndicator color={theme.color.surface.brand.primary} />
          </View>
        ) : digits.length < MIN_QUERY_LENGTH ? (
          <View style={s.stateBox}>
            <Text style={s.stateText}>
              번호를 {MIN_QUERY_LENGTH}자리 이상 입력해주세요
            </Text>
          </View>
        ) : isEmpty ? (
          <View style={s.stateBox}>
            <Text style={s.stateText}>등록되지 않은 번호예요</Text>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            {results.map(c => (
              <Pressable
                key={c.phone}
                style={s.row}
                onPress={() => onSelect(c.phone)}>
                <View style={s.rowLeft}>
                  <Text style={s.rowPhone}>{maskPhone(c.phone)}</Text>
                  <Text style={s.rowVisit}>{lastVisitLabel(c.last_used)}</Text>
                </View>
                <Text style={s.rowHolding}>{holdingLabel(c)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isCompact ? 'slide' : 'fade'}
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={s.panel} onPress={e => e.stopPropagation()}>
            {body}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme, isCompact: boolean) =>
  StyleSheet.create({
    flex: {flex: 1},
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: isCompact ? 'flex-end' : 'center',
      alignItems: isCompact ? undefined : 'center',
    },
    panel: {
      backgroundColor: theme.color.surface.normal.bg1,
      paddingHorizontal: 24,
      paddingTop: 16,
      gap: 20,
      ...(isCompact
        ? {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: 32,
            maxHeight: '85%',
          }
        : {
            borderRadius: 28,
            paddingBottom: 28,
            width: '90%',
            maxWidth: 480,
            maxHeight: '80%',
          }),
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBtn: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      textAlign: 'center',
      fontFamily: theme.font.semibold,
      fontSize: 20,
      lineHeight: 30,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.surface.normal.container10,
      borderRadius: 16,
      paddingHorizontal: 20,
      height: 56,
    },
    input: {
      flex: 1,
      padding: 0,
      fontFamily: 'SFUIDisplay-Medium',
      fontSize: 20,
      letterSpacing: 0,
      color: theme.color.texticon.onNormal.highestemp,
    },
    helper: {
      marginTop: 8,
      marginLeft: 4,
      fontFamily: theme.font.regular,
      fontSize: 13,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.midemp,
    },
    resultArea: {minHeight: 180, maxHeight: 340},
    stateBox: {flex: 1, minHeight: 180, justifyContent: 'center', alignItems: 'center'},
    stateText: {
      fontFamily: theme.font.regular,
      fontSize: 15,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.midemp,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.normal.container10,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 10,
    },
    rowLeft: {gap: 4},
    rowPhone: {
      fontFamily: 'SFUIDisplay-Medium',
      fontSize: 17,
      letterSpacing: 0,
      color: theme.color.texticon.onNormal.highestemp,
    },
    rowVisit: {
      fontFamily: theme.font.regular,
      fontSize: 13,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.midemp,
    },
    rowHolding: {
      fontFamily: theme.font.semibold,
      fontSize: 16,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.highestemp,
    },
  });

export default CustomerSearchSheet;
