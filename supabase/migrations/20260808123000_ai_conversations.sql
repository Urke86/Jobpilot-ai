-- Phase 4C.1: AI assistant conversations + messages

DO $$ BEGIN
  CREATE TYPE public.ai_message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_entity_type ADD VALUE IF NOT EXISTS 'ai_conversation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'assistant_started';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  context_type text NOT NULL DEFAULT 'none'
    CHECK (context_type IN ('none', 'job', 'application')),
  context_job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  context_application_id uuid REFERENCES public.applications (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_conversations_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT ai_conversations_context_job_ck CHECK (
    context_type <> 'job' OR context_job_id IS NOT NULL
  ),
  CONSTRAINT ai_conversations_context_app_ck CHECK (
    context_type <> 'application' OR context_application_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  role public.ai_message_role NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_messages_content_not_blank CHECK (length(trim(content)) > 0),
  CONSTRAINT ai_messages_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON public.ai_conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON public.ai_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_messages_user_created_idx
  ON public.ai_messages (user_id, created_at DESC);

DROP TRIGGER IF EXISTS set_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER set_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_select_own ON public.ai_conversations;
CREATE POLICY ai_conversations_select_own
  ON public.ai_conversations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_insert_own ON public.ai_conversations;
CREATE POLICY ai_conversations_insert_own
  ON public.ai_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_update_own ON public.ai_conversations;
CREATE POLICY ai_conversations_update_own
  ON public.ai_conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_delete_own ON public.ai_conversations;
CREATE POLICY ai_conversations_delete_own
  ON public.ai_conversations FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_select_own ON public.ai_messages;
CREATE POLICY ai_messages_select_own
  ON public.ai_messages FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_insert_own ON public.ai_messages;
CREATE POLICY ai_messages_insert_own
  ON public.ai_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_update_own ON public.ai_messages;
CREATE POLICY ai_messages_update_own
  ON public.ai_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_delete_own ON public.ai_messages;
CREATE POLICY ai_messages_delete_own
  ON public.ai_messages FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.ai_conversations IS 'Phase 4C.1: user AI assistant conversation threads';
COMMENT ON TABLE public.ai_messages IS 'Phase 4C.1: messages within AI assistant conversations';
