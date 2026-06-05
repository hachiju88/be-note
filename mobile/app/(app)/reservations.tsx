import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { apiFetch, toJstDatetime, generateUuid } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/reservationStatus";

type Reservation = {
  note_id: string;
  reservation_start: string;
  reservation_end: string;
  main_menu: string;
  status: string;
  staff: { staff_id: string; staff_name: string | null } | null;
};

type HeadNote = {
  note_id: string;
  children: { note_id: string; note_type: string; reservation_start?: string; main_menu?: string; status?: string }[];
};

type MenuMaster = {
  menu_master_id: string;
  menu_name: string;
  base_price: number;
  duration_minutes: number;
};

/** "YYYY-MM-DD HH:MM" 形式（JST）を UTC ISO 文字列に変換する。 */
function parseJstToIso(jstStr: string): string | null {
  const m = jstStr.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00+09:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function ReservationsScreen() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [menuMasters, setMenuMasters] = useState<MenuMaster[]>([]);
  const [reqMenuId, setReqMenuId] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // 予約一覧
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/v1/clients/${clientId}/notes?per_page=30`
        );
        if (!res.ok) throw new Error("予約の取得に失敗しました。");
        const json = await res.json();
        const heads: HeadNote[] = json.data ?? [];
        const resList: Reservation[] = heads
          .flatMap((h) =>
            h.children
              .filter((c) => c.note_type === "reservation")
              .map((c) => ({
                note_id: c.note_id,
                reservation_start: c.reservation_start ?? "",
                reservation_end: "",
                main_menu: c.main_menu ?? "",
                status: c.status ?? "",
                staff: null,
              }))
          )
          .sort((a, b) =>
            a.reservation_start < b.reservation_start ? 1 : -1
          );
        if (!cancelled) setReservations(resList);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  // リクエストフォームを開いたときにメニュー一覧を取得
  useEffect(() => {
    if (!showRequest || menuMasters.length > 0) return;
    let cancelled = false;
    apiFetch("/api/v1/menus")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setMenuMasters(j.data ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showRequest, menuMasters.length]);

  async function handleCancel(noteId: string) {
    Alert.alert("キャンセル確認", "この予約をキャンセルしますか？", [
      { text: "戻る", style: "cancel" },
      {
        text: "キャンセルする",
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(
            `/api/v1/reservations/${noteId}/status`,
            {
              method: "PATCH",
              body: JSON.stringify({ status: "cancelled" }),
            }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            Alert.alert(
              "エラー",
              body?.error?.message ?? "キャンセルに失敗しました。"
            );
          } else {
            setRefreshKey((k) => k + 1);
          }
        },
      },
    ]);
  }

  async function handleRequest() {
    if (!reqMenuId) {
      Alert.alert("入力エラー", "メニューを選択してください。");
      return;
    }
    const desiredStart = parseJstToIso(reqDate);
    if (!desiredStart) {
      Alert.alert("入力エラー", "日時は「YYYY-MM-DD HH:MM」形式で入力してください。\n例: 2026-07-10 11:00");
      return;
    }
    setReqLoading(true);
    try {
      const res = await apiFetch("/api/v1/reservation-requests", {
        method: "POST",
        headers: { "Idempotency-Key": generateUuid() },
        body: JSON.stringify({
          menu_master_id: reqMenuId,
          desired_start: desiredStart,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "申込に失敗しました。");
      }
      setReqMenuId("");
      setReqDate("");
      setShowRequest(false);
      Alert.alert("申込完了", "リクエスト予約を申し込みました。");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      Alert.alert("エラー", e instanceof Error ? e.message : "申込に失敗しました。");
    } finally {
      setReqLoading(false);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>予約</Text>
        <TouchableOpacity
          onPress={() => setShowRequest((v) => !v)}
          style={styles.requestBtn}
        >
          <Text style={styles.requestBtnText}>
            {showRequest ? "閉じる" : "予約リクエスト"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* リクエストフォーム */}
      {showRequest && (
        <View style={styles.requestForm}>
          <Text style={styles.formLabel}>メニューを選択</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.menuScroll}>
            {menuMasters.map((m) => (
              <TouchableOpacity
                key={m.menu_master_id}
                onPress={() => setReqMenuId(m.menu_master_id)}
                style={[
                  styles.menuChip,
                  reqMenuId === m.menu_master_id && styles.menuChipActive,
                ]}
              >
                <Text style={[
                  styles.menuChipText,
                  reqMenuId === m.menu_master_id && styles.menuChipTextActive,
                ]}>
                  {m.menu_name}
                </Text>
                <Text style={[
                  styles.menuChipPrice,
                  reqMenuId === m.menu_master_id && styles.menuChipTextActive,
                ]}>
                  ¥{m.base_price.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
            {menuMasters.length === 0 && (
              <Text style={styles.menuEmptyText}>メニューを読み込み中…</Text>
            )}
          </ScrollView>

          <Text style={styles.formLabel}>ご希望日時（JST）</Text>
          <TextInput
            style={styles.input}
            placeholder="例: 2026-07-10 11:00"
            value={reqDate}
            onChangeText={setReqDate}
            keyboardType="numeric"
          />
          <TouchableOpacity
            onPress={handleRequest}
            disabled={reqLoading || !reqMenuId}
            style={[styles.submitBtn, (reqLoading || !reqMenuId) && styles.submitBtnDisabled]}
          >
            <Text style={styles.submitBtnText}>
              {reqLoading ? "申込中…" : "申し込む"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={reservations}
        keyExtractor={(item) => item.note_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>予約はありません。</Text>
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.status] ?? STATUS_COLOR.default;
          const canCancel = ["confirmed", "requested", "pending"].includes(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dateText}>
                  {item.reservation_start
                    ? toJstDatetime(item.reservation_start)
                    : "—"}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
                  <Text style={[styles.statusText, { color }]}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.menuText}>{item.main_menu}</Text>
              {canCancel && (
                <TouchableOpacity
                  onPress={() => handleCancel(item.note_id)}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>キャンセル</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  requestBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  requestBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  requestForm: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  formLabel: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  menuScroll: { marginBottom: 4 },
  menuChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    minWidth: 80,
  },
  menuChipActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#eef2ff",
  },
  menuChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  menuChipTextActive: { color: "#4f46e5", fontWeight: "700" },
  menuChipPrice: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  menuEmptyText: { fontSize: 13, color: "#94a3b8", alignSelf: "center", paddingVertical: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#f8fafc",
  },
  submitBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  errorBox: {
    margin: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { fontSize: 13, color: "#64748b" },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },
  menuText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  cancelBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  cancelBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
});
