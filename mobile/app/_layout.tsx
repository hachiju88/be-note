import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";

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
    <AuthProvider>
      <RootGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </RootGuard>
    </AuthProvider>
  );
}
