import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function LoginPage() {
  return (
    <ScreenPlaceholder
      title="ログイン"
      url="/login"
      role="未認証"
      description="Be:note独自（メール＋パスワード） / Google / Instagram。LINE はフェーズ2。"
      apis={["Supabase Auth"]}
    />
  );
}
