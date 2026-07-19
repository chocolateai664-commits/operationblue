CREATE TABLE public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text,
  title text NOT NULL,
  summary text,
  prompt text,
  source text NOT NULL DEFAULT 'feed',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved items"
  ON public.saved_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users add own saved items"
  ON public.saved_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own saved items"
  ON public.saved_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX saved_items_user_created_idx ON public.saved_items(user_id, created_at DESC);