import { FirebaseError } from "firebase/app";

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Email không hợp lệ",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng",
  "auth/user-disabled": "Tài khoản đã bị khóa",
  "auth/too-many-requests": "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau",
  "auth/email-already-in-use": "Email này đã được sử dụng",
  "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự)",
  "permission-denied": "Bạn không có quyền thực hiện thao tác này",
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return FIREBASE_AUTH_MESSAGES[err.code] || err.message || "Có lỗi xảy ra";
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return "Có lỗi không xác định";
}
