export type AuthLimitRule = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  dimension: "ip" | "email";
};

export function normalizeAuthEmail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  const emailValue = (body as { email?: unknown }).email;
  if (typeof emailValue !== "string") return null;

  const email = emailValue.trim().toLowerCase();
  return email && email.length <= 320 ? email : null;
}

export function authLimitRules(
  path: string,
  ip: string,
  email: string | null,
): AuthLimitRule[] {
  const rules: AuthLimitRule[] = [
    {
      namespace: "auth:v2:post:ip",
      key: ip,
      limit: 180,
      windowMs: 60_000,
      dimension: "ip",
    },
  ];

  const add = (
    namespace: string,
    ipLimit: number,
    emailLimit: number,
    windowMs: number,
  ) => {
    rules.push({
      namespace: `${namespace}:ip`,
      key: ip,
      limit: ipLimit,
      windowMs,
      dimension: "ip",
    });
    if (email) {
      rules.push({
        namespace: `${namespace}:email`,
        key: email,
        limit: emailLimit,
        windowMs,
        dimension: "email",
      });
    }
  };

  if (path.includes("/sign-in/email")) {
    add("auth:v2:signin", 120, 15, 5 * 60_000);
  } else if (path.includes("/sign-up/email")) {
    add("auth:v2:signup", 60, 5, 60 * 60_000);
  } else if (path.includes("/email-otp/send-verification-otp")) {
    add("auth:v2:otp-send", 60, 4, 10 * 60_000);
  } else if (path.includes("/email-otp/verify-email")) {
    // The OTP itself permits only three wrong attempts. This outer limit
    // catches request storms without blocking a shared mobile egress IP.
    add("auth:v2:otp-verify", 180, 15, 10 * 60_000);
  } else if (
    path.includes("/reset-password") ||
    path.includes("/forget-password") ||
    path.includes("/request-password-reset")
  ) {
    add("auth:v2:password-reset", 60, 4, 15 * 60_000);
  }

  return rules;
}

export function authPathGroup(path: string) {
  return path.replace(/^\/api\/auth/, "") || "/";
}
