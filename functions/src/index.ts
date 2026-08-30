import {onDocumentCreated, onDocumentDeleted} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import appleSignin from "apple-signin-auth";
import {defineString, defineSecret} from "firebase-functions/params";

initializeApp();

const REGION = "asia-northeast3";
/** 탈퇴 유예 기간(일). 이 기간이 지나면 스케줄러가 실삭제한다. */
const GRACE_DAYS = 30;

/** 내부 알림 수신자. 여기에 주소를 추가하면 모든 관리 알림이 함께 나간다. */
const NOTIFY_EMAILS = ["thewoowon@gmail.com", "yebbi58@gmail.com"];
const gmailEmail = defineString("GMAIL_EMAIL");
const gmailPassword = defineString("GMAIL_PASSWORD");

// ─── Sign in with Apple 자격증명 (계정 삭제 시 토큰 revoke용) ──────────────
// 네이티브 앱은 client_id = 앱 번들 식별자.
const APPLE_CLIENT_ID = defineString("APPLE_CLIENT_ID");
const APPLE_TEAM_ID = defineSecret("APPLE_TEAM_ID");
const APPLE_KEY_ID = defineSecret("APPLE_KEY_ID");
const APPLE_PRIVATE_KEY = defineSecret("APPLE_PRIVATE_KEY");

/** .p8 키로 서명한 Apple client_secret(JWT) 생성. */
function appleClientSecret(): string {
  // Secret Manager에 저장 과정에서 개행이 escape(\n)될 수 있어 실제 개행으로 복원.
  const privateKey = APPLE_PRIVATE_KEY.value().replace(/\\n/g, "\n");
  return appleSignin.getClientSecret({
    clientID: APPLE_CLIENT_ID.value(),
    teamID: APPLE_TEAM_ID.value(),
    privateKey,
    keyIdentifier: APPLE_KEY_ID.value(),
  });
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailEmail.value(),
      pass: gmailPassword.value(),
    },
  });
}

/**
 * 내부 알림 메일 발송. 실패해도 트리거를 실패시키지 않는다(알림은 부가 기능).
 *
 * 발신 주소는 반드시 인증 계정과 같아야 한다. Gmail SMTP는 별칭으로 등록되지
 * 않은 from을 인증 계정 주소로 조용히 바꿔 쓰기 때문에, 상수로 박아두면
 * 계정을 옮겼을 때 실제 발신자와 어긋난다.
 */
async function sendNotice(
  subject: string,
  html: string,
  tag: string,
  replyTo?: string,
) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"포인토 알림" <${gmailEmail.value()}>`,
      to: NOTIFY_EMAILS.join(", "),
      subject,
      html,
      // 의견처럼 사람이 보낸 알림은 받은 메일에서 바로 답장이 되어야 한다.
      // 여기가 비면 답장이 우리 발신 계정으로 되돌아온다.
      ...(replyTo ? {replyTo} : {}),
    });
    logger.info(`Notice email sent: ${tag} → ${NOTIFY_EMAILS.length}명`);
  } catch (error) {
    logger.error(`Failed to send notice email (${tag}):`, error);
  }
}

/**
 * 사람이 쓴 자유 텍스트를 메일 HTML에 넣기 전에 무해화한다.
 *
 * 매장 이름처럼 우리가 형식을 아는 값과 달리, 의견 본문에는 `<`나 `&`가 그냥
 * 들어온다. 이스케이프하지 않으면 본문 일부가 태그로 먹혀 사라지고(최악의 경우
 * 메일 레이아웃이 통째로 깨진다), 정작 읽어야 할 내용을 못 읽는다.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 알림 메일 공통 레이아웃 */
function noticeHtml(opts: {
  title: string;
  lead: string;
  rows: {label: string; value: string; accent?: boolean}[];
  /** 사람이 쓴 원문. 줄바꿈을 살려 인용 블록으로 보여준다 (이스케이프는 호출자 책임) */
  quote?: string;
  footer?: string;
  cta?: {label: string; href: string};
}): string {
  const rows = opts.rows
    .map(
      (r) => `
            <tr>
              <td style="padding: 8px 0; color: #73777B; font-size: 14px;">${r.label}</td>
              <td style="padding: 8px 0; color: ${r.accent ? "#D4845A" : "#191D2B"}; font-weight: 600;${r.accent ? " font-family: monospace;" : ""}">${r.value}</td>
            </tr>`,
    )
    .join("");

  return `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #D4845A; margin-bottom: 4px;">${opts.title}</h2>
        <p style="color: #73777B; font-size: 14px; margin-top: 0;">${opts.lead}</p>

        <div style="background: #F6F6F8; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">${rows}
          </table>
        </div>
${opts.quote ? `
        <div style="border-left: 3px solid #D4845A; padding: 4px 0 4px 16px; margin: 20px 0; color: #191D2B; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${opts.quote}</div>
` : ""}${opts.footer ? `
        <p style="color: #73777B; font-size: 13px;">${opts.footer}</p>
` : ""}${opts.cta ? `
        <a href="${opts.cta.href}"
           style="display: inline-block; background: #D4845A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          ${opts.cta.label}
        </a>
` : ""}      </div>
    `;
}

/** ISO 문자열을 한국 시간 표기로 */
function formatKst(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {timeZone: "Asia/Seoul"});
}

// 신규 스토어 등록 시 이메일 알림
export const onStoreCreated = onDocumentCreated(
  {document: "stores/{storeCode}", region: "asia-northeast3"},
  async (event) => {
    const storeCode = event.params.storeCode;
    const data = event.data?.data();

    if (!data) return;

    const storeName = data.name || "(이름 없음)";
    const ownerPhone = data.ownerPhone || "(번호 없음)";
    const createdAt = data.createdAt || new Date().toISOString();

    const html = noticeHtml({
      title: "새 매장이 등록되었습니다",
      lead: "점주가 앱에서 매장을 만들었습니다.",
      rows: [
        {label: "매장 이름", value: storeName},
        {label: "매장 코드", value: storeCode, accent: true},
        {label: "점주 연락처", value: ownerPhone},
        {label: "등록 시간", value: formatKst(createdAt)},
      ],
      cta: {
        label: "Firebase Console에서 확인",
        href: `https://console.firebase.google.com/project/kbffee-a365e/firestore/databases/-default-/data/~2Fstores~2F${storeCode}`,
      },
    });

    await sendNotice(
      `[포인토] 새 매장 등록: ${storeName}`,
      html,
      `store:${storeCode}`,
    );
  },
);

// ─── 점주 계정 가입 알림 ───────────────────────────────────────────────────

/**
 * owners/{uid} 문서가 생기면(= 구글/애플로 새 점주 계정이 만들어지면) 알린다.
 *
 * 주의: 레거시 계정을 Firebase uid로 옮기는 마이그레이션도 owners 문서를 새로
 * 만든다(migrateLegacyOwner). 그건 신규 가입이 아니므로 legacyUid가 실려 있으면
 * 건너뛴다. 안 그러면 구버전 점주가 재로그인할 때마다 가입 알림이 온다.
 */
export const onOwnerCreated = onDocumentCreated(
  {document: "owners/{uid}", region: REGION},
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data) return;

    if (data.legacyUid) {
      logger.info(`onOwnerCreated: ${uid} — 레거시 계정 이전이라 알림 생략`);
      return;
    }

    const email = data.email || "(이메일 없음)";
    const createdAt = data.createdAt || new Date().toISOString();

    // 로그인 수단은 owners 문서에 없다. Auth 쪽이 원본이라 거기서 읽는다.
    let provider = "(확인 불가)";
    try {
      const user = await getAuth().getUser(uid);
      const ids = user.providerData.map((p) => p.providerId);
      provider = ids
        .map((id) =>
          id === "google.com" ? "구글" : id === "apple.com" ? "Apple" : id,
        )
        .join(", ") || "(없음)";
    } catch (e) {
      logger.warn(`onOwnerCreated: ${uid} 제공자 조회 실패`, e);
    }

    const html = noticeHtml({
      title: "새 점주 계정이 생겼습니다",
      lead: "이메일로 가입한 점주입니다. 아직 매장은 없을 수 있어요.",
      rows: [
        {label: "이메일", value: email},
        {label: "로그인", value: provider},
        {label: "가입 시간", value: formatKst(createdAt)},
        {label: "계정 uid", value: uid, accent: true},
      ],
      footer: "매장을 만들면 '새 매장 등록' 알림이 따로 옵니다.",
    });

    await sendNotice(`[포인토] 새 점주 가입: ${email}`, html, `owner:${uid}`);
  },
);

// ─── 의견 보내기 알림 ─────────────────────────────────────────────────────

/**
 * feedback 문서가 생기면 의견 원문을 메일로 보낸다.
 *
 * 규칙에서 feedback 조회를 전면 차단했기 때문에(본문에 매장 사정이 그대로 담긴다),
 * 콘솔을 직접 열지 않으면 의견이 들어온 사실조차 알 수 없다. 그런데 의견은
 * "언젠가 확인하면 되는 것"이 아니라 답이 늦으면 그대로 이탈하는 신호라서,
 * 도착 즉시 우리 쪽으로 밀어 올린다.
 *
 * 답장은 점주에게 바로 가야 하므로 Reply-To에 점주 이메일을 싣는다. 주소는
 * 문서에 실려온 값이 아니라 Auth에서 읽는다 — 문서 필드는 클라이언트가 쓰는
 * 값이라 위조가 가능하고, 그러면 우리 답장이 엉뚱한 곳으로 간다.
 */
export const onOpinionCreated = onDocumentCreated(
  {document: "feedback/{docId}", region: REGION},
  async (event) => {
    const docId = event.params.docId;
    const data = event.data?.data();
    if (!data) return;

    const text = String(data.text ?? "").trim();
    if (!text) return;

    const uid = String(data.ownerUid ?? "");
    let email = data.ownerEmail || "(이메일 없음)";
    if (uid) {
      try {
        const user = await getAuth().getUser(uid);
        if (user.email) email = user.email;
      } catch (e) {
        logger.warn(`onOpinionCreated: ${uid} 계정 조회 실패`, e);
      }
    }

    // serverTimestamp는 Admin SDK에서 Timestamp로 온다. 트리거가 다시 돌 때를
    // 대비해 값이 없으면 현재 시각으로 채운다.
    const createdAt: string =
      data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString();

    const device = [data.platform, data.osVersion].filter(Boolean).join(" ");
    // 제목에는 첫 줄만. 본문 전체를 넣으면 받은편지함에서 목록이 무너진다.
    const summary = text.split("\n")[0].slice(0, 30);

    const html = noticeHtml({
      title: "점주가 의견을 보냈습니다",
      lead: "'찾으시는 기능이 없으신가요?'로 들어온 의견입니다.",
      rows: [
        {label: "보낸 사람", value: email},
        {label: "앱 버전", value: data.appVersion || "(확인 불가)"},
        {label: "기기", value: device || "(확인 불가)"},
        {label: "보낸 시간", value: formatKst(createdAt)},
      ],
      quote: escapeHtml(text),
      footer: "이 메일에 그대로 답장하면 점주에게 바로 갑니다.",
      cta: {
        label: "Firebase Console에서 확인",
        href: `https://console.firebase.google.com/project/kbffee-a365e/firestore/databases/-default-/data/~2Ffeedback~2F${docId}`,
      },
    });

    await sendNotice(
      `[포인토] 의견 도착: ${summary}${text.length > 30 ? "…" : ""}`,
      html,
      `opinion:${docId}`,
      typeof email === "string" && email.includes("@") ? email : undefined,
    );
  },
);

// ─── 고객 탈퇴 후처리 ──────────────────────────────────────────────────────

/**
 * 고객 문서가 삭제되면 그 사람의 적립 이력(logs)을 정리한다.
 *
 * 원래 키오스크가 직접 지웠지만, 그러려면 클라이언트에 logs 목록 조회 권한이
 * 필요하다. 보안 규칙은 쿼리의 where 조건을 검사할 수 없어서 "내 로그만"으로
 * 좁힐 방법이 없고, 결국 매장 전체 로그(= 전화번호 전량)가 열린다.
 * 그래서 삭제 트리거로 서버가 대신 처리한다.
 *
 * 문서 ID는 `{전화번호}_{매장코드}` 또는 레거시 `{전화번호}` 형태다.
 */
export const onUserDeleted = onDocumentDeleted(
  {document: "users/{docId}", region: REGION},
  async (event) => {
    const docId = event.params.docId;
    const separator = docId.indexOf("_");
    const phone = separator === -1 ? docId : docId.slice(0, separator);
    const storeCode = event.data?.data()?.store_code as string | undefined;

    // 매장을 모르면 아무것도 지우지 않는다.
    // 같은 전화번호가 여러 매장에 존재할 수 있어서, 매장으로 좁히지 않으면
    // 남의 매장 이력까지 지운다. store_code가 없는 레거시/고아 문서가 실제로
    // 있으므로(2026-08 기준 2건) 가정이 아니라 실재하는 경로다.
    if (!storeCode) {
      logger.warn(
        `onUserDeleted: ${docId} — store_code가 없어 로그 정리를 건너뜁니다. ` +
          "필요하면 매장을 특정해 수동으로 정리할 것.",
      );
      return;
    }

    const db = getFirestore();
    const query = db
      .collection("logs")
      .where("phone_number", "==", phone)
      .where("store_code", "==", storeCode);

    try {
      const snapshot = await query.get();
      if (snapshot.empty) {
        logger.info(`onUserDeleted: ${docId} — 정리할 로그 없음`);
        return;
      }

      const BATCH_SIZE = 500;
      for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      logger.info(
        `onUserDeleted: ${docId} — 로그 ${snapshot.size}건 삭제`,
      );
    } catch (e) {
      logger.error(`onUserDeleted failed for ${docId}:`, e);
    }
  },
);

// ─── 점주 계정 삭제 (Apple 토큰 저장 + 30일 유예 후 실삭제) ─────────────────

/**
 * Apple 로그인 직후 클라이언트가 호출. authorizationCode를 refresh token으로
 * 교환해 ownerTokens/{uid}에 저장한다. (탈퇴 시점에 이 토큰으로 revoke)
 *
 * uid는 요청 본문이 아니라 **Firebase ID 토큰**에서 뽑는다. 본문으로 받으면
 * 호출자가 임의의 uid를 주장할 수 있고, 실제로 Firestore가 이제 Firebase uid로
 * 소유권을 판정하므로 키도 Firebase uid여야 한다.
 * 추가로 identityToken이 그 계정의 애플 신원과 일치하는지도 확인한다.
 */
export const registerAppleToken = onRequest(
  {
    region: REGION,
    secrets: [APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY],
    cors: true,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      const authHeader = req.get("Authorization") ?? "";
      const bearer = authHeader.startsWith("Bearer ") ?
        authHeader.slice(7) :
        "";
      if (!bearer) {
        res.status(401).json({error: "missing firebase id token"});
        return;
      }

      let uid: string;
      let appleSubFromFirebase: string | undefined;
      try {
        const decoded = await getAuth().verifyIdToken(bearer);
        uid = decoded.uid;
        appleSubFromFirebase = (
          decoded.firebase?.identities?.["apple.com"] as string[] | undefined
        )?.[0];
      } catch {
        res.status(401).json({error: "invalid firebase id token"});
        return;
      }

      const {authorizationCode, identityToken} = req.body ?? {};
      if (!authorizationCode || !identityToken) {
        res.status(400).json({error: "missing params"});
        return;
      }

      // 애플 신원 검증 — identityToken의 sub가 이 Firebase 계정에 연결된
      // 애플 계정과 같아야 한다. (남의 authorizationCode를 자기 uid로 저장 방지)
      const claims = await appleSignin.verifyIdToken(identityToken, {
        audience: APPLE_CLIENT_ID.value(),
      });
      if (appleSubFromFirebase && claims.sub !== appleSubFromFirebase) {
        res.status(403).json({error: "apple identity mismatch"});
        return;
      }

      const tokens = await appleSignin.getAuthorizationToken(
        authorizationCode,
        {
          clientID: APPLE_CLIENT_ID.value(),
          clientSecret: appleClientSecret(),
          // 네이티브 앱 code 교환은 redirect_uri가 없음 — 빈 값으로 전달
          redirectUri: "",
        },
      );
      if (!tokens.refresh_token) {
        res.status(502).json({error: "no refresh token"});
        return;
      }

      await getFirestore().doc(`ownerTokens/${uid}`).set(
        {
          appleRefreshToken: tokens.refresh_token,
          provider: "apple",
          updatedAt: new Date().toISOString(),
        },
        {merge: true},
      );
      res.json({ok: true});
    } catch (e) {
      logger.error("registerAppleToken failed:", e);
      res.status(500).json({error: "internal"});
    }
  },
);

/**
 * 매일 실행. 탈퇴 유예(30일)가 지난 점주 계정을 실삭제한다.
 *   1) Apple refresh token revoke
 *   2) 소유 매장의 ownerId 해제 (매장·고객 데이터는 보존 — 재클레임 가능)
 *   3) owners/{uid}, ownerTokens/{uid} 문서 삭제
 */
export const purgeDeletedOwners = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "Asia/Seoul",
    region: REGION,
    secrets: [APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY],
  },
  async () => {
    const db = getFirestore();
    const cutoff = new Date(
      Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 복합 인덱스 회피: accountStatus만 쿼리하고 deletedAt은 코드에서 필터
    const snap = await db
      .collection("owners")
      .where("accountStatus", "==", "pending_deletion")
      .get();
    const due = snap.docs.filter((d) => (d.data().deletedAt ?? "") <= cutoff);

    if (due.length === 0) {
      logger.info("purgeDeletedOwners: nothing due");
      return;
    }

    for (const docSnap of due) {
      const uid = docSnap.id;
      const owner = docSnap.data();
      try {
        // 1) Apple 토큰 revoke
        const tokRef = db.doc(`ownerTokens/${uid}`);
        const tok = await tokRef.get();
        const refreshToken = tok.exists ?
          (tok.data()?.appleRefreshToken as string | undefined) :
          undefined;
        if (refreshToken) {
          await appleSignin.revokeAuthorizationToken(refreshToken, {
            clientID: APPLE_CLIENT_ID.value(),
            clientSecret: appleClientSecret(),
            tokenTypeHint: "refresh_token",
          });
        }

        // 2) 매장 소유 해제 (존재하지 않는 매장은 건너뜀)
        const codes: string[] = owner?.storeCodes ?? [];
        for (const code of codes) {
          try {
            await db.doc(`stores/${code}`).update({
              ownerId: FieldValue.delete(),
            });
          } catch (e) {
            logger.warn(`unlink store ${code} failed:`, e);
          }
        }

        // 3) 계정/토큰 문서 삭제
        await docSnap.ref.delete();
        if (tok.exists) await tokRef.delete();

        logger.info(
          `purged owner ${uid} (unlinked ${codes.length} stores)`,
        );
      } catch (e) {
        logger.error(`purge failed for owner ${uid}:`, e);
      }
    }
  },
);
