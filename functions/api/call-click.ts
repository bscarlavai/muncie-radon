/**
 * POST /api/call-click
 *
 * Fired by navigator.sendBeacon when someone taps a tel: link. This is intent,
 * not a conversation: mobile browsers fire the handler whether or not the call
 * connects, and people tap and back out. It lands in its own table so the
 * `calls` table (fed by the Twilio webhook) stays an honest record of actual
 * conversations.
 *
 * Its real job is attribution. The Twilio webhook knows a call happened but
 * not which page or which CTA produced it; this does.
 */

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // sendBeacon payloads are small by definition. Anything large is not ours.
  const raw = await request.text();
  if (raw.length > 1000) return new Response(null, { status: 204 });

  let payload: { placement?: unknown; page?: unknown; utm?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 204 });
  }

  const str = (value: unknown, max: number) =>
    typeof value === 'string' ? value.slice(0, max) : null;

  try {
    await env.DB.prepare(
      `INSERT INTO call_clicks (ts, placement, page, utm, country) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        new Date().toISOString(),
        str(payload.placement, 60),
        str(payload.page, 200),
        str(payload.utm, 300),
        request.headers.get('cf-ipcountry'),
      )
      .run();
  } catch (error) {
    // Never let analytics failure surface to the visitor. They are mid-call.
    console.error('call-click: insert failed', error);
  }

  return new Response(null, { status: 204 });
};
