import React, {useEffect, useState} from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAuth, useFirestore, useStoreConfig} from '../../hooks';
import {LeftArrowIcon} from '../../components/Icons';

const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
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

const StoreSettingsScreen = ({navigation}: any) => {
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {updateStoreConfig} = useFirestore(storeCode);

  const [stampsPerCoupon, setStampsPerCoupon] = useState(
    String(storeConfig.stampsPerCoupon),
  );
  const [sessionTimeout, setSessionTimeout] = useState(
    String(storeConfig.sessionTimeoutSeconds),
  );
  const [idleTimeout, setIdleTimeout] = useState(
    String(storeConfig.idleTimeoutMs / 1000),
  );
  const [companyName, setCompanyName] = useState(storeConfig.companyName);
  const [contactEmail, setContactEmail] = useState(storeConfig.contactEmail);
  const [welcomeLine0, setWelcomeLine0] = useState(storeConfig.welcomeLines[0] ?? '');
  const [welcomeLine1, setWelcomeLine1] = useState(storeConfig.welcomeLines[1] ?? '');
  const [welcomeLine2, setWelcomeLine2] = useState(storeConfig.welcomeLines[2] ?? '');
  const [guideLine0, setGuideLine0] = useState(storeConfig.guideLines[0] ?? '');
  const [guideLine1, setGuideLine1] = useState(storeConfig.guideLines[1] ?? '');
  const [couponName0, setCouponName0] = useState(storeConfig.couponTypes[0]?.name ?? '');
  const [couponName1, setCouponName1] = useState(storeConfig.couponTypes[1]?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStampsPerCoupon(String(storeConfig.stampsPerCoupon));
    setSessionTimeout(String(storeConfig.sessionTimeoutSeconds));
    setIdleTimeout(String(storeConfig.idleTimeoutMs / 1000));
    setCompanyName(storeConfig.companyName);
    setContactEmail(storeConfig.contactEmail);
    setWelcomeLine0(storeConfig.welcomeLines[0] ?? '');
    setWelcomeLine1(storeConfig.welcomeLines[1] ?? '');
    setWelcomeLine2(storeConfig.welcomeLines[2] ?? '');
    setGuideLine0(storeConfig.guideLines[0] ?? '');
    setGuideLine1(storeConfig.guideLines[1] ?? '');
    setCouponName0(storeConfig.couponTypes[0]?.name ?? '');
    setCouponName1(storeConfig.couponTypes[1]?.name ?? '');
  }, [storeConfig]);

  const handleSave = async () => {
    const spc = parseInt(stampsPerCoupon, 10);
    const st = parseInt(sessionTimeout, 10);
    const it = parseInt(idleTimeout, 10);

    if (isNaN(spc) || spc < 1) {
      Alert.alert('입력 오류', '쿠폰당 스탬프 수는 1 이상이어야 합니다.');
      return;
    }
    if (isNaN(st) || st < 10) {
      Alert.alert('입력 오류', '세션 유지 시간은 10초 이상이어야 합니다.');
      return;
    }
    if (isNaN(it) || it < 5) {
      Alert.alert('입력 오류', '대기화면 전환 시간은 5초 이상이어야 합니다.');
      return;
    }

    const updatedConfig: StoreConfig = {
      ...storeConfig,
      stampsPerCoupon: spc,
      sessionTimeoutSeconds: st,
      idleTimeoutMs: it * 1000,
      companyName,
      contactEmail,
      welcomeLines: [welcomeLine0, welcomeLine1, welcomeLine2].filter(l => l.length > 0),
      guideLines: [guideLine0, guideLine1].filter(l => l.length > 0),
      couponTypes: storeConfig.couponTypes.map((c, i) => ({
        ...c,
        name: i === 0 ? couponName0 : couponName1,
      })),
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <LeftArrowIcon width={20} height={20} />
            <Text style={styles.backText}>뒤로</Text>
          </Pressable>
          <Text style={styles.headerTitle}>카페 설정</Text>
          <Pressable
            style={[styles.saveButton, isSaving && {opacity: 0.5}]}
            onPress={handleSave}
            disabled={isSaving}>
            <Text style={styles.saveButtonText}>
              {isSaving ? '저장 중...' : '저장'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
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
            <Field
              label={`쿠폰 1 이름 (${storeConfig.couponTypes[0]?.id ?? 'americano'})`}
              value={couponName0}
              onChangeText={setCouponName0}
              placeholder="아메리카노"
            />
            <Field
              label={`쿠폰 2 이름 (${storeConfig.couponTypes[1]?.id ?? 'beverage'})`}
              value={couponName1}
              onChangeText={setCouponName1}
              placeholder="조제음료"
            />
          </Section>

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

          <Section title="환영 메시지">
            <Field label="1줄" value={welcomeLine0} onChangeText={setWelcomeLine0} />
            <Field label="2줄" value={welcomeLine1} onChangeText={setWelcomeLine1} />
            <Field label="3줄" value={welcomeLine2} onChangeText={setWelcomeLine2} />
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

          <View style={{height: 60}} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  backText: {
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    color: '#3D4C57',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#191D2B',
  },
  saveButton: {
    backgroundColor: '#D4845A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    width: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    color: '#191D2B',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#73777B',
    letterSpacing: -0.2,
  },
  fieldInput: {
    backgroundColor: '#F6F6F8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Pretendard-Regular',
    color: '#191D2B',
  },
});

export default StoreSettingsScreen;
