import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function MasterPage() {
  return (
    <ScreenPlaceholder
      title="マスタメンテ"
      url="/master"
      role="admin"
      description="各種マスタ（メニュー・工程・スタッフ・営業時間・予約枠 等）の保守 CRUD。"
      apis={[
        "GET /masters/{resource}",
        "POST /masters/{resource}",
        "PUT /masters/{resource}/{id}",
        "DELETE /masters/{resource}/{id}",
      ]}
    />
  );
}
