# 3.6.0 (빌드 1) — 제출 준비

라이브 버전은 **3.5.2**다. 온보딩 4장·QR 적립·준비 체크리스트·이미지 최적화·
적립 진행도 유실 수정은 이미 그 빌드로 나갔다.

**이번 버전에 사용자가 볼 수 있는 변화는 의견 보내기 하나뿐이다.**
온보딩 장표별 체류시간 계측이 함께 들어가지만 화면에 드러나지 않는다.

| 항목 | 값 |
|---|---|
| `package.json` | 3.6.0 |
| iOS `MARKETING_VERSION` | 3.6.0 (Debug/Release 둘 다) |
| iOS `CURRENT_PROJECT_VERSION` | 1 (버전 문자열이 바뀌었으므로 1부터) |
| Android `versionName` / `versionCode` | 3.6.0 / 1 (Play 미출시 — 문자열만 동기화) |

---

## App Store "이번 버전의 새로운 기능" (한국어)

```
불편한 점이나 필요한 기능을 앱에서 바로 보내실 수 있어요.
'내 매장' 맨 아래 '의견 보내기'에서 편하게 남겨주세요.
```

---

## App Review Notes (English — App Store Connect에 그대로 붙여넣기)

```
Pointo is a loyalty stamp app for small shops in Korea. It replaces the
paper stamp cards a shop hands out to its customers.

NEW IN THIS VERSION

Owners can now send us feedback from inside the app. On the "내 매장"
(My Stores) screen, scroll to the bottom and tap "의견 보내기" (Send
feedback), type anything, then tap "작성 완료" (Submit). The message
reaches our team by email.

The link is there from the moment you sign in — a store does not have to
be registered first — so steps 2 to 4 below are only needed if you want
to review the rest of the app.

We store the message text, the account email address and the app version.
No customer data is involved, and nothing is shown to other users.

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

---

## 제출 전 체크리스트

1. **⚠️ 운영 Firestore 규칙에 `match /feedback/` 블록이 있는지 확인** —
   Console → Firestore → 규칙. 없으면 의견 보내기가 심사 중에
   permission-denied로 실패해 2.1(App Completeness) 사유가 된다.
   8/28 규칙 배포 때 의견 보내기 WIP가 함께 나갔으므로 이미 들어가 있을 것이다.
   확실히 하려면 커밋된 HEAD에서 `firebase deploy --only firestore:rules` —
   지금은 HEAD == 운영 규칙이라 재배포해도 달라지는 게 없다.
2. `firebase deploy --only functions` — `onOpinionCreated` 배포.
   안 해도 앱은 정상 동작하고 의견도 저장된다. 메일 알림만 안 온다.
3. 실기기에서 의견 보내기 왕복 1회 — 전송 성공 + 메일 수신 확인.
4. Xcode Archive → 3.6.0 (1).
