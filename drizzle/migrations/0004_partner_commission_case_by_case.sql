-- Commission rates are negotiated per architect/partner and may remain unset until agreed.
ALTER TABLE public.partner_profiles
  ALTER COLUMN commission_rate DROP DEFAULT,
  ALTER COLUMN commission_rate DROP NOT NULL;
ALTER TABLE public.partner_referrals
  ALTER COLUMN commission_rate DROP DEFAULT,
  ALTER COLUMN commission_rate DROP NOT NULL;
