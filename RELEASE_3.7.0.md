# 3.7.0 (빌드 1) — 제출 준비

라이브 버전은 **3.6.0**(iOS). Android는 이번이 **Play 첫 업로드**다.

이번 버전의 중심은 **결제 금액 비례 적립**이다. 포인트 매장 사장님이 설문에서
지목한 유일한 결손이었다 — "12,000원의 2% 적립, 이렇게 바로 계산이 안 되는 게
아쉽다". 여기에 매장 삭제/복구와 인앱 이용 설문이 함께 들어간다.

| 항목 | 값 |
|---|---|
| `package.json` | 3.7.0 |
| iOS `MARKETING_VERSION` | 3.7.0 (Debug/Release 둘 다) |
| iOS `CURRENT_PROJECT_VERSION` | 1 (버전 문자열이 바뀌었으므로 1부터) |
| Android `versionName` / `versionCode` | 3.7.0 / 1 (Play 첫 업로드) |

---

## 들어간 것

### 사용자가 보는 변화

- **결제 금액 비례 적립** — 매장 설정에서 적립률을 정해두면, 적립 화면에서
  결제 금액만 누르면 포인트가 자동 계산된다. 포인트 모드 전용이고, 기존
  "포인트 직접 입력"은 그대로 남는다.
- **매장 삭제와 되돌리기** — 내 매장 → 매장 편집. 지운 매장은 30일 동안
  '삭제 대기 중'에 남아 있고 그 자리에서 되돌릴 수 있다.
- **의견 보내기가 홈 상단으로** — 매장이 여러 개면 화면 밖으로 밀려 있었다.
- **이용 설문** — 가입 3일이 지난 계정에 홈에서 한 번 권한다. '나중에'는 7일 뒤 재노출.

### 조용한 수정

- **중복 적립 방지** — 느린 네트워크에서 적립 버튼을 두 번 누르면 두 번
  적립되던 문제. 쓰기 핸들러 전체가 한 번에 하나만 통과한다.
- **적립 상세 문구** — 적립 건이 무조건 '스탬프 적립'으로 표시돼, 포인트
  매장에서 결제 금액이 안 보였다.
- **매장 목록 실시간화** — 기기 두 대에서 한쪽 변경이 다른 쪽에 반영되지 않던 문제.

### Android

- New Architecture 전환, 업로드 키 서명, 부팅 즉시 죽던 SoLoader 초기화 수정.
  (이 셋은 이전 브랜치에서 넘어왔고 이번 빌드로 처음 출시된다)

---

## 마이그레이션

**없다.** `pointEarnMode` 기본값이 `'manual'`, `rewardRateBps`가 `0`이라
매장 문서에 키가 없는 기존 매장은 지금과 똑같이 동작한다. 백필 스크립트를
돌릴 필요가 없다.

`stores.lifecycle`도 없으면 `'active'`로 본다.

---

## App Store "이번 버전의 새로운 기능" (한국어)

```
결제 금액만 누르면, 포인트는 알아서 쌓여요

매장 설정에서 적립률을 한 번 정해두시면 됩니다. 직원은 결제 금액만
입력하고, 12,000원의 2%는 240원으로 바로 계산돼요. 암산할 일도,
새 직원에게 규칙을 가르칠 일도 없습니다.

• 매장을 직접 삭제할 수 있어요. 30일 안에는 되돌릴 수 있습니다.
• 적립 내역에서 결제 금액이 함께 보여요.
• '의견 보내기'를 찾기 쉽도록 홈 위쪽으로 옮겼어요.
• 네트워크가 느릴 때 적립이 두 번 되던 문제를 고쳤어요.
```

---

## App Review Notes (English — App Store Connect에 그대로 붙여넣기)

```
Pointo is a loyalty app for small shops in Korea. It replaces the paper
stamp cards a shop hands out to its customers. A shop can run either
stamps (one per visit) or points (a balance), and chooses which.

NEW IN THIS VERSION

1) Points can now be calculated from the amount a customer paid.

   Until now staff had to work out the points themselves and type that
   number in. A shop can now set a reward rate once, and staff only enter
   the amount paid. 12,000 KRW at 2% becomes 240 points.

   To try it, from owner mode (see GETTING IN below):
     a. Tap the gear icon in the header → "매장 설정" (Store settings).
     b. Under "운영 모드" (Operating mode) choose "포인트 적립" (Points).
        A confirmation dialog explains the switch — tap "전환" (Switch).
     c. Under "적립 방식" (Earning method) choose "결제 금액 비례"
        (Proportional to amount).
     d. Type 2 into "적립률 (%)" (Reward rate). A line below shows
        "12,000원 결제 → 240원 적립" as you type.
     e. Tap "저장" (Save), then go back.
     f. Enter any phone number for a customer, tap 적립 (Earn). The input
        now asks for the amount paid. Type 12000 — the screen shows
        "12,000원의 2% → 240원" and the button reads "240원 적립하기"
        (Earn 240).

   "포인트 직접 입력" (Enter points directly) at step (c) keeps the old
   behaviour, and shops using stamps are unaffected.

2) Owners can delete a store, and undo it for 30 days.

   "내 매장" (My Stores) → "매장 편집" (Edit stores) → select a store →
   "매장 삭제" (Delete store) → confirm. The store then appears under
   "삭제 대기 중" (Pending deletion) with a "되돌리기" (Restore) button
   next to it. Nothing is permanently removed until the 30 days pass, so
   deleting a test store during review is safe and reversible.

3) A one-time survey card on the home screen, and the existing feedback
   link moved from the bottom of that screen to the top.

We store the survey answers, the account email address and the app
version. No customer data is involved, and nothing is shown to other
users.

GETTING IN

  1. Launch → the onboarding guide appears → "완료" (Done) →
     "애플로 계속하기" (Continue with Apple).
  2. The "내 매장" (My Stores) screen will be empty for a new account.
     Tap "새 매장 등록" (Register new store). Any store name and phone
     number will do — the store is created immediately, with no
     approval step.
  3. Tap "바로 시작" (Start now). The onboarding guide appears once more →
     "완료" (Done). You will land on "내 매장" (My Stores).
  4. Tap the store, then choose "관리자용" (Owner).

Owner mode covers every feature of the app. Wherever a customer phone
number is asked for, any fictitious number works (e.g. 010-0000-0000).

CUSTOMER MODE SETS A DEVICE PIN

Choosing "고객용" (Customer) locks the device into the kiosk screen and
asks you to set a 4-digit PIN first. That PIN is required to exit
customer mode, and there is no master PIN — please note it down.

ACCOUNT DELETION

"내 매장" (My Stores) → settings icon in the header → "회원 탈퇴"
(Delete account). The account is deactivated at once and permanently
deleted after a 30-day grace period.
```

## 제출 전 체크리스트

### ⚠️ 반드시 먼저

1. **`firebase deploy --only functions`** — 이번엔 선택이 아니다.
   `purgeDeletedStores`가 새로 들어갔고, **이게 없으면 삭제 대기 매장이
   영원히 안 지워진다.** 점주 화면에서는 '삭제 대기 중'에 남은 채
   "30일 뒤 완전히 삭제돼요"가 계속 뜬다.
   `onOpinionCreated`의 설문 구분(제목 갈라치기)도 함께 나간다.

2. **Firestore 규칙은 그대로다.** 이번 변경은 규칙을 하나도 건드리지 않았다.
   매장 삭제는 `stores` update(소유자 허용)만 쓰고, `allow delete: if false`는
   유지된다. 설문은 기존 `feedback` create 규칙을 그대로 탄다.

### 확인

3. 실기기에서 결제 금액 적립 왕복 1회 — 12,000 입력 → 240 표시 → 적립 후
   잔액과 적립내역의 금액 문구 확인.
4. 기기 2대로 매장 삭제 → 다른 기기 목록에서 즉시 사라지는지, 되돌리면
   돌아오는지.
5. 설문 1건 제출 → 메일 수신 확인(제목이 "설문 응답 도착"으로 갈라지는지).

### 빌드

6. Xcode Archive → 3.7.0 (1).
7. Android: `./gradlew bundleRelease` → 3.7.0 / versionCode 1로 Play 첫 업로드.
   업로드 키는 이미 생성돼 있다.

   **`clean`을 같은 명령에 붙이지 말 것.** `./gradlew clean bundleRelease`는
   실패한다 — `clean`이 node_modules 안 네이티브 라이브러리들의 build까지
   지우는데, 그 경로는 설정 단계에 이미 잡혀 있어서 prefab 소비 단계에서
   "directory ... is not readable"로 터진다. (reanimated·worklets)
   청소가 필요하면 `./gradlew clean`을 **따로** 돌리고 나서 빌드한다.

   빌드 뒤 버전 확인:
   ```
   grep -oE 'android:version(Code|Name)="[^"]*"' \
     android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml
   ```
   AAB는 protobuf 매니페스트라 aapt2로 직접 못 읽는다. 이 병합 매니페스트가
   번들에 들어간 값 그대로다.

---

## 이번에 하지 않은 것

- **서버 재계산 없음.** 적립 포인트는 앱에서 계산해 쓴다. 조작 주체가
  자기 매장 포인트를 늘리는 점주라 위협이 아니고, 카운터 경로에 함수 왕복을
  넣으면 네트워크가 나쁠 때 적립이 실패한다. 대신 로그에 금액·적립률·포인트를
  전부 스냅샷해 사후 검증이 가능하게 해뒀다.
- **POS 연동 없음.** 로그의 `source` 필드만 확장 가능한 모양으로 열어뒀다.
- **매장 이름 편집 없음.** '매장 편집'은 현재 삭제 전용이다.
