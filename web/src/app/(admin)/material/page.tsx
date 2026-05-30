import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function MaterialPage() {
  return (
    <ScreenPlaceholder
      title="材料管理"
      url="/material"
      role="admin"
      description="材料マスタ＋入出庫台帳。発注点による低在庫アラート。"
      apis={["GET /materials", "POST /materials…"]}
    />
  );
}
