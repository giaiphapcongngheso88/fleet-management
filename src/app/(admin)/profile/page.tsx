import ChangePasswordForm from "@/components/users/ChangePasswordForm";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Hồ sơ cá nhân</h3>
      <ChangePasswordForm />
    </div>
  );
}
