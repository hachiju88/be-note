import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { apiFetch, toJstDatetime } from "@/lib/apiFetch";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type ClientInfo = {
  client_id: string;
  client_name: string;
  salon_info: { client_rank: string | null; total_visit: number | null } | null;
};

type ReservationChild = {
  note_id: string;
  note_type: "reservation";
  reservation_start: string;
  main_menu: string;
  status: string;
  total: number | null;
};

type OtherChild = { note_id: string; note_type: string };

type HeadNote = {
  note_id: string;
  responsible: { staff_id: string; staff_name: string | null };
  creation_datetime: string;
  children: (ReservationChild | OtherChild)[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  confirmed: "予約済",
  checked_in: "来店",
  in_progress: "施術中",
  done: "会計済",
  cancelled: "キャンセル",
};

export default function BeNoteScreen() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [headNotes, setHeadNotes] = useState<HeadNote[]>([]);
  const [selectedHead, setSelectedHead] = useState<HeadNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // customer の client_id を t_client から取得
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("t_client")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("delete_flg", false)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setClientId(data?.client_id ?? null);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [clientRes, notesRes] = await Promise.all([
          apiFetch(`/api/v1/clients/${clientId}`),
          apiFetch(`/api/v1/clients/${clientId}/notes?future_flg=false&per_page=20`),
        ]);
        if (cancelled) return;
        if (clientRes.ok) {
          const j = await clientRes.json();
          if (!cancelled) setClientInfo(j.data ?? null);
        }
        if (notesRes.ok) {
          const j = await notesRes.json();
          const rows: HeadNote[] = j.data ?? [];
          if (!cancelled) {
            setHeadNotes(rows);
            if (rows.length > 0) setSelectedHead(rows[0]);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "データの取得に失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4f46e5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => setRefreshKey((k) => k + 1)} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!clientId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>顧客情報が見つかりません。</Text>
      </View>
    );
  }

  const resChild = selectedHead
    ? (selectedHead.children as (ReservationChild | OtherChild)[]).find(
        (c): c is ReservationChild => c.note_type === "reservation"
      )
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ヘッダ */}
      <View style={styles.card}>
        <Text style={styles.clientName}>
          {clientInfo?.client_name ?? "（不明）"} 様
        </Text>
        <View style={styles.row}>
          {clientInfo?.salon_info?.client_rank && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>
                ランク {clientInfo.salon_info.client_rank}
              </Text>
            </View>
          )}
          {clientInfo?.salon_info?.total_visit != null && (
            <Text style={styles.visitText}>
              来店 {clientInfo.salon_info.total_visit} 回
            </Text>
          )}
        </View>
      </View>

      {/* 選択中の来店 note */}
      {selectedHead && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>来店 note</Text>
          <Text style={styles.dateText}>
            {toJstDatetime(selectedHead.creation_datetime).slice(0, 10)}
          </Text>
          <Text style={styles.staffText}>
            担当：{selectedHead.responsible.staff_name ?? "（不明）"}
          </Text>
          {resChild && (
            <View style={styles.reservationBox}>
              <Text style={styles.menuText}>{resChild.main_menu}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {STATUS_LABEL[resChild.status] ?? resChild.status}
                </Text>
              </View>
              {resChild.total != null && (
                <Text style={styles.totalText}>
                  ¥{resChild.total.toLocaleString()}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* History */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>履歴</Text>
        {headNotes.length === 0 && (
          <Text style={styles.emptyText}>来店履歴はありません。</Text>
        )}
        {headNotes.map((item) => {
          const res = (item.children as (ReservationChild | OtherChild)[]).find(
            (c): c is ReservationChild => c.note_type === "reservation"
          );
          return (
            <TouchableOpacity
              key={item.note_id}
              onPress={() => setSelectedHead(item)}
              style={[
                styles.historyItem,
                selectedHead?.note_id === item.note_id && styles.historyItemActive,
              ]}
            >
              <Text style={styles.historyDate}>
                {toJstDatetime(item.creation_datetime).slice(0, 10)}
              </Text>
              {res && (
                <Text style={styles.historyMenu}>{res.main_menu}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  clientName: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  rankBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rankText: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  visitText: { fontSize: 13, color: "#64748b" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 4 },
  dateText: { fontSize: 13, color: "#64748b" },
  staffText: { fontSize: 13, color: "#64748b" },
  reservationBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 4,
  },
  menuText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e0e7ff",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: 12, color: "#4f46e5", fontWeight: "600" },
  totalText: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginTop: 4 },
  historyItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginBottom: 8,
  },
  historyItemActive: {
    borderColor: "#818cf8",
    backgroundColor: "#eef2ff",
  },
  historyDate: { fontSize: 13, fontWeight: "600", color: "#374151" },
  historyMenu: { fontSize: 12, color: "#64748b", marginTop: 2 },
  emptyText: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  errorText: { fontSize: 14, color: "#dc2626", textAlign: "center" },
  retryBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "600" },
});
