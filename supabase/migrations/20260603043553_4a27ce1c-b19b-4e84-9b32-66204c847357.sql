CREATE TABLE public.game_saves (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  completed integer[] NOT NULL DEFAULT '{}',
  best_attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  prisms integer NOT NULL DEFAULT 0,
  owned_skins text[] NOT NULL DEFAULT ARRAY['default']::text[],
  equipped_skin_id text NOT NULL DEFAULT 'default',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT game_saves_prisms_nonnegative CHECK (prisms >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_saves TO authenticated;
GRANT ALL ON public.game_saves TO service_role;

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own game save"
ON public.game_saves
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own game save"
ON public.game_saves
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game save"
ON public.game_saves
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own game save"
ON public.game_saves
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_game_saves_updated_at
BEFORE UPDATE ON public.game_saves
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();