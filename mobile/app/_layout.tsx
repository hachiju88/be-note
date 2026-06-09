import { Stack } from "expo-router";

// 【診断モード】ネイティブ起動クラッシュの切り分け用に最小構成へ一時変更中。
// Supabase / AuthProvider / GestureHandler / ナビゲーションガードを全て外している。
// 原因特定後に元の実装（git 履歴）へ復元すること。
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
