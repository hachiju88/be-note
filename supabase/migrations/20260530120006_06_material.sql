-- =============================================================
-- 06_material: 材料系（材料マスタ＋入出庫台帳）
-- =============================================================
-- 在庫数は台帳から算出するのが正だが、参照性能のため
-- t_material.current_stock にキャッシュし、入出庫登録時に更新する。

-- 材料マスタ ----------------------------------------------------
create table t_material (
    material_id    uuid          primary key default gen_random_uuid(),
    salon_id       uuid          not null references t_salon,
    material_name  varchar(50)   not null,
    unit           varchar(10)   not null,            -- '本' | 'g' | 'ml' | '個' など
    current_stock  numeric(10,2) not null default 0,  -- 現在庫（台帳から更新するキャッシュ）
    reorder_point  numeric(10,2) not null default 0,  -- 発注点。current_stock <= で低在庫アラート
    delete_flg     boolean       not null default false
);

-- 入出庫台帳 ----------------------------------------------------
create table t_material_transaction (
    transaction_id        uuid          primary key default gen_random_uuid(),
    material_id           uuid          not null references t_material,
    salon_id              uuid          not null references t_salon,
    staff_id              uuid          not null references t_staff,  -- 操作者
    transaction_type      varchar(10)   not null,   -- 'in'（入庫）| 'out'（出庫）| 'adjust'（棚卸調整）
    quantity              numeric(10,2) not null,    -- in/out=増減量、adjust=棚卸の実在庫数（絶対値）
    transaction_datetime  timestamptz   not null default now(),
    memo                  varchar(100),
    delete_flg            boolean       not null default false
);

create index idx_material_tx_material
    on t_material_transaction (material_id, transaction_datetime);
