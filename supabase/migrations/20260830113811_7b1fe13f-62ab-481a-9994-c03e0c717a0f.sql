REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_group(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_write_group(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_group_invite(text) FROM public, anon;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;