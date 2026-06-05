import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { apiFetch, toJstDatetime } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type DmMessage = {
  note_id: string;
  text: string;
  is_client: boolean;
  creation_datetime: string;
};

type HeadNote = {
  note_id: string;
  creation_datetime: string;
  children: { note_id: string; note_type: string }[];
};

export default function DmScreen() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [headNoteId, setHeadNoteId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("t_client")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("delete_flg", false)
      .maybeSingle()
      .then(({ data }) => { if (active) setClientId(data?.client_id ?? null); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 最新の head ノードを取得し、そのテキスト children を DM として表示する
        const res = await apiFetch(
          `/api/v1/clients/${clientId}/notes?future_flg=false&per_page=1`
        );
        if (!res.ok) throw new Error("データの取得に失敗しました。");
        const json = await res.json();
        const heads: HeadNote[] = json.data ?? [];
        if (heads.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }
        const latestHead = heads[0];
        if (!cancelled) setHeadNoteId(latestHead.note_id);

        const textChildren = latestHead.children
          .filter((c) => c.note_type === "text")
          .map((c) => c.note_id);

        const details = await Promise.all(
          textChildren.slice(-20).map((noteId) =>
            apiFetch(`/api/v1/clients/${clientId}/notes/${noteId}`)
              .then((r) => r.json())
              .then((j) => ({ note_id: noteId, ...j.data } as DmMessage))
              .catch(() => null)
          )
        );
        if (!cancelled) {
          setMessages(
            details
              .filter((d): d is DmMessage => !!d)
              .sort((a, b) =>
                a.creation_datetime < b.creation_datetime ? -1 : 1
              )
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function sendMessage() {
    if (!text.trim() || !clientId || !headNoteId) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/v1/clients/${clientId}/notes`, {
        method: "POST",
        body: JSON.stringify({
          note_type: "text",
          p_note_id: headNoteId,
          text: text.trim(),
          is_client: true,
        }),
      });
      if (!res.ok) throw new Error("送信失敗");
      const { data } = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          note_id: data.note_id,
          text: text.trim(),
          is_client: true,
          creation_datetime: new Date().toISOString(),
        },
      ]);
      setText("");
    } catch {
      setError("送信に失敗しました。");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DM（交換ノート）</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.note_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>メッセージはありません。</Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.is_client ? styles.bubbleClient : styles.bubbleStaff,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                item.is_client ? styles.bubbleTextClient : styles.bubbleTextStaff,
              ]}
            >
              {item.text}
            </Text>
            <Text
              style={[
                styles.bubbleTime,
                item.is_client ? styles.bubbleTimeClient : styles.bubbleTimeStaff,
              ]}
            >
              {toJstDatetime(item.creation_datetime).slice(5, 11)}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="メッセージを入力…"
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
        >
          <Text style={styles.sendBtnText}>{sending ? "…" : "送信"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  errorBox: {
    margin: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
    fontSize: 14,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  bubbleClient: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
  },
  bubbleStaff: {
    alignSelf: "flex-end",
    backgroundColor: "#4f46e5",
  },
  bubbleText: { fontSize: 14 },
  bubbleTextClient: { color: "#1e293b" },
  bubbleTextStaff: { color: "#fff" },
  bubbleTime: { fontSize: 11 },
  bubbleTimeClient: { color: "#94a3b8" },
  bubbleTimeStaff: { color: "#c7d2fe" },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: "#f8fafc",
  },
  sendBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontWeight: "600" },
});
