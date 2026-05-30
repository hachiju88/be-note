import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function ReservePage() {
  return (
    <ScreenPlaceholder
      title="予約管理"
      url="/reserve"
      role="staff / admin"
      description="予約の一覧・新規作成・編集。空き時間算出。ダブルブッキング二重防御。"
      apis={[
        "GET /reservations",
        "GET /availability",
        "PUT /reservations/{note_id}",
      ]}
    />
  );
}
