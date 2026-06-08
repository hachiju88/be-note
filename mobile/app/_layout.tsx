import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import React, { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

// JS 例外をすべてキャッチして Alert に出す（デバッグ用）
if (typeof ErrorUtils !== "undefined") {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    Alert.alert(
      isFatal ? "Fatal JS Error" : "JS Error",
      `${error?.message ?? String(error)}\n\n${(error?.stack ?? "").slice(0, 600)}`,
    );
    prev?.(error, isFatal);
  });
}

type EBState = { error: Error | null };
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <ScrollView contentContainerStyle={styles.errContainer}>
          <Text style={styles.errTitle}>レンダリングエラー</Text>
          <Text style={styles.errMsg}>{error.message}</Text>
          <Text style={styles.errStack}>{error.stack?.slice(0, 800)}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function RootGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && inAuth) {
      router.replace("/(app)/be_note");
    }
  }, [session, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RootGuard>
            <Stack screenOptions={{ headerShown: false }} />
          </RootGuard>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errContainer: { flexGrow: 1, padding: 24, backgroundColor: "#fff0f0" },
  errTitle: { fontSize: 18, fontWeight: "700", color: "#dc2626", marginBottom: 12 },
  errMsg: { fontSize: 14, color: "#1e293b", marginBottom: 16 },
  errStack: { fontSize: 11, color: "#475569", fontFamily: "monospace" },
});
