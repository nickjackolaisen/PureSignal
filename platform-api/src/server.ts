import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
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

const PLAN_PRICE_ENV: Record<"ext_pro" | "desktop_pro" | "bundle_pro", { monthly: string; annual: string }> = {
  ext_pro: {
    monthly: process.env.STRIPE_PRICE_EXT_PRO_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_EXT_PRO_ANNUAL || ""
  },
  desktop_pro: {
    monthly: process.env.STRIPE_PRICE_DESKTOP_PRO_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_DESKTOP_PRO_ANNUAL || ""
  },
  bundle_pro: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_PRO_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_BUNDLE_PRO_ANNUAL || ""
  }
};

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true
  })
);

function redact(input: unknown) {
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
  planCode: z.enum(["ext_pro", "desktop_pro", "bundle_pro"]),
  interval: z.enum(["monthly", "annual"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});

function resolvePriceId(planCode: "ext_pro" | "desktop_pro" | "bundle_pro", interval: "monthly" | "annual") {
  const value = PLAN_PRICE_ENV[planCode][interval];
  return value || null;
}

function stripeWebhookSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return value || null;
}

/** Express can expose headers as string | string[] */
function readStripeSignature(req: Request): string | undefined {
  const raw = req.headers["stripe-signature"];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return undefined;
}

/** Stripe requires the exact raw bytes; must come from express.raw(), before express.json() */
function payloadForStripeVerify(req: Request): Buffer | string {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  throw new Error("Webhook body must be raw Buffer (register this route before express.json())");
}

/** Subscription.userId is an FK to User — ensure row exists before subscription upsert */
async function ensureUserExistsForStripe(userId: string) {
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

async function handleStripeWebhookEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = String(session.client_reference_id || "");
    const customerId = String(session.customer || "");
    const planCode = normalizePlanCode(
      String(session.metadata?.plan_code || session.metadata?.planCode || "free")
    );
    if (userId && customerId) {
      await ensureUserExistsForStripe(userId);
      await prisma.subscription.upsert({
        where: { stripeCustomerId: customerId },
        update: { status: "active", planCode },
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
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = String(subscription.customer || "");
    const status = subscription.status;
    const metadataPlan = normalizePlanCode(String(subscription.metadata?.plan_code || "free"));
    const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
    const existing = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    if (existing) {
      const planCode = status === "active" ? metadataPlan : "free";
      await prisma.subscription.update({
        where: { stripeCustomerId: customerId },
        data: { status, planCode, currentPeriodEnd }
      });
      await prisma.entitlement.upsert({
        where: { id: `ent_${existing.userId}` },
        update: { planCode, flags: PLAN_FLAGS[planCode] },
        create: {
          id: `ent_${existing.userId}`,
          scopeType: "user",
          scopeId: existing.userId,
          planCode,
          flags: PLAN_FLAGS[planCode]
        }
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = String(invoice.customer || "");
    const existing = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    if (existing) {
      await prisma.subscription.update({
        where: { stripeCustomerId: customerId },
        data: { status: "past_due" }
      });
    }
  }
}

app.post("/v1/billing/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const secret = stripeWebhookSecret();
  if (!secret) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const sig = readStripeSignature(req);
  if (!sig) {
    res.status(400).send("Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;
  try {
    const payload = payloadForStripeVerify(req);
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Stripe webhook verify failed:", message);
    if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
      res.status(400).send(`Webhook signature verification failed: ${message}`);
      return;
    }
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    // eslint-disable-next-line no-console
    console.log(`Stripe webhook received: ${event.type}`);
    await handleStripeWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Stripe webhook handler error:", message);
    res.status(500).json({ error: "webhook_handler_failed" });
  }
});

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "platform-api" });
});

app.get("/v1/status", async (_req: Request, res: Response) => {
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

app.get("/v1/billing/config", (_req: Request, res: Response) => {
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

app.post("/v1/devices/register", async (req: Request, res: Response) => {
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

app.get("/v1/entitlements", async (req: Request, res: Response) => {
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

app.get("/v1/blocklist/manifest", async (_req: Request, res: Response) => {
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

app.post("/v1/alerts", async (req: Request, res: Response) => {
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

app.post("/v1/telemetry", async (req: Request, res: Response) => {
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

app.post("/v1/billing/create-checkout", async (req: Request, res: Response) => {
  const payload = checkoutSchema.parse(req.body);
  const priceId = resolvePriceId(payload.planCode, payload.interval);
  if (!priceId) {
    res.status(503).json({ error: `Price is not configured for ${payload.planCode}:${payload.interval}` });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: payload.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: payload.successUrl,
    cancel_url: payload.cancelUrl,
    metadata: { plan_code: payload.planCode },
    subscription_data: {
      metadata: { plan_code: payload.planCode }
    }
  });
  res.json({ checkoutUrl: session.url });
});

app.post("/v1/billing/create-portal", async (req: Request, res: Response) => {
  const payload = z.object({ customerId: z.string().min(1), returnUrl: z.string().url() }).parse(req.body);
  const portal = await stripe.billingPortal.sessions.create({
    customer: payload.customerId,
    return_url: payload.returnUrl
  });
  res.json({ portalUrl: portal.url });
});

app.get("/v1/admin/users", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({ take: 100, orderBy: { createdAt: "desc" } });
  res.json(users);
});

app.post("/v1/support/contact", async (req: Request, res: Response) => {
  const payload = z.object({ email: z.string().email(), message: z.string().min(5) }).parse(req.body);
  const message = await prisma.contactMessage.create({ data: payload });
  res.status(201).json({ ok: true, id: message.id });
});

app.post("/v1/support/report-site", async (req: Request, res: Response) => {
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PureSignal platform API running on ${port}`);
});
