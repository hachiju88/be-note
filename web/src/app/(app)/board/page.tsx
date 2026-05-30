import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function BoardPage() {
  return (
    <ScreenPlaceholder
      title="予約ボード"
      url="/board"
      role="staff / admin"
      description="来店中の予約をタスク列で管理（D&D）。Supabase Realtime で同期。"
      apis={["GET /reservations（来店中）", "PATCH /reservations/{note_id}/task"]}
    />
  );
}
