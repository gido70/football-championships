const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth || !supabaseUrl || !anonKey) return json({ error: "Unauthorized" }, 401);

  // لا تُتاح النتائج إلا لمستخدم مسجل الدخول إلى لوحة الإدارة.
  const userCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anonKey },
  });
  if (!userCheck.ok) return json({ error: "Unauthorized" }, 401);

  let input: { date?: string; fixture_id?: number | string } = {};
  try { input = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const date = String(input.date || "");
  const fixtureId = Number(input.fixture_id || 0);
  if (!fixtureId && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Date must be YYYY-MM-DD" }, 400);

  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!apiKey) return json({ error: "API_FOOTBALL_KEY is not configured" }, 503);

  try {
    const endpoint = fixtureId
      ? `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`
      : `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(date)}`;
    const response = await fetch(endpoint, {
      headers: { "x-apisports-key": apiKey },
    });
    const payload = await response.json();
    if (!response.ok || payload?.errors && Object.keys(payload.errors).length) {
      return json({ error: "Football provider rejected the request", details: payload?.errors || null }, 502);
    }

    if (fixtureId) {
      const events = (payload?.response || []).map((row: any) => ({
        external_id: `${fixtureId}-${row.time?.elapsed || 0}-${row.time?.extra || 0}-${row.team?.id || 0}-${row.player?.id || 0}-${row.type || ""}-${row.detail || ""}`,
        minute: Number(row.time?.elapsed || 0) + Number(row.time?.extra || 0),
        elapsed: row.time?.elapsed ?? null,
        extra: row.time?.extra ?? null,
        team: { id: row.team?.id ?? null, name: row.team?.name || null },
        player: { id: row.player?.id ?? null, name: row.player?.name || null },
        assist: { id: row.assist?.id ?? null, name: row.assist?.name || null },
        type: row.type || null,
        detail: row.detail || null,
      })).filter((event: any) => event.type === "Goal" || event.type === "Card");
      return json({ fixture_id: fixtureId, count: events.length, remaining: response.headers.get("x-ratelimit-requests-remaining"), events, read_only: true });
    }

    const fixtures = (payload?.response || []).map((row: any) => ({
      external_id: row.fixture?.id,
      kickoff: row.fixture?.date,
      status: row.fixture?.status?.short || null,
      status_text: row.fixture?.status?.long || null,
      league: row.league?.name || null,
      country: row.league?.country || null,
      home: { id: row.teams?.home?.id, name: row.teams?.home?.name, logo: row.teams?.home?.logo },
      away: { id: row.teams?.away?.id, name: row.teams?.away?.name, logo: row.teams?.away?.logo },
      goals: { home: row.goals?.home, away: row.goals?.away },
    }));

    return json({
      date,
      count: fixtures.length,
      remaining: response.headers.get("x-ratelimit-requests-remaining"),
      fixtures,
      read_only: true,
    });
  } catch {
    return json({ error: "Unable to reach football provider" }, 502);
  }
});
