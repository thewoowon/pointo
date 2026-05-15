"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onStoreCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const nodemailer = __importStar(require("nodemailer"));
const params_1 = require("firebase-functions/params");
(0, app_1.initializeApp)();
const ADMIN_EMAIL = "thewoowon@gmail.com";
const gmailEmail = (0, params_1.defineString)("GMAIL_EMAIL");
const gmailPassword = (0, params_1.defineString)("GMAIL_PASSWORD");
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
exports.onStoreCreated = (0, firestore_1.onDocumentCreated)({ document: "stores/{storeCode}", region: "asia-northeast3" }, async (event) => {
    var _a;
    const storeCode = event.params.storeCode;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
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
              <td style="padding: 8px 0; color: #191D2B;">${new Date(createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
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
        firebase_functions_1.logger.info(`Store registration email sent for ${storeCode}`);
    }
    catch (error) {
        firebase_functions_1.logger.error("Failed to send email:", error);
    }
});
//# sourceMappingURL=index.js.map