import { Platform, StyleSheet, Text, View } from "react-native";

// 【診断モード】ネイティブ起動クラッシュ切り分け用の最小画面。
// これが表示されれば RN 0.79.6 + Expo SDK 53 のコアはこの端末で動作している。
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Be:note 起動診断</Text>
      <Text style={styles.line}>OK: React Native が起動しました</Text>
      <Text style={styles.line}>OS: {Platform.OS}</Text>
      <Text style={styles.line}>API Level: {String(Platform.Version)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#4f46e5", marginBottom: 16 },
  line: { fontSize: 15, color: "#1e293b", marginBottom: 8 },
});
