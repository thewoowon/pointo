import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Animated} from 'react-native';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
import {
  AnalyticsEvent,
  hashPhone,
  getTierFromLevel,
  getReturnBucket,
} from '../../analytics/events';
import dayjs from 'dayjs';
import {useFocusEffect} from '@react-navigation/native';
import {pointsOf} from '../../utils/coupons';

export function useNumberInput() {
  const {storeCode, storeName, setIsAuthenticated} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {addUser, getUser, updateSession, deleteUserAccount} =
    useFirestore(storeCode);
  const {track, identify} = useAnalytics();

  const [number, setNumber] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalContext, setViewModalContext] = useState({
    visible: false,
    phoneNumber: '',
  });
  const [agree, setAgree] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [idleVisible, setIdleVisible] = useState(false);
  const [idleBgIndex, setIdleBgIndex] = useState(0);

  const hintOpacity = useRef(new Animated.Value(1)).current;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIdleVisible(true);
    }, storeConfig.idleTimeoutMs);
  }, [storeConfig.idleTimeoutMs]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!idleVisible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, {
          toValue: 0.2,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [idleVisible, hintOpacity]);

  const dismissIdle = useCallback(() => {
    setIdleVisible(false);
    // 다음 유휴 진입 때 배경을 번갈아 보여줘 화면이 정적이지 않게
    setIdleBgIndex(i => (i + 1) % 2);
    resetIdleTimer();
  }, [resetIdleTimer]);

  const phoneNumberLabel = () => {
    if (number.length === 0) return '';
    if (number.length < 5) return `-${number}`;
    return `-${number.slice(0, 4)}-${number.slice(4)}`;
  };

  const onNumberPress = (value: number | string) => {
    resetIdleTimer();
    if (value === 'c') {
      setNumber(number.slice(0, -1));
      return;
    }
    if (number.length >= 8) {
      Alert.alert('전화번호는 11자리까지 입력할 수 있습니다.');
      return;
    }
    setNumber(number + value);
  };

  const clearNumber = () => setNumber('');

  const onConfirmPress = async () => {
    if (number.length < 8) {
      Alert.alert('전화번호를 모두 입력해주세요.');
      return;
    }
    const phoneNumber = `010${number}`;
    setIsLoading(true);
    const response = await getUser(phoneNumber);
    setIsLoading(false);

    if (!response) {
      try {
        track(AnalyticsEvent.SIGNUP_STARTED, {store_code: storeCode});
      } catch {}
      setModalVisible(true);
      return;
    }

    try {
      const user = response as User;
      identify(phoneNumber);
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      const daysSinceLastVisit = user.last_used
        ? dayjs().diff(dayjs(user.last_used), 'day')
        : 0;
      track(AnalyticsEvent.USER_RETURNED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(user.level ?? 0, storeConfig.levelTiers),
        user_level: user.level ?? 0,
        // 모드마다 '보유량'이 사는 필드가 다르다 (포인트=points, 스탬프=stamps)
        stamps_total:
          storeConfig.mode === 'point' ? pointsOf(user) : user.stamps ?? 0,
        days_since_signup: daysSinceSignup,
        days_since_last_visit: daysSinceLastVisit,
        return_bucket: getReturnBucket(daysSinceLastVisit),
      });
      if (daysSinceLastVisit >= 1) {
        track(AnalyticsEvent.FIRST_VISIT_OF_DAY, {
          store_code: storeCode,
          user_id: hashPhone(phoneNumber),
          user_tier: getTierFromLevel(user.level ?? 0, storeConfig.levelTiers),
        });
      }
    } catch {}

    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: phoneNumber,
      mode: 'onboarding',
    });
    setViewModalContext({visible: true, phoneNumber});
    setNumber('');
  };

  const onAgreePress = async () => {
    if (!agree) {
      Alert.alert('이용약관에 동의해주세요.');
      return;
    }
    const phoneNumber = `010${number}`;
    setIsLoading(true);
    await addUser(phoneNumber);
    setIsLoading(false);

    try {
      identify(phoneNumber);
      track(AnalyticsEvent.SIGNUP_COMPLETED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(0, storeConfig.levelTiers),
        user_level: 0,
        stamps_total: 0,
        days_since_signup: 0,
      });
    } catch {}

    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: phoneNumber,
      mode: 'onboarding',
    });
    setViewModalContext({visible: true, phoneNumber});
    setNumber('');
    setModalVisible(false);
  };

  const onDeleteAccountPress = async () => {
    if (number.length < 8) {
      Alert.alert(
        '전화번호를 입력해주세요',
        '탈퇴할 계정의 전화번호를 먼저 입력해주세요.',
      );
      return;
    }
    const phoneNumber = `010${number}`;
    const existingUser = await getUser(phoneNumber);
    if (!existingUser) {
      Alert.alert('가입 이력 없음', '해당 번호로 가입된 계정이 없습니다.');
      return;
    }
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 스탬프, 쿠폰 등 모든 데이터가\n삭제되며 복구할 수 없어요.\n\n정말 탈퇴하시겠어요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteUserAccount(phoneNumber);
            if (success) {
              setNumber('');
              Alert.alert('탈퇴 완료', '그동안 이용해주셔서 감사합니다.');
            } else {
              Alert.alert('오류', '탈퇴 처리 중 문제가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  const closeViewModal = () => {
    setViewModalContext({visible: false, phoneNumber: ''});
  };

  const closeSignupModal = () => {
    setAgree(false);
    setModalVisible(false);
  };

  const logout = () => {
    Alert.alert('나가기', '고객 모드를 종료할까요?', [
      {text: '취소', style: 'cancel'},
      {text: '나가기', onPress: () => setIsAuthenticated(false)},
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      updateSession(`session_${storeCode}`, {
        last_used: new Date().toISOString().split('T')[0],
        phone: '',
        mode: 'waiting',
      });
    }, [storeCode]),
  );

  return {
    storeCode,
    storeName,
    storeConfig,
    number,
    modalVisible,
    viewModalContext,
    agree,
    setAgree,
    privacyVisible,
    setPrivacyVisible,
    isLoading,
    idleVisible,
    idleBgIndex,
    hintOpacity,
    phoneNumberLabel,
    onNumberPress,
    clearNumber,
    onConfirmPress,
    onAgreePress,
    onDeleteAccountPress,
    closeViewModal,
    closeSignupModal,
    dismissIdle,
    logout,
  };
}
