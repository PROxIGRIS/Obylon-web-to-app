CREATE POLICY "Users can update their own sessions"
    ON public.user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);
