ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_member_name text;

CREATE OR REPLACE FUNCTION public.invite_preview(_code text)
RETURNS TABLE (group_name text, role share_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.name, i.role
  FROM public.group_invites i
  JOIN public.groups g ON g.id = i.group_id
  WHERE i.code = _code
    AND i.revoked_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now())
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.invite_preview(text) TO anon, authenticated;