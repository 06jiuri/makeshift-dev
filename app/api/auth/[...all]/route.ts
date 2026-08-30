import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import {
  authLimitRules,
  authPathGroup,
  normalizeAuthEmail,
} from "@/lib/auth-rate-limit-policy";
import { getClientIp, requireRateLimit } from "@/lib/rate-limit";
import { observeServerOperation } from "@/lib/server-observability";

async function authHandler(request: Request, providedEnv?: CloudflareEnv) {
  const env =
    providedEnv ?? (await getCloudflareContext({ async: true })).env;
  return createAuth(env).handler(request);
}

export async function GET(request: Request) {
  return authHandler(request);
}

export async function POST(request: Request) {
  const path = new URL(request.url).pathname.toLowerCase();
  return observeServerOperation(
    "auth.post",
    () => handlePost(request, path),
    { fields: { path: authPathGroup(path) }, slowMs: 1_000 },
  );
}

async function handlePost(request: Request, path: string) {
  const { env } = await getCloudflareContext({ async: true });
  const ip = getClientIp(request);

  const email = await readRequestEmail(request);
  const rules = authLimitRules(path, ip, email);
  const results = await observeServerOperation(
    "auth.rate_limit",
    () =>
      Promise.all(
        rules.map((rule) =>
          requireRateLimit({
            env,
            namespace: rule.namespace,
            key: rule.key,
            limit: rule.limit,
            windowMs: rule.windowMs,
          }),
        ),
      ),
    { fields: { path: authPathGroup(path) }, slowMs: 300 },
  );
  const blockedIndex = results.findIndex((result) => result !== null);
  if (blockedIndex >= 0) {
    const rule = rules[blockedIndex];
    console.warn(
      JSON.stringify({
        event: "auth_rate_limited",
        source: "app",
        path: authPathGroup(path),
        dimension: rule.dimension,
        namespace: rule.namespace,
      }),
    );
    return results[blockedIndex]!;
  }

  const response = await observeServerOperation(
    "auth.better_auth",
    () => authHandler(request, env),
    { fields: { path: authPathGroup(path) }, slowMs: 750 },
  );
  if (response.status === 429) {
    console.warn(
      JSON.stringify({
        event: "auth_rate_limited",
        source: "better-auth",
        path: authPathGroup(path),
      }),
    );
  }
  return response;
}

async function readRequestEmail(request: Request): Promise<string | null> {
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  return normalizeAuthEmail(body);
}
