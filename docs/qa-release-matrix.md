# QA Release Matrix

Mark each row as pass/fail and link evidence (screenshot, log snippet, or Stripe event id).

| Area | Scenario | Expected result | Status | Evidence |
|---|---|---|---|---|
| Free plan | New user opens extension and dashboard | `planCode=free`, paid flags disabled | TODO | TODO |
| Billing | Checkout `ext_pro` monthly | Stripe checkout opens and completes | TODO | TODO |
| Billing | Checkout `desktop_pro` annual | Stripe checkout opens and completes | TODO | TODO |
| Billing | Checkout `bundle_pro` monthly | Stripe checkout opens and completes | TODO | TODO |
| Billing | Cancel active subscription | Entitlements revert to `free` at expected event | TODO | TODO |
| Billing | Payment failure | Subscription status is `past_due` | TODO | TODO |
| Webhook | Invalid Stripe signature | API responds `400 Invalid signature` | TODO | TODO |
| Auth | Logged-out user visits `/dashboard` | Redirect to `/` with `loginRequired=1` | TODO | TODO |
| Auth | Valid signed session loads dashboard API | `/api/dashboard` returns user + entitlements | TODO | TODO |
| Extension | Partner relay on free plan | Partner test blocked with Pro-required message | TODO | TODO |
| Extension | Partner relay on ext/bundle plan | Partner test succeeds | TODO | TODO |
| Extension | Signed manifest verification | Tampered payload rejected | TODO | TODO |
| Extension | Delta rollback | Last known good delta reapplied on fetch/verify failure | TODO | TODO |
| Extension | Disable cooldown flow | Protection cannot be disabled before cooldown unlock | TODO | TODO |
| API | `/v1/alerts` without paid entitlement | Returns 403 | TODO | TODO |
| Store package | Listing metadata + URLs | Chrome store validation passes | TODO | TODO |
