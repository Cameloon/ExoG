-- Run as an operator after deploying retry-application-confirmations.
-- Enable pg_cron / pg_net and create the two named Vault secrets first.
-- No credentials are embedded in this file. Reusing the job name updates it.
select cron.schedule(
  'exog-confirmation-retries',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='exog_project_url')
        || '/functions/v1/retry-application-confirmations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='exog_confirmation_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
