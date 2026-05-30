import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function ReportPage() {
  return (
    <ScreenPlaceholder
      title="日報管理"
      url="/report"
      role="admin"
      description="日次の売上・施術集計。"
      apis={["GET /reports/daily"]}
    />
  );
}
