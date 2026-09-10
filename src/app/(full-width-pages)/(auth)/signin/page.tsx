import SignInForm from "@/components/auth/sign-in-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập | Đại Phát",
  description: "Đăng nhập hệ thống quản lý vận tải Đại Phát",
};

export default function SignIn() {
  return <SignInForm />;
}
