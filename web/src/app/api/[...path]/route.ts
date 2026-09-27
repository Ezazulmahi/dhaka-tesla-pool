/**
 * Same-origin proxy: the browser only ever talks to this Next.js server, which
 * forwards /api/* to the Express API. The session cookie therefore stays
 * first-party (httpOnly, SameSite=Lax) and no CORS is needed.
 *
 * API_URL is read at request time, so one built image works in Docker
 * (http://api:4000) and on a host like Render (https://...onrender.com).
 */
import type { NextRequest } from "next/server";

const API_URL = () => process.env.API_URL ?? "http://localhost:4000";

// Hop-by-hop / recomputed headers that must not be copied across the proxy.
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding"]);
const DROP_RESPONSE = new Set(["connection", "content-length", "content-encoding", "transfer-encoding", "set-cookie"]);

async function forward(req: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, API_URL());
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key)) headers.set(key, value);
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: { code: "API_UNREACHABLE", message: "The Tesla Pool service is not reachable right now. Please try again." } },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key)) out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);

  const body = upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
