-- The trigger calls this function internally; clients must not call it through RPC.
revoke execute on function public.handle_new_user() from public;

-- Activation intent state is changed only by the server after validating a session
-- or a one-time exchange code. The browser may read its own pending intent.
drop policy if exists activation_intents_update_own on public.activation_intents;
