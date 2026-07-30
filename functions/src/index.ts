import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import appleSignin from "apple-signin-auth";
import {defineString, defineSecret} from "firebase-functions/params";

initializeApp();

const REGION = "asia-northeast3";
/** 탈퇴 유예 기간(일). 이 기간이 지나면 스케줄러가 실삭제한다. */
const GRACE_DAYS = 30;

const ADMIN_EMAIL = "thewoowon@gmail.com";
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

    const subject = `[포인토] 새 카페 등록 신청: ${storeName}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #D4845A; margin-bottom: 4px;">새 카페가 등록되었습니다</h2>
        <p style="color: #73777B; font-size: 14px; margin-top: 0;">승인 대기 중인 스토어가 있습니다.</p>

        <div style="background: #F6F6F8; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #73777B; font-size: 14px;">카페 이름</td>
              <td style="padding: 8px 0; color: #191D2B; font-weight: 600;">${storeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #73777B; font-size: 14px;">스토어 코드</td>
              <td style="padding: 8px 0; color: #D4845A; font-weight: 600; font-family: monospace;">${storeCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #73777B; font-size: 14px;">점주 연락처</td>
              <td style="padding: 8px 0; color: #191D2B;">${ownerPhone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #73777B; font-size: 14px;">등록 시간</td>
              <td style="padding: 8px 0; color: #191D2B;">${new Date(createdAt).toLocaleString("ko-KR", {timeZone: "Asia/Seoul"})}</td>
            </tr>
          </table>
        </div>

        <p style="color: #73777B; font-size: 13px;">
          Firebase Console에서 해당 스토어의 status를 'approved'로 변경하여 승인하세요.
        </p>

        <a href="https://console.firebase.google.com/project/kbffee-a365e/firestore/databases/-default-/data/~2Fstores~2F${storeCode}"
           style="display: inline-block; background: #D4845A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          Firebase Console에서 확인
        </a>
      </div>
    `;

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"포인토 알림" <${ADMIN_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject,
        html,
      });
      logger.info(`Store registration email sent for ${storeCode}`);
    } catch (error) {
      logger.error("Failed to send email:", error);
    }
  },
);

// ─── 점주 계정 삭제 (Apple 토큰 저장 + 30일 유예 후 실삭제) ─────────────────

/**
 * Apple 로그인 직후 클라이언트가 호출. authorizationCode를 refresh token으로
 * 교환해 ownerTokens/{uid}에 저장한다. (탈퇴 시점에 이 토큰으로 revoke)
 * identityToken의 sub == uid 검증으로 계정 소유 확인.
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
      const {uid, authorizationCode, identityToken} = req.body ?? {};
      if (!uid || !authorizationCode || !identityToken) {
        res.status(400).json({error: "missing params"});
        return;
      }

      // 신원 검증 — identityToken의 sub가 uid와 일치해야 함
      const claims = await appleSignin.verifyIdToken(identityToken, {
        audience: APPLE_CLIENT_ID.value(),
      });
      if (claims.sub !== uid) {
        res.status(403).json({error: "uid mismatch"});
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
