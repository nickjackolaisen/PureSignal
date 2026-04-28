# Runbook: Stripe Webhook Failure

## Trigger

- Stripe retries increase.
- Subscription states not updating.

## Immediate actions

1. Check webhook signature failures and endpoint response codes.
2. Verify `STRIPE_WEBHOOK_SECRET` is correct for the environment.
3. Replay failed events from Stripe dashboard.

## Recovery checklist

- Confirm subscription records updated in database.
- Reconcile entitlements for affected users.
- Communicate billing impact to support and status page if needed.
