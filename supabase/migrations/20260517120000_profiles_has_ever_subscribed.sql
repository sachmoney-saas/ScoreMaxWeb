-- Distingue « jamais abonné » (funnel onboarding) vs « ex-abonné » (app lecture seule).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_ever_subscribed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_ever_subscribed IS
  'True after first subscription row or billing customer id — survives cancel/expiry.';

UPDATE public.profiles p
SET has_ever_subscribed = true
WHERE has_ever_subscribed = false
  AND (
    p.dodo_customer_id IS NOT NULL
    OR p.stripe_customer_id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_subscriptions us
      WHERE us.user_id = p.id
    )
  );

CREATE OR REPLACE FUNCTION public.scoremax_mark_has_ever_subscribed(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET has_ever_subscribed = true,
      updated_at = NOW()
  WHERE id = target_user
    AND has_ever_subscribed IS DISTINCT FROM true;
END;
$$;

CREATE OR REPLACE FUNCTION public.scoremax_profiles_billing_customer_ever_subscribed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dodo_customer_id IS NOT NULL OR NEW.stripe_customer_id IS NOT NULL THEN
    PERFORM public.scoremax_mark_has_ever_subscribed(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scoremax_profiles_mark_ever_subscribed ON public.profiles;
CREATE TRIGGER scoremax_profiles_mark_ever_subscribed
  AFTER INSERT OR UPDATE OF dodo_customer_id, stripe_customer_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.scoremax_profiles_billing_customer_ever_subscribed();

CREATE OR REPLACE FUNCTION public.scoremax_user_subscriptions_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.scoremax_sync_is_subscriber(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.scoremax_mark_has_ever_subscribed(NEW.user_id);
  PERFORM public.scoremax_sync_is_subscriber(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    PERFORM public.scoremax_sync_is_subscriber(OLD.user_id);
    PERFORM public.scoremax_mark_has_ever_subscribed(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;
