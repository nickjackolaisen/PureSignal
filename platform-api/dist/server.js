import "dotenv/config";
import cors from "cors";
import express from "express";
import Stripe from "stripe";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PLAN_FLAGS, normalizePlanCode } from "./entitlements.js";
const app = express();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const port = Number(process.env.PORT || 8787);
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
/** Test mode: STRIPE_SANDBOX=true forces test prices; else infer from sk_test_ secret. */
function stripeIsTestMode() {
    const override = process.env.STRIPE_SANDBOX?.trim().toLowerCase();
    if (override === "true" || override === "1")
        return true;
    if (override === "false" || override === "0")
        return false;
    const sk = process.env.STRIPE_SECRET_KEY?.trim() || "";
    return sk.startsWith("sk_test_");
}
function firstEnv(...keys) {
    for (const key of keys) {
        const v = process.env[key]?.trim();
        if (v)
            return v;
    }
    return "";
}
/** Resolve monthly/yearly Stripe price IDs for live vs sandbox (__TEST) vars. */
function planPriceRowFromEnv(testMonthly, testYearly, liveMonthly, liveYearly, liveAnnualLegacy) {
    if (stripeIsTestMode()) {
        return {
            monthly: firstEnv(testMonthly, liveMonthly),
            annual: firstEnv(testYearly, liveYearly, liveAnnualLegacy)
        };
    }
    return {
        monthly: firstEnv(liveMonthly, testMonthly),
        annual: firstEnv(liveYearly, liveAnnualLegacy, testYearly)
    };
}
const PLAN_PRICE_ENV = {
    ext_pro: planPriceRowFromEnv("STRIPE_PRICE_EXT_PRO_MONTHLY_TEST", "STRIPE_PRICE_EXT_PRO_YEARLY_TEST", "STRIPE_PRICE_EXT_PRO_MONTHLY", "STRIPE_PRICE_EXT_PRO_YEARLY", "STRIPE_PRICE_EXT_PRO_ANNUAL"),
    desktop_pro: planPriceRowFromEnv("STRIPE_PRICE_DESKTOP_PRO_MONTHLY_TEST", "STRIPE_PRICE_DESKTOP_PRO_YEARLY_TEST", "STRIPE_PRICE_DESKTOP_PRO_MONTHLY", "STRIPE_PRICE_DESKTOP_PRO_YEARLY", "STRIPE_PRICE_DESKTOP_PRO_ANNUAL"),
    bundle_pro: planPriceRowFromEnv("STRIPE_PRICE_BUNDLE_PRO_MONTHLY_TEST", "STRIPE_PRICE_BUNDLE_PRO_YEARLY_TEST", "STRIPE_PRICE_BUNDLE_PRO_MONTHLY", "STRIPE_PRICE_BUNDLE_PRO_YEARLY", "STRIPE_PRICE_BUNDLE_PRO_ANNUAL")
};
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true
}));
function redact(input) {
    const value = JSON.stringify(input || {});
    if (value.length <= 256) {
        return JSON.parse(value);
    }
    return { truncated: true, preview: value.slice(0, 256) };
}
const deviceRegisterSchema = z.object({
    userId: z.string().min(1),
    type: z.enum(["extension", "desktop"]),
    name: z.string().min(1),
    appVersion: z.string().min(1),
    deviceTokenHash: z.string().min(16)
});
const alertsSchema = z.object({
    userId: z.string().min(1),
    deviceId: z.string().min(1),
    type: z.string().min(1),
    payload: z.record(z.any())
});
const telemetrySchema = z.object({
    userId: z.string().min(1),
    deviceId: z.string().min(1),
    syncStatus: z.enum(["ok", "error"]),
    ruleCount: z.number().int().nonnegative(),
    errorCode: z.string().optional()
});
const checkoutSchema = z.object({
    userId: z.string().min(1),
    planCode: z.string().min(1),
    interval: z.string().min(1),
    successUrl: z.string().url(),
    cancelUrl: z.string().url()
});
const syncCheckoutSessionSchema = z.object({
    sessionId: z.string().min(8),
    userId: z.string().min(1)
});
/** Map client/billing quirks to canonical plan codes used for Stripe prices and metadata. */
function normalizeCheckoutPlanCode(raw) {
    const k = raw.trim().toLowerCase();
    if (k.includes("chrome") || k === "ext_pro")
        return "ext_pro";
    if (k.includes("desktop"))
        return "desktop_pro";
    if (k.includes("bundle"))
        return "bundle_pro";
    return null;
}
/** Accept month/monthly and year/annual/yearly from various clients. */
function normalizeCheckoutInterval(raw) {
    const k = raw.trim().toLowerCase();
    if (k === "month" || k === "monthly")
        return "monthly";
    if (k === "year" || k === "annual" || k === "yearly")
        return "annual";
    return null;
}
function stripeWebhookSecret() {
    const test = process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim();
    const live = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (stripeIsTestMode()) {
        return test || live || null;
    }
    return live || test || null;
}
/** Express can expose headers as string | string[] */
function readStripeSignature(req) {
    const raw = req.headers["stripe-signature"];
    if (typeof raw === "string")
        return raw;
    if (Array.isArray(raw) && raw.length > 0)
        return raw[0];
    return undefined;
}
/** Stripe requires the exact raw bytes; must come from express.raw(), before express.json() */
function payloadForStripeVerify(req) {
    if (Buffer.isBuffer(req.body))
        return req.body;
    if (typeof req.body === "string")
        return req.body;
    throw new Error("Webhook body must be raw Buffer (register this route before express.json())");
}
/** Stripe object references in API responses may be string id or expanded object */
function stripeRefId(value) {
    if (value == null)
        return "";
    if (typeof value === "string")
        return value;
    if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string") {
        return value.id;
    }
    return "";
}
/** Subscription.userId is an FK to User — ensure row exists before subscription upsert */
async function ensureUserExistsForStripe(userId) {
    const safeEmailLocal = userId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 96) || "user";
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: `${safeEmailLocal}@sync.puresignal.io`,
            authProvider: "stripe_webhook"
        }
    });
}
/**
 * Apply a completed Checkout Session to Subscription + Entitlement (webhook + manual sync).
 * Resolves customer id from session or subscription when Stripe omits `customer` on the session.
 */
async function applyCheckoutSessionCompleted(session) {
    const userId = String(session.client_reference_id || "").trim();
    if (!userId) {
        return { ok: false, reason: "missing client_reference_id" };
    }
    let customerId = stripeRefId(session.customer);
    if (!customerId && session.subscription && typeof session.subscription === "object") {
        customerId = stripeRefId(session.subscription.customer);
    }
    const subRef = stripeRefId(session.subscription);
    if (!customerId && subRef) {
        try {
            const sub = await stripe.subscriptions.retrieve(subRef);
            customerId = stripeRefId(sub.customer);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { ok: false, reason: `could not load subscription: ${msg}` };
        }
    }
    if (!customerId) {
        return { ok: false, reason: "missing Stripe customer id on session" };
    }
    if (session.status !== "complete") {
        return { ok: false, reason: `checkout session status is ${session.status}` };
    }
    const planCode = normalizePlanCode(String(session.metadata?.plan_code || session.metadata?.planCode || "free"));
    try {
        await ensureUserExistsForStripe(userId);
        await prisma.subscription.upsert({
            where: { stripeCustomerId: customerId },
            update: { status: "active", planCode, userId },
            create: {
                userId,
                stripeCustomerId: customerId,
                status: "active",
                planCode
            }
        });
        await prisma.entitlement.upsert({
            where: { id: `ent_${userId}` },
            update: { planCode, flags: PLAN_FLAGS[planCode] },
            create: {
                id: `ent_${userId}`,
                scopeType: "user",
                scopeId: userId,
                planCode,
                flags: PLAN_FLAGS[planCode]
            }
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error("applyCheckoutSessionCompleted db error:", msg);
        let reason = `database error: ${msg}`;
        if (/Can't reach database server|P1001/i.test(msg) || /db\..*\.supabase\.co:?5432/i.test(msg)) {
            reason +=
                " Fix: In Supabase → Connect → use Transaction pooler URI (port 6543, pooler host). Set that as DATABASE_URL on Render — direct db.*.supabase.co:5432 often fails from IPv4-only hosts.";
        }
        return { ok: false, reason };
    }
    return { ok: true };
}
/** Stripe subscription statuses that keep paid plan features (not necessarily "active" only). */
function planCodeForSubscriptionStatus(status, metadataPlan) {
    const paidLike = status === "active" || status === "trialing" || status === "past_due";
    return paidLike ? metadataPlan : "free";
}
/**
 * Resolve app user id for a Stripe subscription: existing DB row, subscription metadata
 * (set from checkout), or Checkout Session client_reference_id (backfill when checkout
 * webhook failed before DB row existed).
 */
async function resolveUserIdForStripeSubscription(subscription, existingUserId) {
    if (existingUserId)
        return existingUserId;
    const fromMeta = String(subscription.metadata?.user_id || "").trim();
    if (fromMeta)
        return fromMeta;
    try {
        const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
        const ref = sessions.data[0]?.client_reference_id;
        if (ref && String(ref).trim())
            return String(ref).trim();
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.warn("subscription webhook: checkout.sessions.list failed", e);
    }
    return "";
}
async function syncSubscriptionFromStripeWebhook(subscription) {
    const customerId = stripeRefId(subscription.customer);
    if (!customerId) {
        // eslint-disable-next-line no-console
        console.warn("subscription webhook: missing customer id", subscription.id);
        return;
    }
    const existing = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    const userId = await resolveUserIdForStripeSubscription(subscription, existing?.userId);
    if (!userId) {
        // eslint-disable-next-line no-console
        console.warn("subscription webhook: cannot resolve userId", {
            customerId,
            subscriptionId: subscription.id
        });
        return;
    }
    const metadataPlan = normalizePlanCode(String(subscription.metadata?.plan_code || "free"));
    const status = subscription.status;
    const planCode = planCodeForSubscriptionStatus(status, metadataPlan);
    const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
    await ensureUserExistsForStripe(userId);
    await prisma.subscription.upsert({
        where: { stripeCustomerId: customerId },
        update: { status, planCode, userId, currentPeriodEnd },
        create: {
            userId,
            stripeCustomerId: customerId,
            status,
            planCode,
            currentPeriodEnd
        }
    });
    await prisma.entitlement.upsert({
        where: { id: `ent_${userId}` },
        update: { planCode, flags: PLAN_FLAGS[planCode] },
        create: {
            id: `ent_${userId}`,
            scopeType: "user",
            scopeId: userId,
            planCode,
            flags: PLAN_FLAGS[planCode]
        }
    });
}
async function handleStripeWebhookEvent(event) {
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const result = await applyCheckoutSessionCompleted(session);
        if (!result.ok) {
            // eslint-disable-next-line no-console
            console.warn("checkout.session.completed not applied:", result.reason, { sessionId: session.id });
        }
    }
    if (event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        await syncSubscriptionFromStripeWebhook(subscription);
    }
    if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const customerId = stripeRefId(invoice.customer);
        const existing = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
        if (existing) {
            await prisma.subscription.update({
                where: { stripeCustomerId: customerId },
                data: { status: "past_due" }
            });
        }
    }
}
// Stripe webhook — MUST be registered before express.json() so the body stays raw for signature verification.
app.post("/v1/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const endpointSecret = stripeWebhookSecret();
    if (!endpointSecret) {
        // eslint-disable-next-line no-console
        console.error(stripeIsTestMode()
            ? "Stripe webhook: set STRIPE_WEBHOOK_SECRET_TEST or STRIPE_WEBHOOK_SECRET"
            : "Stripe webhook: set STRIPE_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET_TEST as fallback)");
        res.status(500).send("Server config error");
        return;
    }
    const sig = readStripeSignature(req);
    if (!sig) {
        res.status(400).send("Missing stripe-signature header");
        return;
    }
    let event;
    try {
        const payload = payloadForStripeVerify(req);
        event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
        // eslint-disable-next-line no-console
        console.log(`Webhook verified: ${event.type}`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error("Webhook signature verification failed:", message);
        res.status(400).send(`Webhook Error: ${message}`);
        return;
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                // eslint-disable-next-line no-console
                console.log("Checkout session completed", session.id);
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const sub = event.data.object;
                // eslint-disable-next-line no-console
                console.log(`Subscription ${event.type}`, sub.id);
                break;
            }
            default:
                // eslint-disable-next-line no-console
                console.log(`Webhook event: ${event.type}`);
        }
        await handleStripeWebhookEvent(event);
        res.status(200).json({ received: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error("Error handling webhook:", message);
        res.status(500).send("Webhook handler failed");
    }
});
app.use(express.json({ limit: "1mb" }));
function stripeSecretKeyMode() {
    const sk = process.env.STRIPE_SECRET_KEY?.trim() || "";
    if (sk.startsWith("sk_test_"))
        return "test";
    if (sk.startsWith("sk_live_"))
        return "live";
    return "unset";
}
app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "platform-api",
        stripe: {
            /** Mode implied by STRIPE_SECRET_KEY (this is what Checkout uses). */
            secretKeyMode: stripeSecretKeyMode(),
            /** Price env + webhook secret selection (STRIPE_SANDBOX or sk_test_). */
            priceAndWebhookMode: stripeIsTestMode() ? "test" : "live"
        }
    });
});
// Temporary debug route
app.get("/debug/prices", (_req, res) => {
    const test = stripeIsTestMode();
    res.json({
        message: "Price IDs loaded on server",
        stripeMode: test ? "test" : "live",
        resolvedCheckoutPrices: {
            ext_pro: PLAN_PRICE_ENV.ext_pro,
            desktop_pro: PLAN_PRICE_ENV.desktop_pro,
            bundle_pro: PLAN_PRICE_ENV.bundle_pro
        },
        env: {
            STRIPE_SANDBOX: process.env.STRIPE_SANDBOX ?? null,
            secretPrefix: (process.env.STRIPE_SECRET_KEY || "").slice(0, 12) || null,
            EXT_PRO_MONTHLY_TEST: process.env.STRIPE_PRICE_EXT_PRO_MONTHLY_TEST ?? null,
            EXT_PRO_YEARLY_TEST: process.env.STRIPE_PRICE_EXT_PRO_YEARLY_TEST ?? null,
            EXT_PRO_MONTHLY: process.env.STRIPE_PRICE_EXT_PRO_MONTHLY ?? null,
            EXT_PRO_YEARLY: process.env.STRIPE_PRICE_EXT_PRO_YEARLY ?? null,
            DESKTOP_PRO_MONTHLY_TEST: process.env.STRIPE_PRICE_DESKTOP_PRO_MONTHLY_TEST ?? null,
            DESKTOP_PRO_YEARLY_TEST: process.env.STRIPE_PRICE_DESKTOP_PRO_YEARLY_TEST ?? null,
            BUNDLE_PRO_MONTHLY_TEST: process.env.STRIPE_PRICE_BUNDLE_PRO_MONTHLY_TEST ?? null,
            BUNDLE_PRO_YEARLY_TEST: process.env.STRIPE_PRICE_BUNDLE_PRO_YEARLY_TEST ?? null
        }
    });
});
app.get("/v1/status", async (_req, res) => {
    const latestRelease = await prisma.blocklistRelease.findFirst({
        orderBy: { publishedAt: "desc" }
    });
    res.json({
        ok: true,
        api: "online",
        blocklistVersion: latestRelease?.version || "none",
        publishedAt: latestRelease?.publishedAt || null
    });
});
app.get("/v1/billing/config", (_req, res) => {
    res.json({
        pricesConfigured: {
            ext_pro: {
                monthly: Boolean(PLAN_PRICE_ENV.ext_pro.monthly),
                annual: Boolean(PLAN_PRICE_ENV.ext_pro.annual)
            },
            desktop_pro: {
                monthly: Boolean(PLAN_PRICE_ENV.desktop_pro.monthly),
                annual: Boolean(PLAN_PRICE_ENV.desktop_pro.annual)
            },
            bundle_pro: {
                monthly: Boolean(PLAN_PRICE_ENV.bundle_pro.monthly),
                annual: Boolean(PLAN_PRICE_ENV.bundle_pro.annual)
            }
        }
    });
});
app.post("/v1/devices/register", async (req, res) => {
    const payload = deviceRegisterSchema.parse(req.body);
    const device = await prisma.device.create({
        data: {
            userId: payload.userId,
            type: payload.type,
            name: payload.name,
            appVersion: payload.appVersion,
            deviceTokenHash: payload.deviceTokenHash,
            lastSeenAt: new Date()
        }
    });
    res.status(201).json({ deviceId: device.id, refreshToken: `dev_${device.id}` });
});
app.get("/v1/entitlements", async (req, res) => {
    const userId = String(req.query.userId || "");
    if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
    }
    const subscription = await prisma.subscription.findFirst({ where: { userId } });
    const entitlement = await prisma.entitlement.findFirst({ where: { scopeType: "user", scopeId: userId } });
    const planCode = normalizePlanCode(entitlement?.planCode || subscription?.planCode || "free");
    const flags = PLAN_FLAGS[planCode];
    res.json({ planCode, flags });
});
app.get("/v1/blocklist/manifest", async (_req, res) => {
    const release = await prisma.blocklistRelease.findFirst({ orderBy: { publishedAt: "desc" } });
    if (!release) {
        res.status(404).json({ error: "No blocklist release published" });
        return;
    }
    res.json({
        version: release.version,
        artifactUrls: release.artifactUrls,
        sha256: release.sha256,
        minClientVersion: "1.0.0",
        signature: process.env.BLOCKLIST_MANIFEST_SIGNATURE || ""
    });
});
app.post("/v1/alerts", async (req, res) => {
    const payload = alertsSchema.parse(req.body);
    const subscription = await prisma.subscription.findFirst({ where: { userId: payload.userId } });
    const planCode = normalizePlanCode(subscription?.planCode || "free");
    if (!PLAN_FLAGS[planCode].partnerRelay) {
        res.status(403).json({ error: "Partner relay requires paid entitlement" });
        return;
    }
    const event = await prisma.alertEvent.create({
        data: {
            userId: payload.userId,
            deviceId: payload.deviceId,
            type: payload.type,
            payloadRedacted: redact(payload.payload),
            deliveryStatus: "queued"
        }
    });
    res.status(202).json({ ok: true, eventId: event.id });
});
app.post("/v1/telemetry", async (req, res) => {
    const payload = telemetrySchema.parse(req.body);
    await prisma.adminAuditLog.create({
        data: {
            actorEmail: "telemetry@system",
            action: "telemetry_event",
            targetId: payload.deviceId,
            metadata: redact(payload)
        }
    });
    res.status(202).json({ ok: true });
});
app.post("/v1/billing/create-checkout", async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Invalid checkout request",
            details: parsed.error.flatten().fieldErrors
        });
        return;
    }
    const body = parsed.data;
    const planCode = normalizeCheckoutPlanCode(body.planCode);
    const interval = normalizeCheckoutInterval(body.interval);
    if (!planCode) {
        res.status(400).json({ error: `Unknown or unsupported plan: ${body.planCode}` });
        return;
    }
    if (!interval) {
        res.status(400).json({ error: `Unknown billing interval: ${body.interval}` });
        return;
    }
    const row = PLAN_PRICE_ENV[planCode];
    const priceId = interval === "annual" ? row.annual : row.monthly;
    if (!priceId) {
        res.status(400).json({
            error: `Price not configured for ${planCode}:${interval} (mode: ${stripeIsTestMode() ? "test" : "live"})`
        });
        return;
    }
    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            client_reference_id: body.userId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: body.successUrl,
            cancel_url: body.cancelUrl,
            metadata: { plan_code: planCode },
            subscription_data: {
                metadata: { plan_code: planCode, user_id: body.userId }
            }
        });
        res.json({ checkoutUrl: session.url });
    }
    catch (err) {
        if (err instanceof Stripe.errors.StripeError) {
            // eslint-disable-next-line no-console
            console.error("Stripe checkout.sessions.create:", err.type, err.message, {
                planCode,
                interval,
                priceIdPrefix: priceId.slice(0, 20)
            });
            res.status(400).json({
                error: err.message,
                stripeType: err.type,
                stripeCode: err.code ?? undefined,
                hint: err.type === "StripeInvalidRequestError" && /no such price/i.test(err.message)
                    ? "Use Test mode price IDs (price_…) from the same Stripe account with sk_test_…; set STRIPE_PRICE_*_TEST on the server or replace live price env vars with test prices."
                    : err.type === "StripeAuthenticationError"
                        ? "Check STRIPE_SECRET_KEY on the server (must be sk_test_… for test Checkout)."
                        : undefined
            });
            return;
        }
        throw err;
    }
});
app.post("/v1/billing/sync-checkout-session", async (req, res) => {
    try {
        const parsed = syncCheckoutSessionSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid body", details: parsed.error.flatten().fieldErrors });
            return;
        }
        const { sessionId, userId } = parsed.data;
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["customer", "subscription"]
        });
        if (String(session.client_reference_id || "").trim() !== userId.trim()) {
            res.status(403).json({ error: "Checkout session does not match this account" });
            return;
        }
        const result = await applyCheckoutSessionCompleted(session);
        if (!result.ok) {
            res.status(400).json({ error: result.reason });
            return;
        }
        res.json({ ok: true });
    }
    catch (err) {
        if (err instanceof Stripe.errors.StripeError) {
            res.status(400).json({ error: err.message });
            return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error("sync-checkout-session failed:", err);
        res.status(500).json({ error: msg });
    }
});
app.post("/v1/billing/create-portal", async (req, res) => {
    const payload = z.object({ customerId: z.string().min(1), returnUrl: z.string().url() }).parse(req.body);
    const portal = await stripe.billingPortal.sessions.create({
        customer: payload.customerId,
        return_url: payload.returnUrl
    });
    res.json({ portalUrl: portal.url });
});
app.get("/v1/admin/users", async (_req, res) => {
    const users = await prisma.user.findMany({ take: 100, orderBy: { createdAt: "desc" } });
    res.json(users);
});
app.post("/v1/support/contact", async (req, res) => {
    const payload = z.object({ email: z.string().email(), message: z.string().min(5) }).parse(req.body);
    const message = await prisma.contactMessage.create({ data: payload });
    res.status(201).json({ ok: true, id: message.id });
});
app.post("/v1/support/report-site", async (req, res) => {
    const payload = z
        .object({
        email: z.string().email(),
        domain: z.string().min(3),
        reason: z.string().min(3)
    })
        .parse(req.body);
    const report = await prisma.report.create({ data: payload });
    res.status(201).json({ ok: true, id: report.id });
});
function warnIfSupabaseDirectHostFromRender() {
    const u = process.env.DATABASE_URL || "";
    if (!/supabase\.co/i.test(u))
        return;
    if (/pooler\.supabase\.com|:\s*6543|pgbouncer=true/i.test(u))
        return;
    if (/db\.[a-z0-9-]+\.supabase\.co/i.test(u)) {
        // eslint-disable-next-line no-console
        console.warn("\n[puresignal-api] DATABASE_URL points at Supabase direct DB (db.*.supabase.co).\n" +
            "Render often cannot reach it (IPv4 vs IPv6). Use Supabase Connect → Session pooler\n" +
            "(port 5432, *.pooler.supabase.com) so Prisma migrate and the app both work.\n");
    }
}
app.listen(port, () => {
    warnIfSupabaseDirectHostFromRender();
    // eslint-disable-next-line no-console
    console.log(`PureSignal platform API running on ${port}`);
});
