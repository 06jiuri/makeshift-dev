import assert from "node:assert/strict";
import test from "node:test";
import {
  authLimitRules,
  authPathGroup,
  normalizeAuthEmail,
} from "../lib/auth-rate-limit-policy.ts";

test("normalizes email without exposing it in route metadata", () => {
  assert.equal(
    normalizeAuthEmail({ email: "  Student@Example.com " }),
    "student@example.com",
  );
  assert.equal(normalizeAuthEmail({ email: 123 }), null);
  assert.equal(normalizeAuthEmail({ email: "x".repeat(321) }), null);
  assert.equal(authPathGroup("/api/auth/email-otp/verify-email"), "/email-otp/verify-email");
});

test("OTP verification favors per-email protection over shared-IP blocking", () => {
  const rules = authLimitRules(
    "/api/auth/email-otp/verify-email",
    "shared-mobile-ip",
    "student@example.com",
  );

  assert.deepEqual(
    rules.map(({ namespace, limit, dimension }) => ({
      namespace,
      limit,
      dimension,
    })),
    [
      { namespace: "auth:v2:post:ip", limit: 180, dimension: "ip" },
      { namespace: "auth:v2:otp-verify:ip", limit: 180, dimension: "ip" },
      { namespace: "auth:v2:otp-verify:email", limit: 15, dimension: "email" },
    ],
  );
});

test("signup and OTP sending have independent email buckets", () => {
  const signupRules = authLimitRules(
    "/api/auth/sign-up/email",
    "shared-ip",
    "student@example.com",
  );
  const sendRules = authLimitRules(
    "/api/auth/email-otp/send-verification-otp",
    "shared-ip",
    "student@example.com",
  );

  assert.equal(signupRules.at(-1)?.namespace, "auth:v2:signup:email");
  assert.equal(signupRules.at(-1)?.limit, 5);
  assert.equal(sendRules.at(-1)?.namespace, "auth:v2:otp-send:email");
  assert.equal(sendRules.at(-1)?.limit, 4);
});
