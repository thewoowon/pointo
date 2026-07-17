# 실시간 세션 푸시 — 앱이 열려 있는 상태를 전제로 마찰을 0에 가깝게 줄이는 접근

> 이 문서는 Firebase `onSnapshot` 또는 동등한 실시간 채널을 기반으로,  
> 서버가 특정 클라이언트의 앱 UI를 **능동적으로 전환**하는 패턴을 설명합니다.  
> Firebase 없이 자체 구현하는 방법까지 다룹니다.

---

## 1. 문제 — 기존 방식의 마찰

사용자가 서비스 담당자와 **대면하고 있는 상황**에서, 담당자가 고객 앱의 특정 화면을 열어달라고 요청해야 하는 경우가 있습니다.

| 기존 방식 | 문제 |
|-----------|------|
| SMS / LMS 발송 | 수신 딜레이, 피싱 문제, 모바일 브라우저 전환 |
| QR 코드 스캔 | 고객이 카메라를 직접 켜야 함, 고령층 허들 |
| FCM 푸시 알림 | 알림 권한 차단 시 도달 불가, 알림 탭 후 진입 |
| 구두 안내 | 고객이 직접 메뉴를 찾아야 함 |

공통적인 문제: **고객이 무언가를 해야 다음 단계로 넘어갈 수 있다.**

---

## 2. 아이디어 — 서버가 UI를 호출한다

```
담당자 단말에서 고객 ID를 입력
  → 서버(또는 Firestore)에 액션 기록
  → 고객 앱이 실시간으로 변경을 감지
  → 고객이 아무것도 하지 않아도 모달/화면 자동 전환
```

핵심 전제: **앱이 열려 있는 상태 (Foreground)**.  
이 전제 하나로 이후 모든 흐름은 고객 개입 없이 자동화됩니다.

---

## 3. Firebase 기반 구현

### 3-1. 데이터 구조

```
Firestore
└── sessions
    └── session_{userPin}          ← 이 문서 하나가 채널
        ├── action: 'card_issue'   ← 어떤 화면을 열지
        ├── payload: { type: 'credit', ... }
        ├── status: 'pending'      ← pending → consumed
        └── expiredAt: Timestamp   ← 3분 유효
```

### 3-2. 담당자 단말 (쓰기)

```ts
// 담당자가 고객 PIN 입력 후 [카드 발급 요청] 버튼
const sessionRef = doc(db, 'sessions', `session_${customerPin}`);
await setDoc(sessionRef, {
  action: 'card_issue',
  payload: { type: 'credit' },
  status: 'pending',
  expiredAt: Timestamp.fromDate(new Date(Date.now() + 3 * 60 * 1000)),
});
```

### 3-3. 고객 앱 (리스닝)

```ts
useEffect(() => {
  if (!userPin) return;

  const db = getFirestore();
  const sessionRef = doc(db, 'sessions', `session_${userPin}`);

  const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
    if (!docSnap.exists) return;

    const data = docSnap.data();
    if (!data) return;

    // 유효기간 체크
    if (data.expiredAt.toDate() < new Date()) return;

    // 이미 처리된 액션 무시
    if (data.status !== 'pending') return;

    // 액션에 따라 화면 전환
    if (data.action === 'card_issue') {
      navigation.navigate('CardIssueModal', data.payload);

      // 즉시 consumed 처리 (중복 실행 방지)
      updateDoc(sessionRef, { status: 'consumed' });
    }
  });

  return () => unsubscribe(); // 언마운트 시 구독 해제
}, [userPin]);
```

### 3-4. 전체 흐름

```
담당자 단말                 Firestore                    고객 앱
    │                          │                            │
    │─── setDoc(action) ──────▶│                            │
    │                          │◀─── onSnapshot 리스닝 중 ──│
    │                          │     변경 감지 (~수백ms)    │
    │                          │                            │─── 모달 자동 팝업
    │                          │◀─── updateDoc(consumed) ───│
    │                          │                            │
```

응답 속도: **네트워크 RTT 수준 (수백ms)**. 폴링 없음.

---

## 4. 자체 구현 — Firebase 없이도 된다

Firebase는 이 패턴의 인프라를 대신 제공해줄 뿐입니다.  
동일한 원리를 직접 구현하는 방법은 두 가지입니다.

### 방법 A — WebSocket

양방향 통신이 필요할 때 적합합니다.

**서버 (Node.js / ws)**
```ts
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map<string, WebSocket>(); // pin → socket

wss.on('connection', (ws, req) => {
  const pin = new URL(req.url!, 'http://x').searchParams.get('pin');
  if (pin) clients.set(pin, ws);

  ws.on('close', () => clients.delete(pin!));
});

// 담당자 단말 API 호출 시
export function pushToClient(pin: string, action: object) {
  const socket = clients.get(pin);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(action));
  }
}
```

**클라이언트 앱 (React Native)**
```ts
useEffect(() => {
  const ws = new WebSocket(`wss://your-server.com/ws?pin=${userPin}`);

  ws.onmessage = (event) => {
    const { action, payload } = JSON.parse(event.data);
    if (action === 'card_issue') {
      navigation.navigate('CardIssueModal', payload);
    }
  };

  ws.onclose = () => {
    // 재연결 로직 (exponential backoff)
  };

  return () => ws.close();
}, [userPin]);
```

### 방법 B — SSE (Server-Sent Events)

서버 → 클라이언트 단방향으로 충분할 때 더 단순합니다.  
HTTP 기반이라 방화벽 친화적이고, 브라우저/앱 모두 지원합니다.

**서버 (Express)**
```ts
const sseClients = new Map<string, Response>();

app.get('/sse/:pin', (req, res) => {
  const { pin } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sseClients.set(pin, res);
  req.on('close', () => sseClients.delete(pin));
});

// 담당자 API에서 호출
function pushSSE(pin: string, data: object) {
  const client = sseClients.get(pin);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
```

**클라이언트 (React Native — react-native-sse 또는 fetch stream)**
```ts
useEffect(() => {
  const eventSource = new EventSource(`https://your-server.com/sse/${userPin}`);

  eventSource.onmessage = (event) => {
    const { action, payload } = JSON.parse(event.data);
    if (action === 'card_issue') {
      navigation.navigate('CardIssueModal', payload);
    }
  };

  return () => eventSource.close();
}, [userPin]);
```

### 방식 비교

| | Firebase onSnapshot | WebSocket | SSE |
|---|---|---|---|
| 인프라 | Firebase 필요 | 자체 서버 | 자체 서버 |
| 방향 | 양방향 | 양방향 | 서버→클라이언트 |
| 재연결 | 자동 | 직접 구현 | 자동 (브라우저) |
| 오프라인 지원 | 있음 (캐시) | 없음 | 없음 |
| 속도 | ~수백ms | ~수십ms | ~수십ms |
| 구현 난이도 | 낮음 | 중간 | 낮음 |

---

## 5. 보안 설계 — 남용 방지

이 패턴은 서버가 클라이언트 UI를 직접 조작하는 구조이기 때문에 보안 설계가 중요합니다.

### 필수 체크리스트

```
✅ PIN은 클라이언트 간 직접 전달 금지
   → 담당자 단말 → 서버 → Firestore(또는 WS 서버) → 고객 앱
   → 고객 앱은 자신의 PIN으로 구독만, 타 PIN 접근 불가

✅ 액션 유효기간 (TTL)
   → expiredAt 3분 이내가 아니면 고객 앱에서 무시
   → 서버 사이드에서도 만료 문서 자동 삭제 (Cloud Functions / cron)

✅ 1회성 처리 (consumed 상태)
   → 고객 앱이 모달 팝업과 동시에 status = 'consumed' 기록
   → 같은 액션이 두 번 실행되지 않음

✅ 담당자 인증
   → 담당자 세션 토큰 없이는 session 문서 write 불가
   → Firestore Security Rules 또는 서버 미들웨어로 강제

✅ Rate Limiting
   → 동일 담당자가 단시간 내 동일 PIN에 반복 push 차단
```

### Firestore Security Rules 예시

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId} {
      // 고객은 자신의 세션만 읽기 가능
      allow read: if request.auth.uid == resource.data.ownerUid;

      // 쓰기는 서버(Admin SDK)만 가능, 클라이언트 직접 write 금지
      allow write: if false;
    }
  }
}
```

---

## 6. FCM 푸시와의 조합 — 이중 트리거

앱이 닫혀 있을 때를 대비해 FCM과 함께 씁니다.

```
담당자가 액션 전송
    │
    ├── Firestore 업데이트 ──▶ 앱이 열려 있으면 onSnapshot으로 즉시 반응
    │
    └── FCM 푸시 발송 ─────▶ 앱이 닫혀 있으면 알림으로 앱 열기
                              → 앱 열리면 onSnapshot이 pending 액션 감지
```

클라이언트에서는 `status: 'consumed'` 체크 하나로 중복 실행이 자동 방지됩니다.

---

## 7. 실제 적용 사례 — 포인토 (Pointo)

이 문서에서 설명하는 패턴은 포인토 앱에서 **이미 운영 중**입니다.

- **기기 구성**: 관리자 폰(점주) + 고객 키오스크 태블릿
- **연결 문서**: `sessions/session_{storeCode}` (Firestore)
- **동작**:
  - 점주가 "조회" 버튼 → `mode: 'waiting'` 기록
  - 키오스크 `onSnapshot` 감지 → 전화번호 입력 화면으로 자동 전환
  - 점주가 스탬프 적립 → `users/{docId}` 업데이트
  - 키오스크 `onSnapshot` 감지 → 스탬프 수 실시간 반영 + 적립 애니메이션

관련 코드: `src/screens/client/StandbyScreen.tsx`, `src/screens/client/useDashboard.ts`

---

## 8. 요약

1. `onSnapshot` (또는 WebSocket / SSE)으로 앱이 특정 문서/채널을 **지속 리스닝**
2. 서버 또는 담당자 단말이 해당 채널에 **액션을 기록**
3. 고객 앱이 **수백ms 이내 감지**, 지정된 화면으로 자동 전환
4. 고객은 아무것도 하지 않아도 됨 — **마찰 제로**

이 패턴이 기존 SMS/QR 방식과 다른 점은 단 하나입니다.  
**누가 다음 단계를 시작하느냐** — 고객이 아니라 시스템이 합니다.
