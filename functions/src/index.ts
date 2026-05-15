import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions";
import {initializeApp} from "firebase-admin/app";
import * as nodemailer from "nodemailer";
import {defineString} from "firebase-functions/params";

initializeApp();

const ADMIN_EMAIL = "thewoowon@gmail.com";
const gmailEmail = defineString("GMAIL_EMAIL");
const gmailPassword = defineString("GMAIL_PASSWORD");

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
