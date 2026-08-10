import React, {useState} from 'react';
import {
  Animated,
  ImageBackground,
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
import {useAuth, useLayoutMode} from '../../hooks';
import PinPad from '../../components/PinPad';
import {
  semanticColors as c,
  primitives as p,
  fontFamily as f,
} from '../../theme';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';
import {
  CheckIcon,
  ExitIcon,
  LeftBigArrowIcon,
  XIcon,
} from '../../components/Icons';
import {LoadingOverlay} from '../../components/overlay';
import DashboardView from './DashboardView';
import {useNumberInput} from './useNumberInput';

const IDLE_BACKGROUNDS = [
  require('../../../src/assets/images/bg_pointo_1.png'),
  require('../../../src/assets/images/bg_pointo_2.png'),
];

const SUMMER_COLORS = {
  accent: c.surface.brand.primary,
  primary: c.texticon.onNormal.highestemp,
};

const NUMBER_SEQUENCE = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

// 전화번호 표시: '010 - 1234 - 5678' 처럼 하이픈 앞뒤로 여백을 둔다.
const formatDisplay = (label: string) =>
  ('010' + (label || '-')).replace(/-/g, ' - ').trimEnd();

// ─── Keypad ──────────────────────────────────────────────────
const Keypad = ({
  onPress,
  expanded,
}: {
  onPress: (v: number | string) => void;
  expanded: boolean;
}) => {
  const btnHeight = 58;
  const fontSize = expanded ? 28 : 24;
  const keyStyle = ({pressed}: {pressed: boolean}) => [
    s.keyBtn,
    {height: btnHeight, backgroundColor: pressed ? p.slate[100] : 'transparent'},
  ];
  return (
    <View style={{width: '100%', gap: 20}}>
      {NUMBER_SEQUENCE.map((row, ri) => (
        <View key={ri} style={s.keyRow}>
          {row.map(n => (
            <Pressable key={n} style={keyStyle} onPress={() => onPress(n)}>
              <Text style={[s.keyText, {fontSize}]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={s.keyRow}>
        <View style={[s.keyBtn, {height: btnHeight}]} />
        <Pressable style={keyStyle} onPress={() => onPress(0)}>
          <Text style={[s.keyText, {fontSize}]}>0</Text>
        </Pressable>
        <Pressable style={keyStyle} onPress={() => onPress('c')}>
          <LeftBigArrowIcon
            width={36}
            height={36}
            strokeWidth={4}
            color="#1B1B1B"
          />
        </Pressable>
      </View>
    </View>
  );
};

// ─── Input Layout (폰·태블릿 통일) ──────────────────────────────
const InputLayout = ({ctx}: {ctx: ReturnType<typeof useNumberInput>}) => {
  const {isExpanded} = useLayoutMode();
  const complete = ctx.number.length === 8;
  const numFontSize = isExpanded ? 32 : 24;
  return (
    <View style={[s.content, isExpanded && s.contentExpanded]}>
      <View
        style={{
          flex: 1,
          width: '100%',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 50,
        }}>
        <View style={s.topBlock}>
          {ctx.storeName ? (
            <Text style={s.storeName}>{ctx.storeName}</Text>
          ) : null}
          <View style={s.titleWrap}>
            {ctx.storeConfig.guideLines.map((line, i) => (
              <Text
                key={i}
                style={[
                  s.title,
                  {
                    fontSize: isExpanded ? 24 : 20,
                    lineHeight: isExpanded ? 32 : 28,
                  },
                ]}>
                {line}
              </Text>
            ))}
          </View>

          <View style={s.inputBox}>
            <Text style={s.inputLabel}>번호를 입력해주세요</Text>
            {/* 고스트로 전체 마스크 폭을 고정하고, 실제 값은 그 위에 왼쪽
              정렬로 얹는다. 각 자리는 픽셀 고정 · 블록 전체는 가운데.
              tabular-nums로 모든 숫자 폭을 동일하게 맞춰 흔들림을 없앤다. */}
            <View style={s.numberWrap}>
              <Text
                style={[s.inputNumber, s.numberGhost, {fontSize: numFontSize}]}>
                010 - 0000 - 0000
              </Text>
              <Text
                numberOfLines={1}
                style={[s.inputNumber, s.numberReal, {fontSize: numFontSize}]}>
                {formatDisplay(ctx.phoneNumberLabel())}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.keypadZone}>
          <View style={s.keypadInner}>
            <Keypad onPress={ctx.onNumberPress} expanded={isExpanded} />
          </View>
        </View>
      </View>

      <View style={s.bottomBlock}>
        <Pressable
          style={[s.confirmBtn, complete ? s.confirmOn : s.confirmOff]}
          onPress={ctx.onConfirmPress}
          disabled={!complete}>
          <Text style={[s.confirmText, !complete && s.confirmTextOff]}>
            확인
          </Text>
        </Pressable>
        <View style={s.footer}>
          <Pressable onPress={() => ctx.setPrivacyVisible(true)}>
            <Text style={s.footerLink}>개인정보 처리방침</Text>
          </Pressable>
          <Pressable onPress={ctx.onDeleteAccountPress}>
            <Text style={s.footerLink}>회원 탈퇴</Text>
          </Pressable>
          <Pressable
            style={{flexDirection: 'row', alignItems: 'center', gap: 4}}
            onPress={ctx.logout}>
            <ExitIcon
              width={14}
              height={14}
              color={c.texticon.onNormal.midemp}
            />
            <Text style={s.footerLink}>나가기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

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
                ctx.agree
                  ? [c.surface.brand.primary, p.blue[600]]
                  : [p.gray[200], p.gray[200]]
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
      <ImageBackground
        source={IDLE_BACKGROUNDS[ctx.idleBgIndex]}
        style={s.idleBg}
        resizeMode="cover">
        {/* 어떤 이미지가 와도 슬로건이 읽히도록 은은한 다크 스크림 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.60)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.idleSloganWrap}>
          <Text style={s.idleSlogan}>함께 모으는 즐거움</Text>
          <Text style={s.idleWordmark}>Pointo</Text>
        </View>
        <Animated.Text style={[s.idleTapHint, {opacity: ctx.hintOpacity}]}>
          화면을 터치하면 돌아갑니다
        </Animated.Text>
      </ImageBackground>
    </Pressable>
  );
};

// ─── Main Screen ─────────────────────────────────────────────
const NumberInputScreen = () => {
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
    <View style={s.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={c.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={{flex: 1}}>
        <LoadingOverlay isLoading={ctx.isLoading} />
        <InputLayout ctx={ctx} />
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
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  // Root
  root: {flex: 1, backgroundColor: c.surface.normal.bg1},
  content: {flex: 1, width: '100%', paddingHorizontal: 24, alignSelf: 'center'},
  contentExpanded: {maxWidth: 480},

  // Top block (store name + title + input)
  topBlock: {alignItems: 'center', paddingTop: 32},
  storeName: {
    fontSize: 15,
    fontFamily: f.medium,
    color: c.texticon.onNormal.lowemp,
    textAlign: 'center',
  },
  titleWrap: {marginTop: 12, alignItems: 'center'},
  title: {
    fontFamily: f.semibold,
    color: c.texticon.onNormal.highestemp,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 38,
  },

  // Input box
  inputBox: {
    width: '100%',
    marginTop: 28,
    borderWidth: 1.5,
    borderColor: c.surface.brand.primary,
    borderRadius: 10,
    backgroundColor: c.surface.normal.bg1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: c.surface.brand.primary,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 2,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: f.regular,
    color: c.texticon.onNormal.lowemp,
    marginBottom: 6,
  },
  inputNumber: {
    fontFamily: 'SFUIDisplay-Medium',
    color: c.texticon.onNormal.highestemp,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  numberWrap: {alignSelf: 'center'},
  numberGhost: {opacity: 0},
  numberReal: {position: 'absolute', left: 0, top: 0},

  // Keypad
  keypadZone: {justifyContent: 'center', alignItems: 'center'},
  keypadInner: {width: '100%', maxWidth: 360},
  keyRow: {flexDirection: 'row', gap: 8},
  keyBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  keyText: {
    color: c.texticon.onNormal.highestemp,
    fontFamily: 'SFUIDisplay-Medium',
  },

  // Bottom block (CTA + footer)
  bottomBlock: {paddingBottom: 12},
  confirmBtn: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmOn: {backgroundColor: c.surface.brand.primary},
  confirmOff: {backgroundColor: p.slate[200]},
  confirmGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  confirmText: {
    fontSize: 16,
    color: c.etc.absolute.white,
    fontFamily: f.semibold,
  },
  confirmTextOff: {color: c.texticon.onEnv.onDisabled},

  // Footer link
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 18,
  },
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
  modalWelcomeAccent: {
    color: c.surface.brand.primary,
    fontFamily: 'SFUIDisplay-Semibold',
  },
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
  idleBg: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleSloganWrap: {
    alignItems: 'center',
    gap: 8,
  },
  idleSlogan: {
    fontSize: 32,
    fontFamily: f.semibold,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 12,
  },
  idleWordmark: {
    fontSize: 32,
    fontFamily: f.extrabold,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 12,
  },
  idleTapHint: {
    position: 'absolute',
    bottom: 48,
    fontSize: 16,
    fontFamily: f.light,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 8,
  },
});

export default NumberInputScreen;
