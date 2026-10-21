-- TradeXchange remediation — Block 9 advisor follow-up.
-- Cover foreign keys introduced by the Block 9 operational audit tables.

create index if not exists service_capability_status_history_admin_idx
    on public.service_capability_status_history ("adminId")
    where "adminId" is not null;

create index if not exists service_settlement_operations_admin_idx
    on public.service_settlement_operations ("adminId");

create index if not exists service_settlement_operations_payment_idx
    on public.service_settlement_operations ("paymentId");
