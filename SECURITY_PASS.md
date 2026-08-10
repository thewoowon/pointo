# 보안 패스 — Firebase Auth 도입 + Firestore 규칙 강화

> 작성일: 2026-08-08 · 웹 확장(hellopointo.com) 1단계 선행 작업

## 왜 했나

기존 `firestore.rules`는 `users`·`logs`·`stores`·`owners`를 전부
`allow read, write: if true`로 열어두고 있었다. 앱이 Firebase Auth를 쓰지 않아
규칙에서 `request.auth`가 항상 null이었기 때문이다.

네이티브 앱만 있을 때는 "앱을 리버싱해야 뚫린다"는 약한 방어막이라도 있었지만,
**웹으로 확장하면 Firebase 설정이 브라우저 JS에 그대로 노출된다.** 콘솔에서
SDK 한 줄이면 고객 전화번호 1,170건이 통째로 덤프된다. 웹 이전의 전제 조건이라
먼저 처리했다.

---

## 무엇이 바뀌었나

### 1. Firebase Auth 도입

| | 이전 | 이후 |
|---|---|---|
| 점주 로그인 | 구글/애플 네이티브 SDK만 | + Firebase 자격증명 교환 |
| `ownerUid` | 구글/애플 **제공자 id** | **Firebase uid** |
| 고객 키오스크 | 인증 없음 | 익명(anonymous) 세션 |
| 규칙의 `request.auth` | 항상 null | 실제 신원 |

- `src/services/auth/firebase.ts` (신규) — 자격증명 교환·익명 세션·세션 복원 대기
- `src/services/auth/session.ts` (신규) — 로그아웃 시 소셜 토큰 + Firebase 세션을
  함께 정리. 흩어져 있던 3곳(스위처·계정설정·탈퇴유예)이 이 함수를 공유한다.
- Apple은 `response.nonce`(raw)를 Firebase에 넘긴다. 네이티브 모듈이 SHA-256
  해시본을 애플에 보내므로 identityToken 재사용 공격이 막힌다.

### 2. 레거시 uid 마이그레이션

기존 점주 계정은 `owners/{구글·애플 제공자 id}`로 저장돼 있다. 그대로 두면
새 규칙에서 **자기 매장에 접근하지 못한다.**

`useFirestore.migrateLegacyOwner()`가 재로그인 시 자동 처리한다:

1. `owners/{fbUid}`가 이미 있으면 → 아무것도 안 함 (재실행 안전)
2. `owners/{제공자id}`가 있으면 → 새 uid로 복사 + `stores.ownerId` 이전 +
   레거시 문서에 `migratedTo` 표식 (**삭제하지 않음** — 롤백 가능)
3. 둘 다 없으면 → 신규 가입

규칙은 ID 토큰의 `firebase.identities`에 그 제공자 id가 실제로 들어있을 때만
레거시 문서 접근을 허용한다. 남의 계정은 못 건드린다.

### 3. Firestore 규칙 재작성

핵심 방어선은 **열거(list) 차단**이다.

| 컬렉션 | 익명(키오스크) | 점주 | 미인증 |
|---|---|---|---|
| `users` | 단건 조회·생성·수정·삭제 | + **자기 매장** 목록 | ❌ |
| `logs` | 생성만 | 자기 매장 조회·삭제 | ❌ |
| `stores` | 단건 조회 | 단건 조회·생성·소유 매장 수정 (**목록 ❌**) | ❌ |
| `owners` | ❌ | 본인 문서만 | ❌ |
| `sessions` | 단건 읽기·쓰기 | 동일 | ❌ |
| `ownerTokens` | ❌ | ❌ | ❌ |

`users`·`logs`의 목록 조회는 `store_code`가 본인 소유일 때만 통과하므로,
필터 없는 전체 스캔은 반드시 실패한다.

#### `stores` 목록·claim 차단 (2026-08-10 추가 강화)

처음에는 점주 온보딩("전화번호로 기존 매장 불러오기")을 위해 `stores` 목록
조회를 점주에게 열어두고, "주인 없는 매장은 누구나 claim" 도 허용했다.
**둘 다 닫았다.**

- 규칙은 쿼리의 `where` 조건을 검사할 수 없다. "내 번호로 한 건 찾기"와
  "전 매장 덤프"를 구별할 방법이 없어, 점주 계정 하나만 만들면 전 매장의
  코드·이름·**점주 연락처**를 긁을 수 있었다. → `allow list: if false`
- 전화번호는 소유를 증명하지 않는다. 점주 연락처만 알면 주인 없는 매장을
  통째로 가져갈 수 있었고, 매장을 쥐면 `ownsStore`를 타고 **그 매장 고객
  전화번호 전량**이 열렸다. → 주인 없는 매장 claim 금지
- 대신 매장 **생성 시점에 주인을 못 박는다**(`ownerId == request.auth.uid`).
  "주인 없는 매장"이라는 상태 자체를 만들지 않는 것이 위 차단의 전제다.

앱에서 `findStoreByPhone`·`claimStoresByPhone`을 제거했다. 계정에 연결된
매장은 `owners.storeCodes`로 단건 조회한다(`getOwnerStores`).

**주인 없는 레거시 매장은 이제 서버에서만 연결한다** →
`scripts/transfer-store-owner.mjs` (Admin SDK). 대상 계정 uid는 점주가 한 번
로그인하면 `onOwnerCreated` 알림 메일로 날아온다.

### 4. 고객 탈퇴 경로를 서버로 이전

탈퇴 시 클라이언트가 `logs`를 쿼리해서 지우고 있었는데, 보안 규칙은 쿼리의
`where` 조건을 검사할 수 없다. 즉 "내 로그만 조회"로 좁힐 방법이 없어 결국
매장 전체 로그(= 전화번호 전량)를 열어줘야 한다.

→ 클라이언트는 본인 문서만 단건 삭제하고, 새 Function `onUserDeleted`가
이력을 정리한다.

### 5. `registerAppleToken` 인증 강화

uid를 요청 본문이 아니라 **Firebase ID 토큰**에서 뽑는다. 추가로 애플
identityToken의 `sub`가 그 Firebase 계정에 연결된 애플 신원과 일치하는지 확인한다.

---

## 검증

`__tests__/rules/firestore.rules.test.mjs` — 에뮬레이터 기반 54개 케이스, 전부 통과.

```bash
JAVA_HOME=<JDK 21+ 경로> yarn test:rules
```

주요 커버리지:
- 익명 세션의 `users`/`logs` 대량 덤프 차단 (필터 우회 시도 포함)
- 점주의 타 매장 데이터 접근 차단
- `stores` 목록 조회·주인 없는 매장 claim·남을 주인으로 박은 생성 차단
- 레거시 uid 마이그레이션 허용 / 타인의 레거시 문서 차단
- **적립·사용·가입·매장등록 등 실사용 경로가 막히지 않는지** (회귀 방지)

---

## ⚠️ 배포 순서 — 이 순서를 지키지 않으면 운영 중인 매장이 멈춘다

새 규칙은 Firebase Auth 세션을 전제한다. **현재 App Store에 올라간 버전은
Firebase Auth가 없으므로, 규칙을 먼저 배포하면 모든 매장이 즉시 멈춘다.**

다행히 업데이트 대상 기기는 많지 않다. 고객 1,170명은 앱을 설치하지 않고
매장 태블릿에 전화번호만 입력하는 구조라, 실제로 올려야 할 기기는
**매장당 태블릿 1대 + 점주 기기 1대** 뿐이다.

```
1. Firebase Console 준비
   ├ Authentication → 로그인 방법에서 Google / Apple / 익명 활성화
   │   ⚠️ 이 프로젝트는 Authentication을 쓴 적이 없어 설정 자체가 없었다.
   │      켜기 전에는 모든 로그인이 auth/configuration-not-found로 실패한다.
   │   ⚠️ 익명 사용자 "30일 자동 정리"는 **끈 채로 둘 것.** 매장 태블릿은 익명
   │      세션 하나로 몇 달씩 돌아가는데, 정리되면 적립이 조용히 멈춘다.
   ├ Google 제공자의 OAuth 클라이언트 ID가 .env의 GOOGLE_*_CLIENT_ID와 같은지 확인
   └ Apple 제공자에 Services ID / Team ID / Key 등록
       (앱은 네이티브 설정으로 충분하지만 **웹 Apple 로그인은 Services ID 필수**)

2. Functions 먼저 배포          firebase deploy --only functions   ✅ 완료 (2026-08-10)
   (onUserDeleted가 살아있어야 신버전 탈퇴에서 로그가 남지 않는다)
   배포 확인: onStoreCreated · onOwnerCreated · onUserDeleted ·
   registerAppleToken · purgeDeletedOwners — `firebase functions:list`

3. 앱 빌드 → TestFlight → 실기기 검증  ← 아래 체크리스트

4. App Store 심사·배포

5. 모든 매장 기기를 신버전으로 업데이트 (직접 확인)

6. ⛔ 매장 소유권 실측            node scripts/audit-store-owners.mjs
   (5번 이후에 볼 것 — 구버전 앱이 그 사이 주인 없는 매장을 또 만들 수 있다)

7. 마지막에 규칙 배포           firebase deploy --only firestore:rules
```

**5·6번이 끝나기 전에 7번을 하지 말 것.**

### ⛔ 규칙 배포 전 반드시 해결해야 하는 매장 (2026-08-10 실측)

새 규칙에서 `users`/`logs` 조회는 **`owners/{uid}.storeCodes`에 그 매장이 있을 때만**
통과한다. `node scripts/audit-store-owners.mjs` 기준 현재 상태:

| 매장 | 규모 | 상태 | 조치 |
|---|---|---|---|
| **JS 볼링센터** (U7KUF4) | 고객 129 · 로그 785 | 주인 없음 — 어떤 계정에도 연결 안 됨. **점주가 아직 한 번도 로그인한 적 없다**(`owners`에 매칭 계정 없음) | ⛔ **셀프 클레임 경로가 사라졌다.** ① 점주가 신버전 앱에서 소셜 로그인 1회 → ② `onOwnerCreated` 알림 메일의 이메일/uid로 `transfer-store-owner.mjs` 실행. ①이 없으면 ②를 할 수 없다 |
| **우리의 지난날들** (R2P36P) | 고객 1 · 로그 2 | `ownerId`가 **레거시 제공자 id**(`1039795…`, thewoowon76@gmail.com). `owners/{Firebase uid}` 문서가 없어 `ownsStore`가 실패한다 | 점주가 신버전에서 1회 로그인하면 `migrateLegacyOwner`가 자동 이전 |
| 룰루랄라 카페 강남점 (6CJOTR) | 고객 2 · 로그 8 | 주인 없음 | 사실상 테스트 매장. 점주 확인되면 위와 동일 |
| APPLE CONNECT (F1HVBB) | 고객 3 · 로그 1 | 주인 없음 | 심사용 매장 |
| 탈로스 (JKDYXC) | 고객 1 · 로그 0 | 주인 없음 | 2026-08-10 신규. **구버전 앱이 아직 주인 없는 매장을 만들고 있다는 증거** |
| ~~카페 그랑 (KB000001)~~ | 고객 1,376 · 로그 7,407 | ✅ **해결됨** — uid 이전 + `storeCodes` 역참조 완료 | — |

> 💡 감사 시 흔한 오탐: `stores.ownerId`가 채워져 있어도 그 값이 **레거시 제공자
> id면 규칙은 통과하지 못한다.** `ownsStore`는 `owners/{request.auth.uid}` 한 곳만
> 보기 때문이다(제공자 id 폴백 없음). `audit-store-owners.mjs`는 owners 문서 id가
> 실제 Firebase uid인지 Auth에 물어 이걸 걸러낸다.

> ⚠️ **문서가 원래 안내하던 "전화번호로 셀프 클레임"은 더 이상 동작하지 않는다.**
> 그 경로 자체가 보안 구멍이라 규칙에서 닫았다(위 "stores 목록·claim 차단" 참고).
> 주인 없는 매장은 **반드시 `scripts/transfer-store-owner.mjs`로 연결**해야 한다.
> 순서: 점주가 신버전 앱에서 소셜 로그인 1회 → `onOwnerCreated` 알림 메일에 찍힌
> 이메일/uid 확인 → `--to-email <이메일> --apply`.

방치하면: 키오스크 적립은 계속 되지만(익명 쓰기 허용) **점주가 적립내역·고객·통계를
전혀 못 본다.** 특히 JS 볼링센터는 외부 고객사라 영향이 크다.

(참고: 활동이 없는 테스트 매장 FJPS1Y·IV85XD·KWYCM4·L33F0B은 소유자가 없어도
실사용 영향이 없다.)

롤백: `git revert` 후 `firebase deploy --only firestore:rules`로 이전 규칙을
되돌리면 즉시 복구된다. 레거시 `owners` 문서를 지우지 않은 이유가 이것이다.

---

## 배포 전 실기기 체크리스트

규칙을 켜기 전에는 통과해도 의미가 제한적이다. **에뮬레이터에 새 규칙을 물린
상태**로 확인하는 게 가장 확실하다.

- [ ] 기존 점주 계정으로 구글 재로그인 → 매장 목록이 그대로 보이는가 (마이그레이션)
- [ ] Firestore에서 `owners/{새 uid}` 생성 + 레거시 문서에 `migratedTo` 확인
- [ ] `stores/{코드}.ownerId`가 새 uid로 바뀌었는가
- [ ] 애플 로그인 (실기기 필수) → 동일 확인
- [ ] 신규 계정 가입 → 매장 등록 → 스토어 코드 발급
- [ ] 고객 모드: 신규 번호 가입 → 적립 → 쿠폰 발급 → 사용
- [ ] 관리자 모드: 적립내역·고객검색·통계 화면 로딩
- [ ] 태블릿 고객모드 잠금(PIN) → 앱 재시작 → 익명 세션으로 정상 동작
- [ ] 고객 탈퇴 → users/terms 삭제 확인 → **몇 초 뒤 logs도 사라지는지**
- [ ] 로그아웃 → 재로그인
- [ ] 점주 탈퇴 요청 → 유예 화면 → 복구

---

---

# 2단계 — App Check (기기 무결성 증명)

## 왜

규칙만으로는 "요청자가 누구인가"까지는 알 수 없다. 키오스크가 쓰는 익명 세션은
**누구나 발급받을 수 있는 신원**이라, 전화번호를 이미 아는 공격자가 그 사람의
스탬프를 단건 조회·조작하는 건 아직 가능하다.

App Check는 "이 요청이 실제로 우리 앱에서 왔는가"를 플랫폼 수준에서 증명한다.
웹은 코드가 그대로 공개돼 익명 세션 획득이 앱보다 훨씬 쉬우므로,
**웹 확장(A안) 착수 전에 올려두는 것을 전제로 한다.**

## 무엇이 바뀌었나

- `src/services/appCheck.ts` (신규) — 플랫폼별 제공자 설정
  - iOS: `appAttestWithDeviceCheckFallback` (App Attest는 iOS 14+, 그 이하는 DeviceCheck)
  - Android: `playIntegrity`
  - 개발 빌드(`__DEV__`): `debug` 제공자 (시뮬레이터엔 App Attest가 없다)
- `index.js`에서 호출 — **Firestore/Auth 첫 요청보다 먼저**여야 한다.
  컴포넌트의 `useEffect`는 이미 늦다 (AuthContext가 마운트 즉시 세션을 복원한다).
- `ios/KBffee/KBffee.entitlements` — App Attest 환경 키 추가
- `pod install` 완료 (FirebaseAppCheck 11.10.0)

## ⚠️ 적용(enforce) 순서 — 규칙과 같은 함정

**코드만으로는 아무것도 차단되지 않는다.** Firebase Console에서 Firestore의
App Check 적용을 켜야 실제로 막힌다. 그리고 켜는 순간 App Check 토큰이 없는
구버전 앱은 **전부 차단된다.**

```
1. Firebase Console → App Check
   ├ iOS 앱 등록 → App Attest 제공자
   ├ Android 앱 등록 → Play Integrity 제공자
   └ 개발 기기용 디버그 토큰 등록
      (앱을 dev로 실행하면 콘솔에 토큰이 찍힌다. src/services/appCheck.ts의
       DEBUG_TOKEN에 박아도 되지만, 릴리즈에는 절대 들어가지 않는다)

2. 앱 배포 (1단계 보안 패스와 같은 빌드에 실어도 된다)

3. Console에서 **모니터링 모드**로 며칠 관찰   ← 절대 건너뛰지 말 것
   "확인된 요청" 비율이 100%에 수렴하는지 본다.
   비율이 낮으면 아직 구버전 기기가 남아 있다는 뜻이다.

4. 100% 근처가 되면 Firestore에 적용(enforce) 켜기
```

롤백: Console에서 적용을 끄면 즉시 복구된다 (앱 재배포 불필요).

## 남은 위험 (3단계 이후)

| 순서 | 조치 | 효과 |
|---|---|---|
| 1 | 적립·사용 쓰기를 **Callable Function**으로 이전 | 스탬프 위조 원천 차단 + 서버 검증 |
| 2 | 매장 코드를 커스텀 클레임으로 발급 | 규칙의 `get()` 제거 → 읽기 비용·지연 감소 |

웹 클라이언트를 만들 때는 App Check 웹 제공자(reCAPTCHA v3 / Enterprise)를
별도로 등록해야 한다. 앱과 사이트 키가 다르다.

### 웹(pointo-web)에 남은 정리 대상

`lib/firestore/owners.ts`의 `claimStoresByPhone`이 아직 살아 있다. `stores`
컬렉션을 `where("ownerPhone", ...)`로 쿼리하는데, 새 규칙에서는 목록 조회가
막혀 `permission-denied`가 난다. **현재 호출하는 곳이 없어 당장은 무해**하지만,
규칙 배포 전에 지우는 게 맞다. 앱에서는 이미 제거했다.
