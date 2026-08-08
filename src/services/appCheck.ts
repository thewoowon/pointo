/**
 * Firebase App Check 초기화.
 *
 * 왜 필요한가: 보안 패스로 "고객 전화번호 대량 열거"는 막았지만, 키오스크가 쓰는
 * 익명 세션은 **누구나 발급받을 수 있는 신원**이다. 즉 전화번호를 이미 아는
 * 공격자가 그 사람의 스탬프를 단건 조회하거나 조작하는 건 아직 가능하다.
 * App Check는 "요청이 실제로 우리 앱에서 왔는가"를 기기·플랫폼 수준에서 증명해
 * 이 구멍을 닫는다. 웹은 코드가 그대로 공개되므로 웹 확장 전에 특히 중요하다.
 *
 * ⚠️ 반드시 Firestore/Auth 첫 요청보다 **먼저** 실행되어야 한다.
 *    그래서 화면 컴포넌트가 아니라 앱 엔트리(index.js)에서 호출한다.
 *
 * ⚠️ 코드만으로는 아무것도 강제되지 않는다. Firebase Console에서 Firestore의
 *    App Check 적용(enforce)을 켜야 실제로 차단된다. 켜는 순간 App Check가 없는
 *    구버전 앱은 전부 막히므로, 반드시 모니터링 모드로 지표를 먼저 볼 것.
 *    (SECURITY_PASS.md의 롤아웃 절차 참고)
 */

import {Platform} from 'react-native';
import {firebase} from '@react-native-firebase/app-check';

/**
 * 개발 빌드용 디버그 토큰.
 *
 * 시뮬레이터/에뮬레이터에는 App Attest·Play Integrity가 없어서 디버그 제공자를
 * 쓴다. 값을 비워두면 실행 시 콘솔에 토큰이 찍히고, 그걸 Firebase Console의
 * App Check → 앱 → 디버그 토큰에 등록하면 된다.
 *
 * 릴리즈 빌드(__DEV__ === false)에서는 절대 사용되지 않는다.
 */
const DEBUG_TOKEN: string | undefined = undefined;

let initialized = false;

/**
 * App Check를 활성화한다. 앱 생명주기당 1회만 유효하며, 재호출은 무시된다.
 *
 * 실패해도 앱을 죽이지 않는다. Console에서 아직 적용(enforce)을 켜지 않았다면
 * 토큰이 없어도 서비스는 정상 동작하고, 켠 뒤라면 어차피 개별 요청이 실패하며
 * 그 편이 원인을 파악하기 쉽다.
 */
export async function initializeAppCheck(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const provider = firebase
      .appCheck()
      .newReactNativeFirebaseAppCheckProvider();

    provider.configure({
      apple: {
        // App Attest는 iOS 14+ 전용이라 구형 기기는 DeviceCheck로 떨어뜨린다.
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        debugToken: DEBUG_TOKEN,
      },
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        debugToken: DEBUG_TOKEN,
      },
      isTokenAutoRefreshEnabled: true,
    });

    await firebase.appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    console.log(`✅ App Check 활성화 (${Platform.OS}, ${__DEV__ ? 'debug' : 'production'})`);
  } catch (error) {
    // 초기화 실패를 삼키면 "왜 막히는지 모르는" 상태가 되므로 크게 남긴다.
    console.error('❌ App Check 초기화 실패 — 요청이 차단될 수 있습니다:', error);
  }
}
