import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuth, useFirestore, useStoreConfig, useTheme} from '../../hooks';
import type {Theme} from '../../theme';

// styles에 바인딩한 서브컴포넌트를 한 번만 생성 (컴포넌트 안 useMemo에서 호출).
// 렌더마다 재정의하지 않으므로 Field 내부 TextInput 포커스가 유지된다.
type Styles = ReturnType<typeof createStyles>;

const createSubComponents = (styles: Styles) => {
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const Field = ({
    label,
    value,
    onChangeText,
    keyboardType = 'default',
    placeholder,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    keyboardType?: 'default' | 'numeric' | 'email-address';
    placeholder?: string;
  }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
      />
    </View>
  );

  return {Section, Field};
};

const StoreSettingsScreen = ({navigation}: any) => {
  const theme = useTheme();
  const c = theme.color;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {Section, Field} = useMemo(() => createSubComponents(styles), [styles]);
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {updateStoreConfig} = useFirestore(storeCode);

  const [storeMode, setStoreMode] = useState<'stamp' | 'point'>(storeConfig.mode);
  const [stampsPerCoupon, setStampsPerCoupon] = useState(
    String(storeConfig.stampsPerCoupon),
  );
  const [sessionTimeout, setSessionTimeout] = useState(
    String(storeConfig.sessionTimeoutSeconds),
  );
  const [idleTimeout, setIdleTimeout] = useState(
    String(storeConfig.idleTimeoutMs / 1000),
  );
  const [couponExpiryDays, setCouponExpiryDays] = useState(
    String(storeConfig.couponExpiryDays ?? 180),
  );
  const [companyName, setCompanyName] = useState(storeConfig.companyName);
  const [contactEmail, setContactEmail] = useState(storeConfig.contactEmail);
  const [guideLine0, setGuideLine0] = useState(storeConfig.guideLines[0] ?? '');
  const [guideLine1, setGuideLine1] = useState(storeConfig.guideLines[1] ?? '');
  const [couponMode, setCouponMode] = useState<'single' | 'double'>(
    storeConfig.couponTypes.length >= 2 ? 'double' : 'single',
  );
  const [couponNames, setCouponNames] = useState<Record<string, string>>(
    Object.fromEntries(storeConfig.couponTypes.map(ct => [ct.id, ct.name])),
  );
  const [pointPresets, setPointPresets] = useState<PointPreset[]>(
    storeConfig.pointPresets ?? [],
  );
  const [pointUnit, setPointUnit] = useState(storeConfig.pointUnit ?? '원');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPoints, setNewPresetPoints] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStoreMode(storeConfig.mode);
    setStampsPerCoupon(String(storeConfig.stampsPerCoupon));
    setSessionTimeout(String(storeConfig.sessionTimeoutSeconds));
    setIdleTimeout(String(storeConfig.idleTimeoutMs / 1000));
    setCouponExpiryDays(String(storeConfig.couponExpiryDays ?? 180));
    setCompanyName(storeConfig.companyName);
    setContactEmail(storeConfig.contactEmail);
    setGuideLine0(storeConfig.guideLines[0] ?? '');
    setGuideLine1(storeConfig.guideLines[1] ?? '');
    setCouponMode(storeConfig.couponTypes.length >= 2 ? 'double' : 'single');
    setCouponNames(
      Object.fromEntries(storeConfig.couponTypes.map(ct => [ct.id, ct.name])),
    );
    setPointPresets(storeConfig.pointPresets ?? []);
    setPointUnit(storeConfig.pointUnit ?? '원');
  }, [storeConfig]);

  const handleAddPreset = () => {
    const name = newPresetName.trim();
    const pts = parseInt(newPresetPoints, 10);
    if (!name) {
      Alert.alert('입력 오류', '프리셋 이름을 입력해주세요.');
      return;
    }
    if (isNaN(pts) || pts < 1) {
      Alert.alert('입력 오류', '포인트는 1 이상이어야 합니다.');
      return;
    }
    const id = `preset_${Date.now()}`;
    setPointPresets(prev => [...prev, {id, name, points: pts}]);
    setNewPresetName('');
    setNewPresetPoints('');
  };

  const handleRemovePreset = (id: string) => {
    setPointPresets(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = async () => {
    const st = parseInt(sessionTimeout, 10);
    const it = parseInt(idleTimeout, 10);

    if (isNaN(st) || st < 10) {
      Alert.alert('입력 오류', '세션 유지 시간은 10초 이상이어야 합니다.');
      return;
    }
    if (isNaN(it) || it < 5) {
      Alert.alert('입력 오류', '대기화면 전환 시간은 5초 이상이어야 합니다.');
      return;
    }

    // 스탬프 모드 전용 검증 + 쿠폰 타입 결정
    let spc = storeConfig.stampsPerCoupon;
    let newCouponTypes = storeConfig.couponTypes;
    let newCouponSequence = storeConfig.couponSequence;

    if (storeMode === 'stamp') {
      spc = parseInt(stampsPerCoupon, 10);
      if (isNaN(spc) || spc < 1) {
        Alert.alert('입력 오류', '쿠폰당 스탬프 수는 1 이상이어야 합니다.');
        return;
      }

      if (couponMode === 'single') {
        const id = storeConfig.couponTypes[0]?.id ?? 'coupon_a';
        newCouponTypes = [{
          id,
          name: couponNames[id] ?? '무료 쿠폰',
          description: '무료 쿠폰이 한장 생겨요!',
        }];
        newCouponSequence = [id];
      } else {
        const idA = storeConfig.couponTypes[0]?.id ?? 'coupon_a';
        const idB = storeConfig.couponTypes[1]?.id ?? 'coupon_b';
        newCouponTypes = [
          {
            id: idA,
            name: couponNames[idA] ?? '쿠폰 A',
            description: '무료 쿠폰이 한장 생겨요!',
          },
          {
            id: idB,
            name: couponNames[idB] ?? '쿠폰 B',
            description: '무료 쿠폰이 한장 생겨요!',
          },
        ];
        newCouponSequence = [idA, idB];
      }
    }

    const ced = parseInt(couponExpiryDays, 10);
    if (isNaN(ced) || ced < 0) {
      Alert.alert('입력 오류', '쿠폰 유효기간은 0 이상이어야 합니다. (0 = 무기한)');
      return;
    }

    const updatedConfig: StoreConfig = {
      ...storeConfig,
      mode: storeMode,
      stampsPerCoupon: spc,
      couponExpiryDays: ced,
      sessionTimeoutSeconds: st,
      idleTimeoutMs: it * 1000,
      companyName,
      contactEmail,
      guideLines: [guideLine0, guideLine1].filter(l => l.length > 0),
      couponTypes: newCouponTypes,
      couponSequence: newCouponSequence,
      levelIncrementOn: newCouponSequence[0],
      pointPresets,
      pointUnit,
    };

    setIsSaving(true);
    try {
      await updateStoreConfig(updatedConfig);
      Alert.alert('저장 완료', '설정이 반영되었습니다.');
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('저장 실패', '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={c.surface.normal.bg1} translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        {/* 헤더 — Switcher 기준 (투명 · 중앙 타이틀) */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>매장 설정</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>

          {/* ── 운영 모드 선택 ── */}
          <Section title="운영 모드">
            <View style={styles.field}>
              <View style={styles.segmentContainer}>
                <Pressable
                  onPress={() => setStoreMode('stamp')}
                  style={[
                    styles.segmentButton,
                    storeMode === 'stamp' && styles.segmentActive,
                  ]}>
                  <Text style={[
                    styles.segmentText,
                    storeMode === 'stamp' && styles.segmentTextActive,
                  ]}>스탬프 카드</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStoreMode('point')}
                  style={[
                    styles.segmentButton,
                    storeMode === 'point' && styles.segmentActive,
                  ]}>
                  <Text style={[
                    styles.segmentText,
                    storeMode === 'point' && styles.segmentTextActive,
                  ]}>포인트 적립</Text>
                </Pressable>
              </View>
              <Text style={styles.segmentHint}>
                {storeMode === 'stamp'
                  ? '스탬프를 모아 쿠폰으로 교환하는 방식입니다.'
                  : '포인트(적립금)를 직접 적립하고 사용하는 방식입니다.'}
              </Text>
            </View>
          </Section>

          {/* ── 스탬프 모드 전용 섹션 ── */}
          {storeMode === 'stamp' && (
            <>
              <Section title="스탬프 시스템">
                <Field
                  label="쿠폰당 스탬프 수"
                  value={stampsPerCoupon}
                  onChangeText={setStampsPerCoupon}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </Section>

              <Section title="쿠폰 설정">
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>쿠폰 모드</Text>
                  <View style={styles.segmentContainer}>
                    <Pressable
                      onPress={() => setCouponMode('single')}
                      style={[
                        styles.segmentButton,
                        couponMode === 'single' && styles.segmentActive,
                      ]}>
                      <Text style={[
                        styles.segmentText,
                        couponMode === 'single' && styles.segmentTextActive,
                      ]}>싱글 (1종류)</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setCouponMode('double');
                        const idB = storeConfig.couponTypes[1]?.id ?? 'coupon_b';
                        if (!couponNames[idB]) {
                          setCouponNames(prev => ({...prev, [idB]: '쿠폰 B'}));
                        }
                      }}
                      style={[
                        styles.segmentButton,
                        couponMode === 'double' && styles.segmentActive,
                      ]}>
                      <Text style={[
                        styles.segmentText,
                        couponMode === 'double' && styles.segmentTextActive,
                      ]}>더블 (2종류 교차)</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.segmentHint}>
                    {couponMode === 'single'
                      ? '스탬프를 모을 때마다 같은 쿠폰이 발급됩니다.'
                      : '스탬프를 모을 때마다 두 종류의 쿠폰이 번갈아 발급됩니다.'}
                  </Text>
                </View>
                <Field
                  label="쿠폰 1 이름"
                  value={couponNames[storeConfig.couponTypes[0]?.id ?? 'coupon_a'] ?? ''}
                  onChangeText={text => {
                    const id = storeConfig.couponTypes[0]?.id ?? 'coupon_a';
                    setCouponNames(prev => ({...prev, [id]: text}));
                  }}
                  placeholder="무료 쿠폰"
                />
                {couponMode === 'double' && (
                  <Field
                    label="쿠폰 2 이름"
                    value={couponNames[storeConfig.couponTypes[1]?.id ?? 'coupon_b'] ?? ''}
                    onChangeText={text => {
                      const id = storeConfig.couponTypes[1]?.id ?? 'coupon_b';
                      setCouponNames(prev => ({...prev, [id]: text}));
                    }}
                    placeholder="쿠폰 B"
                  />
                )}
                <Field
                  label="쿠폰 유효기간 (일)"
                  value={couponExpiryDays}
                  onChangeText={setCouponExpiryDays}
                  keyboardType="numeric"
                  placeholder="180"
                />
                <Text style={styles.segmentHint}>
                  {parseInt(couponExpiryDays, 10) === 0
                    ? '쿠폰 유효기간이 없습니다. (무기한)'
                    : `쿠폰 발급일로부터 ${couponExpiryDays}일 후 만료됩니다.`}
                </Text>
              </Section>
            </>
          )}

          {/* ── 포인트 모드 전용 섹션 ── */}
          {storeMode === 'point' && (
            <>
              <Section title="포인트 단위">
                <Field
                  label="단위 표시"
                  value={pointUnit}
                  onChangeText={setPointUnit}
                  placeholder="원"
                />
                <Text style={styles.segmentHint}>
                  고객에게 표시되는 포인트 단위입니다. (예: 원, P, 점)
                </Text>
              </Section>

              <Section title="포인트 프리셋">
                <Text style={styles.segmentHint}>
                  자주 사용하는 포인트를 미리 등록하면 한 번의 터치로 적립할 수 있습니다.
                </Text>

                {pointPresets.map(preset => (
                  <View key={preset.id} style={styles.presetRow}>
                    <View style={styles.presetInfo}>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text style={styles.presetPoints}>
                        {preset.points.toLocaleString()}{pointUnit}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRemovePreset(preset.id)}
                      style={styles.presetDeleteButton}>
                      <Text style={styles.presetDeleteText}>삭제</Text>
                    </Pressable>
                  </View>
                ))}

                <View style={styles.presetAddForm}>
                  <View style={styles.presetAddFields}>
                    <TextInput
                      style={[styles.fieldInput, {flex: 1}]}
                      value={newPresetName}
                      onChangeText={setNewPresetName}
                      placeholder="프리셋 이름"
                      placeholderTextColor={c.texticon.onNormal.lowemp}
                    />
                    <TextInput
                      style={[styles.fieldInput, {width: 100, textAlign: 'right'}]}
                      value={newPresetPoints}
                      onChangeText={setNewPresetPoints}
                      placeholder={`0${pointUnit}`}
                      placeholderTextColor={c.texticon.onNormal.lowemp}
                      keyboardType="numeric"
                    />
                  </View>
                  <Pressable onPress={handleAddPreset} style={styles.presetAddButton}>
                    <Text style={styles.presetAddButtonText}>추가</Text>
                  </Pressable>
                </View>
              </Section>
            </>
          )}

          <Section title="세션 / 타이밍">
            <Field
              label="세션 유지 시간 (초)"
              value={sessionTimeout}
              onChangeText={setSessionTimeout}
              keyboardType="numeric"
              placeholder="60"
            />
            <Field
              label="대기화면 전환 시간 (초)"
              value={idleTimeout}
              onChangeText={setIdleTimeout}
              keyboardType="numeric"
              placeholder="30"
            />
          </Section>

          <Section title="안내 메시지">
            <Field label="1줄" value={guideLine0} onChangeText={setGuideLine0} />
            <Field label="2줄" value={guideLine1} onChangeText={setGuideLine1} />
          </Section>

          <Section title="회사 정보">
            <Field
              label="회사명"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="룰루랄라 컴퍼니"
            />
            <Field
              label="연락처 이메일"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              placeholder="example@email.com"
            />
          </Section>

          <View style={{height: 24}} />
        </ScrollView>

        {/* 하단 고정 저장 CTA */}
        <View style={styles.ctaBar}>
          <Pressable
            style={[styles.saveButton, isSaving && {opacity: 0.5}]}
            onPress={handleSave}
            disabled={isSaving}>
            <Text style={styles.saveButtonText}>
              {isSaving ? '저장 중...' : '저장'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.color;
  const pal = theme.palette;
  const f = theme.font;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface.normal.container10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: f.medium,
    color: c.texticon.onNormal.highestemp,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highestemp,
  },
  ctaBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: c.surface.normal.container10,
    borderTopWidth: 1,
    borderTopColor: pal.gray[200],
  },
  saveButton: {
    backgroundColor: c.surface.brand.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: f.semibold,
    color: c.etc.absolute.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    backgroundColor: c.surface.normal.bg1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: f.semibold,
    color: c.texticon.onNormal.highestemp,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: f.medium,
    color: c.texticon.onNormal.midemp,
    letterSpacing: -0.2,
  },
  fieldInput: {
    backgroundColor: c.surface.normal.container10,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highestemp,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: pal.gray[200],
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: c.surface.normal.bg1,
    shadowColor: c.etc.absolute.black,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },
  segmentTextActive: {
    fontFamily: f.semibold,
    color: c.texticon.onNormal.highestemp,
  },
  segmentHint: {
    fontSize: 12,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
    marginTop: 6,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface.normal.container10,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetName: {
    fontSize: 15,
    fontFamily: f.medium,
    color: c.texticon.onNormal.highestemp,
  },
  presetPoints: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: c.surface.brand.primary,
  },
  presetDeleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  presetDeleteText: {
    fontSize: 13,
    fontFamily: f.medium,
    color: c.texticon.onNormal.warning,
  },
  presetAddForm: {
    gap: 10,
  },
  presetAddFields: {
    flexDirection: 'row',
    gap: 8,
  },
  presetAddButton: {
    backgroundColor: c.surface.brand.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  presetAddButtonText: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: c.etc.absolute.white,
  },
  });
};

export default StoreSettingsScreen;
