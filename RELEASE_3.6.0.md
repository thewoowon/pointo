# 3.6.0 (빌드 1) — 제출 준비

마지막 **출시** 버전은 **3.4.0 (빌드 5)**다. 3.5.0 / 3.5.2는 버전만 올려두고
제출하지 않았으므로, 이번 제출에는 그 사이의 작업이 전부 실린다.
버전 문자열이 3.4.0에서 바뀌었으므로 빌드 번호는 1부터 다시 센다.

| 항목 | 값 |
|---|---|
| `package.json` | 3.6.0 |
| iOS `MARKETING_VERSION` | 3.6.0 (Debug/Release 둘 다) |
| iOS `CURRENT_PROJECT_VERSION` | 1 |
| Android `versionName` / `versionCode` | 3.6.0 / 1 (Play 미출시 — 문자열만 동기화) |

---

## App Store "이번 버전의 새로운 기능" (한국어)

```
처음 쓰실 때 가장 많이 막히던 부분을 손봤어요.

• 사용법 안내가 생겼어요. 적립하려면 관리자 화면과 고객 화면이 둘 다 켜져
  있어야 하는데, 왜 그런지를 처음 실행할 때 알려드려요.
• 고객용 기기가 따로 없어도 괜찮아요. QR을 보여드리면 손님 휴대폰에서
  번호를 입력할 수 있어요.
• 매장을 만든 뒤 첫 적립까지 뭐가 남았는지 홈에서 알려드려요.
• 불편한 점이나 필요한 기능을 앱에서 바로 보내실 수 있어요.
• 적립 진행도가 초기화되던 문제를 고쳤어요.
```

## 3.4.0 이후 들어간 것 (내부용)

| 커밋 | 내용 |
|---|---|
| `7a15d38` | 대기화면 워드마크·슬로건 |
| `8b81501` | 사용법 온보딩 4장 (첫 실행 / 매장 등록 직후 / 설정에서 다시보기) |
| `284b47d` | 손님 폰으로 적립받는 QR |
| `045dea4` | 첫 적립까지의 준비 체크리스트 |
| `d793c54` | 온보딩 이미지 2.05MB → 0.39MB |
| `83ec669` | **적립 진행도 유실 수정** — 고객 문서를 읽기 전에는 쓰지 않는다 |
| `6d406fb` | 같은 유실을 규칙에서도 차단 (앱 배포와 무관, 2026-08-28 배포 완료) |
| `dc22780` `6df5fc2` | 의견 보내기 + 도착 시 메일 알림 |
| `37c75fa` | 온보딩 장표별 체류시간 계측 |

---

## App Review Notes (English — App Store Connect에 그대로 붙여넣기)

```
WHAT THIS APP IS

Pointo replaces paper loyalty stamp cards for small businesses. One app has two
modes, chosen after sign-in:

  • Owner mode  — the shop owner records a stamp or a point for a customer.
  • Customer mode — a screen the customer taps to enter their phone number.

Customers do not install anything. The shop runs the customer screen on a spare
phone or tablet placed on the counter, or shows a QR code so the customer can use
their own phone instead.

SIGNING IN — NO DEMO ACCOUNT NEEDED

The app uses Sign in with Apple and Google Sign-In only. Please sign in with any
Apple ID; a shop-owner account is created instantly and you land on the "내 매장"
(My Stores) screen. Everything described below is reachable from there without
creating a store, so no demo credentials are required.

If you prefer a pre-filled account, please reply to this message and we will
provide one within a few hours.

WHAT IS NEW IN 3.6.0

1. First-run guide (4 screens) explaining that recording a stamp needs both the
   owner screen and the customer screen to be open.
2. QR flow for shops without a second device: the owner shows a QR code and the
   customer enters their phone number on their own phone.
3. A setup checklist on the home screen that disappears after the first stamp.
4. NEW: "Send feedback" — owners can send us a free-text message from inside the
   app.
5. Fix for a bug that could reset a customer's stamp progress.

HOW TO REACH THE NEW FEEDBACK FEATURE (about 20 seconds)

  Sign in  →  "내 매장" (My Stores)  →  scroll to the bottom
  →  tap "의견 보내기" (Send feedback)  →  type any text
  →  tap "작성 완료" (Submit)

You will see a confirmation alert. The message is delivered to our team by email.
We store only the message text, the account email address, the app version and the
OS version. No customer data is involved, and nothing is shown publicly or to
other users.

ABOUT THE CORE STAMPING FLOW (please read if you want to test it)

Recording a stamp requires two screens at the same time — this is the product's
core constraint, not a defect, and it is what the new first-run guide explains.
With a single device you can review the whole app, but the moment of stamping
cannot be completed, because the owner screen has to stay open while the customer
enters their number on the second screen.

To test it end to end you have two options:

  (a) Two devices — sign in on both, open the same store, choose Owner mode on
      one and Customer mode on the other.
  (b) One device + any phone with a camera — in Owner mode, tap the QR button.
      Scanning it opens a web page where the phone number is entered, and the
      stamp is then recorded on the owner device.

ACCOUNT DELETION

Account deletion is available in Settings (gear icon on the My Stores screen) →
회원 탈퇴. It removes the account after a 30-day grace period and revokes the
Sign in with Apple token, as required by guideline 5.1.1(v).

CONTACT

thewoowon@gmail.com — we monitor this during review hours and can respond quickly.
```

---

## 제출 전 체크리스트

1. **⚠️ 운영 Firestore 규칙에 `match /feedback/` 블록이 있는지 확인** —
   Console → Firestore → 규칙. 없으면 의견 보내기가 심사 중에
   permission-denied로 실패해 2.1(App Completeness) 사유가 된다.
   해소법: 커밋된 HEAD에서 `firebase deploy --only firestore:rules`.
   지금은 HEAD == 운영 규칙 + feedback이라 재배포해도 달라지는 게 없다
   (8/28 배포 때 의견 보내기 WIP가 함께 나갔고, 이제 그 WIP가 커밋됐다).
2. `firebase deploy --only functions` — `onOpinionCreated` 배포.
   안 해도 앱은 정상 동작하고 의견도 저장된다. 메일 알림만 안 온다.
3. 실기기에서 의견 보내기 왕복 1회 — 전송 성공 + 메일 수신 확인.
4. `83ec669`(적립 진행도 가드)가 빌드에 포함됐는지 확인. 이번 릴리스의 진짜
   목적이다.
5. Xcode Archive → 3.6.0 (1).
