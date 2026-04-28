import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_FLAGS, normalizePlanCode } from "./entitlements.js";
test("normalizePlanCode defaults to free", () => {
    assert.equal(normalizePlanCode("unknown"), "free");
    assert.equal(normalizePlanCode(undefined), "free");
});
test("bundle plan has both extension and desktop advanced flags", () => {
    const flags = PLAN_FLAGS.bundle_pro;
    assert.equal(flags.partnerRelay, true);
    assert.equal(flags.desktopAdvanced, true);
    assert.equal(flags.signedUpdates, true);
});
