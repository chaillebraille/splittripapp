GRANT EXECUTE ON FUNCTION public.can_read_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_group_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_group(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_write_group(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;