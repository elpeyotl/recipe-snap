-- Add subscription columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS subscription_credits integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamp with time zone;

-- Update transactions type check to include 'subscription'
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('purchase', 'usage', 'bonus', 'refund', 'subscription'));

-- Update use_credit to consume subscription credits first, then purchased credits
CREATE OR REPLACE FUNCTION public.use_credit(user_id uuid)
RETURNS boolean AS $$
DECLARE
  rows_updated integer;
BEGIN
  -- Try subscription credits first
  UPDATE public.profiles
  SET subscription_credits = subscription_credits - 1,
      total_snaps_used = total_snaps_used + 1,
      updated_at = now()
  WHERE id = user_id
    AND subscription_credits > 0
    AND subscription_status IN ('active', 'canceled');

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated > 0 THEN
    INSERT INTO public.transactions (user_id, type, credits_change)
    VALUES (user_id, 'usage', -1);
    RETURN true;
  END IF;

  -- Fall back to purchased credits
  UPDATE public.profiles
  SET credits = credits - 1,
      total_snaps_used = total_snaps_used + 1,
      updated_at = now()
  WHERE id = user_id AND credits > 0;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated > 0 THEN
    INSERT INTO public.transactions (user_id, type, credits_change)
    VALUES (user_id, 'usage', -1);
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent subscription credit refill (resets credits, not adds)
CREATE OR REPLACE FUNCTION public.refill_subscription_credits(
  p_user_id uuid,
  p_credits integer,
  p_stripe_invoice_id text,
  p_subscription_id text,
  p_period_end timestamptz
)
RETURNS boolean AS $$
DECLARE
  existing_count integer;
BEGIN
  -- Check idempotency via stripe_session_id column
  SELECT count(*) INTO existing_count
  FROM public.transactions
  WHERE stripe_session_id = p_stripe_invoice_id;

  IF existing_count > 0 THEN
    RETURN false;
  END IF;

  -- Reset subscription credits (not accumulate)
  UPDATE public.profiles
  SET subscription_credits = p_credits,
      subscription_id = p_subscription_id,
      subscription_status = 'active',
      subscription_period_end = p_period_end,
      updated_at = now()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, credits_change, stripe_session_id, pack_name)
  VALUES (p_user_id, 'subscription', p_credits, p_stripe_invoice_id, 'Monthly');

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
