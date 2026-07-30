import React, {useState} from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import {useAuth, useDeviceType} from '../../hooks';
import PinPad from '../../components/PinPad';
import {semanticColors as c, primitives as p, fontFamily as f} from '../../theme';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';
import {
  CheckIcon,
  CircleXIcon,
  ExitIcon,
  LeftBigArrowIcon,
  XIcon,
} from '../../components/Icons';
import {LoadingOverlay} from '../../components/overlay';
import DashboardView from './DashboardView';
import {useNumberInput} from './useNumberInput';

const POINTO_LOGO = require('../../../src/assets/images/pointo_1024.png');
const APPSTORE_QR = require('../../../src/assets/images/pointo_appstore_qr.png');

const SUMMER_COLORS = {
  backgroundStart: p.blue[50],
  backgroundEnd: p.blue[100],
  accent: c.surface.brand.primary,
  primary: c.texticon.onNormal.highestemp,
};

const NUMBER_SEQUENCE = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

// ─── Keypad (공통) ───────────────────────────────────────────
const Keypad = ({
  onPress,
  size,
}: {
  onPress: (v: number | string) => void;
  size: 'compact' | 'large';
}) => {
  const btnHeight = size === 'compact' ? 58 : 77;
  const fontSize = size === 'compact' ? 32 : 42;
  return (
    <View style={{width: '100%', gap: size === 'compact' ? 8 : 12}}>
      {NUMBER_SEQUENCE.map((row, ri) => (
        <View key={ri} style={s.keyRow}>
          {row.map(n => (
            <Pressable
              key={n}
              style={({pressed}) => [
                s.keyBtn,
                {
                  height: btnHeight,
                  backgroundColor: pressed
                    ? p.blue[100]
                    : 'rgba(255,255,255,0.96)',
                },
              ]}
              onPress={() => onPress(n)}>
              <Text style={[s.keyText, {fontSize}]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={s.keyRow}>
        <View style={[s.keyBtn, {height: btnHeight}]} />
        <Pressable
          style={({pressed}) => [
            s.keyBtn,
            {
              height: btnHeight,
              backgroundColor: pressed ? p.blue[100] : 'rgba(255,255,255,0.96)',
            },
          ]}
          onPress={() => onPress(0)}>
          <Text style={[s.keyText, {fontSize}]}>0</Text>
        </Pressable>
        <Pressable
          style={({pressed}) => [
            s.keyBtn,
            {
              height: btnHeight,
              backgroundColor: pressed ? p.blue[100] : 'rgba(255,255,255,0.96)',
            },
          ]}
          onPress={() => onPress('c')}>
          <LeftBigArrowIcon />
        </Pressable>
      </View>
    </View>
  );
};

// ─── Phone Layout ────────────────────────────────────────────
const PhoneLayout = ({ctx}: {ctx: ReturnType<typeof useNumberInput>}) => (
  <View style={s.phoneContainer}>
    <View style={s.phoneInner}>
      {ctx.storeName ? (
        <Text style={s.phoneStoreName}>{ctx.storeName}</Text>
      ) : null}
      <View style={s.phoneNumberRow}>
        <View style={s.phoneNumberDisplay}>
          <Text style={s.phoneNumberText}>010</Text>
          <Text style={s.phoneNumberText}>{ctx.phoneNumberLabel()}</Text>
        </View>
        {ctx.number.length > 0 && (
          <Pressable onPress={ctx.clearNumber}>
            <CircleXIcon width={22} height={22} color={c.texticon.onNormal.midemp} />
          </Pressable>
        )}
      </View>
      <View style={s.divider} />
      <Keypad onPress={ctx.onNumberPress} size="compact" />
      <View style={s.phoneConfirmWrap}>
        <Pressable style={s.confirmBtn} onPress={ctx.onConfirmPress}>
          <LinearGradient
            colors={[p.blue[200], c.surface.brand.primary]}
            locations={[0.2, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={s.confirmGradient}>
            <Text style={s.confirmText}>조회하기</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
    <View style={s.phoneFooter}>
      <Pressable onPress={() => ctx.setPrivacyVisible(true)}>
        <Text style={s.footerLink}>개인정보 처리방침</Text>
      </Pressable>
      <Pressable onPress={ctx.onDeleteAccountPress}>
        <Text style={s.footerLink}>회원 탈퇴</Text>
      </Pressable>
      <Pressable
        style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
        onPress={ctx.logout}>
        <ExitIcon width={14} height={14} color={c.texticon.onNormal.midemp} />
        <Text style={s.footerLink}>나가기</Text>
      </Pressable>
    </View>
  </View>
);

// ─── Tablet Layout ───────────────────────────────────────────
const TabletLayout = ({ctx}: {ctx: ReturnType<typeof useNumberInput>}) => (
  <View style={s.tabletContainer}>
    <View style={s.tabletLeft}>
      <View style={s.tabletWelcome}>
        {ctx.storeConfig.welcomeLines.map((line, i) => (
          <Text key={i} style={s.tabletWelcomeText}>
            {line}
          </Text>
        ))}
        <View style={{marginTop: 10}}>
          {ctx.storeConfig.guideLines.map((line, i) => (
            <Text key={i} style={s.tabletGuideText}>
              {line}
            </Text>
          ))}
        </View>
        <LottieView
          source={require('../../../lottie/coffee.json')}
          autoPlay
          loop
          style={{width: 200, height: 200, alignSelf: 'center'}}
        />
      </View>
      <View style={s.tabletFooter}>
        <Text style={s.tabletCopyright}>
          © 2025 {ctx.storeConfig.companyName}. All rights reserved.
        </Text>
        <View style={s.tabletFooterLinks}>
          <Pressable onPress={() => ctx.setPrivacyVisible(true)}>
            <Text style={s.footerLink}>개인정보 처리방침</Text>
          </Pressable>
          <Pressable onPress={ctx.onDeleteAccountPress}>
            <Text style={s.footerLink}>회원 탈퇴</Text>
          </Pressable>
          <Pressable
            style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
            onPress={ctx.logout}>
            <ExitIcon width={14} height={14} color={c.texticon.onNormal.midemp} />
            <Text style={s.footerLink}>로그아웃</Text>
          </Pressable>
        </View>
      </View>
    </View>
    <View style={s.tabletRight}>
      <View style={s.tabletCard}>
        <View style={s.tabletCardInner}>
          {ctx.storeName ? (
            <Text style={s.tabletStoreName}>{ctx.storeName}</Text>
          ) : null}
          <View style={s.tabletNumberRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={s.tabletNumberText}>010</Text>
              <Text style={s.tabletNumberText}>{ctx.phoneNumberLabel()}</Text>
            </View>
            {ctx.number.length > 0 && (
              <Pressable onPress={ctx.clearNumber}>
                <CircleXIcon width={24} height={24} color={c.texticon.onNormal.midemp} />
              </Pressable>
            )}
          </View>
          <View style={s.divider} />
          <Keypad onPress={ctx.onNumberPress} size="large" />
        </View>
        <View style={s.tabletConfirmWrap}>
          <Pressable
            style={({pressed}) => [
              s.confirmBtn,
              {width: pressed ? 409 : 421, maxWidth: 421},
            ]}
            onPress={ctx.onConfirmPress}>
            <LinearGradient
              colors={[p.blue[300], c.surface.brand.primary]}
              locations={[0.2, 1]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={s.confirmGradient}>
              <Text style={s.confirmText}>조회하기</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  </View>
);

// ─── Signup Modal (공통) ─────────────────────────────────────
const SignupModal = ({ctx}: {ctx: ReturnType<typeof useNumberInput>}) => (
  <Modal
    animationType="slide"
    transparent
    visible={ctx.modalVisible}
    presentationStyle="overFullScreen"
    supportedOrientations={['portrait', 'landscape']}>
    <View style={s.modalBackdrop}>
      <View style={s.modalCard}>
        <View style={s.modalHeader}>
          <Text style={s.modalWelcome}>
            <Text style={s.modalWelcomeAccent}>
              010{ctx.phoneNumberLabel()}
            </Text>{' '}
            님 반갑습니다!
          </Text>
          <Pressable style={{padding: 7}} onPress={ctx.closeSignupModal}>
            <XIcon />
          </Pressable>
        </View>
        <Text style={s.modalTitle}>
          포인토(Pointo) 가입을 위해 이용약관 동의가 필요해요
        </Text>
        <Text style={s.modalSubtitle}>
          아래 이용약관 확인 후 가입을 완료해 주세요.
        </Text>
        <ScrollView style={s.termsScroll}>
          <View style={{padding: 12}}>
            <Text>개인정보의 수집. 및 이용 동의서</Text>
            <Text style={s.termsLight}>
              - 이용자가 제공한 모든 정보는 다음의 목적을 위해 활용하며, 하기
              목적 이외의 용도로는 사용되지 않습니다.
            </Text>
            <Text style={s.termsSub}>
              ① 개인정보 수집 항목 및 수집·이용 목적
            </Text>
            <Text style={s.termsSmall}>가) 수집 항목 (필수항목)</Text>
            <Text style={s.termsSmall}> - 전화번호(휴대전화)</Text>
            <Text style={s.termsSmall}>나) 수집 및 이용 목적</Text>
            <Text style={s.termsSmall}> - 서비스 제공 및 운영</Text>
            <Text style={s.termsSmall}> - 사용자 본인 확인</Text>
            <Text style={s.termsSub}>② 개인정보 보유 및 이용 기간</Text>
            <Text style={s.termsSmall}>
              - 수집·이용 동의일로부터 개인정보의 수집·이용 목적을 달성할 때까지
            </Text>
            <Text style={s.termsSub}>③ 동의거부관리</Text>
            <Text style={s.termsSmall}>
              - 귀하께서는 본 안내에 따른 개인정보 수집, 이용에 대하여 동의를
              거부하실 권리가 있습니다. 다만, 귀하가 개인정보의 수집·이용에
              동의를 거부하시는 경우에 서비스 이용 과정에 있어 불이익이 발생할
              수 있음을 알려드립니다.
            </Text>
          </View>
        </ScrollView>
        <View style={s.modalBottom}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 16,
            }}
            onPress={() => ctx.setAgree(!ctx.agree)}>
            <CheckIcon color={ctx.agree ? SUMMER_COLORS.accent : p.gray[200]} />
            <Text style={s.agreeText}>
              이용약관을 모두 읽었으며 해당 내용에 모두 동의합니다.
            </Text>
          </Pressable>
          <Pressable onPress={() => ctx.setPrivacyVisible(true)}>
            <Text style={s.privacyLink}>개인정보 처리방침 보기</Text>
          </Pressable>
          <Pressable
            style={[
              s.confirmBtn,
              {backgroundColor: ctx.agree ? SUMMER_COLORS.accent : p.gray[200]},
            ]}
            onPress={ctx.onAgreePress}
            disabled={!ctx.agree}>
            <LinearGradient
              colors={
                ctx.agree ? [c.surface.brand.primary, p.blue[600]] : [p.gray[200], p.gray[200]]
              }
              locations={[0.2, 1]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={s.confirmGradient}>
              <Text style={s.confirmText}>가입완료</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Idle Overlay (공통) ─────────────────────────────────────
const IdleOverlay = ({ctx}: {ctx: ReturnType<typeof useNumberInput>}) => {
  if (!ctx.idleVisible) return null;
  return (
    <Pressable style={s.idleOverlay} onPress={ctx.dismissIdle}>
      <LinearGradient
        colors={[p.blue[50], p.blue[100]]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={s.idleGradient}>
        <Image
          source={POINTO_LOGO}
          style={{width: 80, height: 80, borderRadius: 20}}
        />
        <View style={{alignItems: 'center', gap: 6}}>
          <Text style={s.idleTitle}>{ctx.storeName ?? '우리 매장'}도</Text>
          <Text style={s.idleTitle}>포인토 쓰고 있어요</Text>
        </View>
        <Text style={s.idleSubtitle}>
          종이 쿠폰 없이, 번호만으로 적립 끝.{'\n'}앱 하나면 어디서든 스탬프
          관리.
        </Text>
        <Image
          source={APPSTORE_QR}
          style={{width: 140, height: 140, borderRadius: 12, marginTop: 8}}
        />
        <Text style={s.idleQrHint}>QR을 스캔하면 앱스토어로 이동해요</Text>
        <Animated.Text style={[s.idleTapHint, {opacity: ctx.hintOpacity}]}>
          화면을 터치하면 돌아갑니다
        </Animated.Text>
      </LinearGradient>
    </Pressable>
  );
};

// ─── Main Screen ─────────────────────────────────────────────
const NumberInputScreen = () => {
  const device = useDeviceType();
  const baseCtx = useNumberInput();
  const {deviceLock, unlockDevice, setIsAuthenticated} = useAuth();
  const [pinVisible, setPinVisible] = useState(false);

  // 마찰완화 #3: 기기가 고객 전용으로 잠겨 있으면 로그아웃(관리자 복귀) 시 PIN 요구
  const handleLogoutRequest = () => {
    if (deviceLock.lockedStoreCode && deviceLock.pin) {
      setPinVisible(true);
    } else {
      baseCtx.logout();
    }
  };

  const handlePinSuccess = async () => {
    setPinVisible(false);
    await unlockDevice();
    setIsAuthenticated(false);
  };

  // 레이아웃은 ctx.logout을 호출하므로, 잠금 인지형 핸들러로 교체해서 전달
  const ctx = {...baseCtx, logout: handleLogoutRequest};

  return (
    <LinearGradient
      colors={[SUMMER_COLORS.backgroundStart, SUMMER_COLORS.backgroundEnd]}
      style={{flex: 1}}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={SUMMER_COLORS.backgroundStart}
        translucent={false}
      />
      <SafeAreaView style={{flex: 1}}>
        <LoadingOverlay isLoading={ctx.isLoading} />
        {device === 'tablet' ? (
          <TabletLayout ctx={ctx} />
        ) : (
          <PhoneLayout ctx={ctx} />
        )}
      </SafeAreaView>
      <PinPad
        visible={pinVisible}
        mode="verify"
        title="관리자 PIN을 입력해주세요"
        subtitle="고객 모드를 해제하고 매장 관리로 돌아갑니다."
        expectedPin={deviceLock.pin}
        onSuccess={handlePinSuccess}
        onCancel={() => setPinVisible(false)}
      />
      <SignupModal ctx={ctx} />
      <Modal
        animationType="slide"
        transparent
        visible={ctx.viewModalContext.visible}
        presentationStyle="overFullScreen"
        supportedOrientations={['portrait', 'landscape']}>
        <DashboardView
          phoneNumber={ctx.viewModalContext.phoneNumber}
          onClose={ctx.closeViewModal}
        />
      </Modal>
      <IdleOverlay ctx={ctx} />
      <PrivacyPolicyModal
        visible={ctx.privacyVisible}
        onClose={() => ctx.setPrivacyVisible(false)}
        companyName={ctx.storeConfig.companyName}
        contactEmail={ctx.storeConfig.contactEmail}
      />
    </LinearGradient>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  // Keypad
  keyRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  keyBtn: {
    flex: 1,
    maxWidth: 151,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  keyText: {color: c.texticon.onNormal.highestemp, fontFamily: 'SFUIDisplay-Regular'},

  // Phone
  phoneContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    justifyContent: 'center',
  },
  phoneInner: {width: '100%', alignItems: 'center'},
  phoneStoreName: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: c.surface.brand.primary,
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 9,
  },
  phoneNumberRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 9,
    marginBottom: 20,
  },
  phoneNumberDisplay: {flexDirection: 'row', alignItems: 'center'},
  phoneNumberText: {
    fontSize: 36,
    color: c.texticon.onNormal.highestemp,
    fontFamily: 'SFUIDisplay-Medium',
    lineHeight: 40,
    letterSpacing: -1,
  },
  phoneConfirmWrap: {width: '100%', alignItems: 'center', marginTop: 24},
  phoneFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },

  // Tablet
  tabletContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    paddingHorizontal: 20,
  },
  tabletLeft: {
    width: 340,
    justifyContent: 'space-between',
    paddingTop: 134,
    paddingBottom: 134,
  },
  tabletWelcome: {gap: 10},
  tabletWelcomeText: {
    fontSize: 36,
    fontFamily: f.medium,
    lineHeight: 48,
    letterSpacing: -1,
    color: c.texticon.onNormal.highestemp,
  },
  tabletGuideText: {
    fontSize: 24,
    fontFamily: f.light,
    lineHeight: 32,
    letterSpacing: -1,
    color: c.texticon.onNormal.highemp,
  },
  tabletFooter: {gap: 6},
  tabletCopyright: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: f.light,
    color: p.blue[700],
    textAlign: 'center',
  },
  tabletFooterLinks: {flexDirection: 'row', alignSelf: 'center', gap: 16},
  tabletRight: {justifyContent: 'flex-end', height: '100%'},
  tabletCard: {
    width: 533,
    height: 734,
    backgroundColor: c.surface.normal.bg1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 15,
    shadowColor: c.etc.absolute.black,
    shadowOffset: {width: 0, height: 4.5},
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletCardInner: {width: '100%', paddingHorizontal: 24},
  tabletStoreName: {
    fontSize: 15,
    fontFamily: f.semibold,
    color: c.surface.brand.primary,
    marginBottom: 20,
    paddingHorizontal: 9,
  },
  tabletNumberRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 9,
  },
  tabletNumberText: {
    fontSize: 44,
    color: c.texticon.onNormal.highestemp,
    fontFamily: 'SFUIDisplay-Medium',
    lineHeight: 48,
    letterSpacing: -1,
  },
  tabletConfirmWrap: {width: '100%', alignItems: 'center', marginTop: 55.5},

  // Confirm button (shared)
  confirmBtn: {
    width: '100%',
    maxWidth: 344,
    height: 64,
    borderRadius: 24,
    shadowColor: p.blue[700],
    shadowOffset: {width: 0, height: 4.5},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  confirmText: {fontSize: 16, color: c.etc.absolute.white, fontFamily: f.regular},

  // Divider
  divider: {
    width: '100%',
    height: 0.5,
    backgroundColor: p.blue[100],
    marginBottom: 12,
  },

  // Footer link
  footerLink: {
    fontSize: 13,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    height: 450,
    width: '90%',
    maxWidth: 634,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: SUMMER_COLORS.accent,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: c.etc.absolute.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalWelcome: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: f.medium,
    color: c.texticon.onNormal.highestemp,
  },
  modalWelcomeAccent: {color: c.surface.brand.primary, fontFamily: 'SFUIDisplay-Semibold'},
  modalTitle: {
    width: '100%',
    fontSize: 28,
    lineHeight: 38,
    fontFamily: f.medium,
    color: c.texticon.onNormal.highestemp,
  },
  modalSubtitle: {
    width: '100%',
    fontSize: 14,
    lineHeight: 24,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highemp,
  },
  termsScroll: {
    width: '100%',
    borderColor: p.gray[200],
    borderWidth: 0.5,
    borderRadius: 10,
    marginBottom: 25,
    marginTop: 15,
  },
  termsLight: {
    fontSize: 10,
    fontFamily: f.light,
    marginTop: 10,
    paddingLeft: 10,
  },
  termsSub: {
    fontSize: 11,
    fontFamily: f.regular,
    marginTop: 10,
    paddingLeft: 10,
  },
  termsSmall: {
    fontSize: 10,
    fontFamily: f.light,
    marginTop: 5,
    paddingLeft: 20,
  },
  modalBottom: {width: '100%', alignItems: 'center', gap: 12},
  agreeText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: f.regular,
    color: c.texticon.onNormal.highestemp,
  },
  privacyLink: {
    fontSize: 13,
    fontFamily: f.regular,
    color: c.surface.brand.primary,
    textDecorationLine: 'underline',
    marginTop: 4,
    marginBottom: 8,
  },

  // Idle overlay
  idleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  idleTitle: {
    fontSize: 36,
    fontFamily: f.semibold,
    color: c.texticon.onNormal.highestemp,
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 50,
  },
  idleSubtitle: {
    fontSize: 20,
    fontFamily: f.light,
    color: c.texticon.onNormal.highemp,
    textAlign: 'center',
    lineHeight: 32,
  },
  idleQrHint: {
    fontSize: 13,
    fontFamily: f.regular,
    color: c.texticon.onNormal.midemp,
    marginTop: 4,
  },
  idleTapHint: {
    fontSize: 18,
    fontFamily: f.light,
    color: c.texticon.onNormal.highestemp,
    marginTop: 8,
  },
});

export default NumberInputScreen;
