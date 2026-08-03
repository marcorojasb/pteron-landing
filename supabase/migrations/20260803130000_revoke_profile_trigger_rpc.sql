-- The profile trigger is internal-only; it must not be exposed as an RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
