CREATE POLICY "Owners can view sharee profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_shares s
      JOIN public.groups g ON g.id = s.group_id
      WHERE s.user_id = profiles.user_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Shared users can view the trip owner profile" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.group_shares s
      JOIN public.groups g ON g.id = s.group_id
      WHERE s.user_id = auth.uid() AND g.created_by = profiles.user_id
    )
  );