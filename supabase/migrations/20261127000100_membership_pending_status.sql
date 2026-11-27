-- IGREJAQUA — status "pending" (pedido de entrada aguardando aprovação da administração).
-- Fica em migration própria: um valor novo de enum só pode ser usado depois que esta transação for confirmada.
-- Quem está "pending" não tem acesso a nada: is_active_member/has_church_role/current_membership_id exigem 'active'.
alter type public.membership_status add value if not exists 'pending';
