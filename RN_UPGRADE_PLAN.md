# React Native 업그레이드 작업 계획

> 0.76.9 → latest stable (0.84+)

## 현재 상태 진단

| 항목 | 현재 버전 | 비고 |
|------|-----------|------|
| react-native | 0.76.9 | 지원 종료 |
| react | 18.3.1 | |
| @react-native-firebase/* | 21.13.0 | 0.84+에서 `forceStaticLinking` 필요 |
| @react-navigation/* | v7 | 호환 가능 |
| react-native-reanimated | 3.16.7 | 업데이트 필요 |
| react-native-gesture-handler | 2.24.0 | 업데이트 필요 |
| react-native-linear-gradient | 2.8.3 | 네이티브 모듈, 확인 필요 |
| react-native-screens | 4.9.0 | 호환 확인 |
| react-native-safe-area-context | 5.2.0 | 호환 확인 |
| react-native-svg | 15.11.2 | 호환 확인 |
| @gorhom/bottom-sheet | 5.x | 호환 확인 |
| typescript | 5.0.4 | 호환 가능 |
| @babel/core | 7.20.0 | 호환 확인 필요 |
| Yarn | 3.6.4 | |
| 커스텀 네이티브 코드 | 없음 | 업그레이드에 유리 |
| New Architecture | 이미 활성화 | 0.76부터 기본 |

## iOS 네이티브 설정

- **Deployment Target**: 혼재 (13.4 / 15.6) → 통일 필요
- **Swift Version**: 5.0
- **Podfile 특이사항**:
  - `use_frameworks! :linkage => :static`
  - `$RNFirebaseAsStaticFramework = true`
  - Xcode 26 Clang fmt 호환 패치 적용 중
- **Ruby**: >= 2.6.10
- **CocoaPods**: >= 1.13

## Android 네이티브 설정

- **minSdkVersion**: 23
- **compileSdkVersion**: 34
- **targetSdkVersion**: 34
- **buildToolsVersion**: 34.0.0
- **NDK**: 26.1.10909125
- **Kotlin**: 1.9.24
- **Google Services Plugin**: 4.4.2

## 핵심 위험 요소

### 1. Firebase iOS 빌드 (HIGH)
RN 0.84+에서 prebuilt core 방식 변경으로 `forceStaticLinking` 설정 필수.
0.79에서도 "Multiple commands produce headers" 빌드 이슈 리포트 있음.

- 참고: https://github.com/invertase/react-native-firebase/issues/8528

### 2. New Architecture 전면 전환 (MEDIUM)
0.82부터 레거시 아키텍처 완전 제거. 이미 활성화 상태이므로 큰 문제 없을 것으로 보이나 검증 필요.

- 참고: https://github.com/reactwg/react-native-new-architecture/discussions/290

### 3. 8개 이상 마이너 버전 점프 (MEDIUM)
Podfile, Gradle, Metro 설정 전부 변경됨. Upgrade Helper diff를 반드시 참고할 것.

## 추천 전략

**직행 업그레이드** — 커스텀 네이티브 코드가 없고 New Architecture 이미 활성화 상태이므로 중간 정거장 없이 최신 stable로 직행.

## 스프린트 구조 (예상 1~2주)

### Day 1-2: 준비 & 코어 업그레이드

- [ ] 현재 상태 git tag 찍기 (`pre-rn-upgrade`)
- [ ] 별도 브랜치 생성 (`feat/rn-upgrade`)
- [ ] [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)에서 0.76.9 → latest diff 확인
- [ ] `package.json` 코어 패키지 일괄 업데이트
  - `react`, `react-native`
  - `@react-native/babel-preset`
  - `@react-native/metro-config`
  - `@react-native/typescript-config`
  - `@react-native/eslint-config`
  - `@react-native-community/cli`
- [ ] `yarn install` → lockfile 갱신

### Day 2-3: 네이티브 설정 동기화

**iOS:**
- [ ] Podfile 업데이트 (Upgrade Helper diff 기준)
- [ ] Deployment target 통일 (13.4 → RN 요구사항에 맞춤)
- [ ] Firebase static framework linking 설정 유지 확인
- [ ] `pod install --repo-update`
- [ ] Xcode 빌드 에러 해결 (**가장 시간 소요 예상**)

**Android:**
- [ ] `build.gradle` AGP 버전 업데이트
- [ ] Kotlin 버전 확인 및 업데이트
- [ ] `compileSdkVersion`, `targetSdkVersion` 확인
- [ ] Gradle sync & 빌드

### Day 3-4: 서드파티 라이브러리 호환성

- [ ] `react-native-reanimated` → 최신 (RN 버전별 호환표 확인)
- [ ] `react-native-gesture-handler` → 최신
- [ ] `react-native-linear-gradient` → 최신
- [ ] `react-native-screens` → 최신
- [ ] `react-native-safe-area-context` → 최신
- [ ] `react-native-svg` → 최신
- [ ] `@react-native-firebase/*` → 최신 (forceStaticLinking 적용)
- [ ] `@gorhom/bottom-sheet` → 호환 확인
- [ ] `react-native-toast-message` → 호환 확인

### Day 4-5: Metro / Babel / TypeScript 설정

- [ ] `metro.config.js` 새 옵션 반영
- [ ] `babel.config.js` preset 확인
- [ ] `tsconfig.json` 업데이트
- [ ] TypeScript 빌드 확인 (`npx tsc --noEmit`)

### Day 5-7: 회귀 테스트

**고객 모드 (태블릿):**
- [ ] 번호 입력 → 대시보드 진입
- [ ] 스탬프 표시 (공 애니메이션)
- [ ] 스탬프 근접 오버레이 (1개/2개 남음)
- [ ] 쿠폰 획득 오버레이
- [ ] 세션 타임아웃 → 대기 화면 복귀

**관리자 모드 (태블릿):**
- [ ] 적립 탭 → 스탬프 적립
- [ ] 사용 탭 → 쿠폰 선택 → 스탬프 차감
- [ ] 부분 사용 (1개 단위)
- [ ] 매장 설정 → 쿠폰 모드 (싱글/더블) 전환 → 저장
- [ ] 대시보드 KPI 확인

**Firebase:**
- [ ] 로그인 / 세션 유지
- [ ] Firestore 읽기 / 쓰기
- [ ] 로그 기록 확인
- [ ] Analytics 이벤트 전송

**플랫폼별:**
- [ ] iOS 시뮬레이터 전체 플로우
- [ ] Android 에뮬레이터 전체 플로우
- [ ] TestFlight 배포 → 실기기 테스트

### Day 7+: 마무리

- [ ] 성능 비교 (앱 크기, 시작 시간)
- [ ] main에 머지
- [ ] 앱스토어 + 플레이스토어 제출

## 주의사항

1. **iOS 빌드가 가장 큰 벽.** CocoaPods + Firebase static framework + New Architecture 조합에서 헤더 충돌이 빈번. Day 2-3에 시간 여유를 넉넉히 확보할 것.

2. **한 번에 전부 바꾸지 말 것.** 코어 RN 먼저 올리고 빌드 확인, 그 다음 서드파티 하나씩 업데이트.

3. **Upgrade Helper diff를 반드시 따를 것.** 수동으로 추측하면 누락 발생.

4. **운영 중인 서비스에 영향 없도록** 볼링장 고객 온보딩 안정화 이후 별도 스프린트로 진행.

## 참고 자료

- [React Native Versions](https://reactnative.dev/versions)
- [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)
- [RN Support Policy](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md)
- [New Architecture Freeze](https://github.com/reactwg/react-native-new-architecture/discussions/290)
- [Firebase + RN 0.79 Issue](https://github.com/invertase/react-native-firebase/issues/8528)
- [RN Releases](https://github.com/facebook/react-native/releases)
