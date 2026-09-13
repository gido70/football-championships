import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const UEFA_TOURNAMENT_ID = "eee33333-5d2a-4f3b-a981-d4b8f5f86143";
const SOURCE = "football-data";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function norm(value: unknown) {
  return String(value || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ")
    .replace(/\b(fc|cf|ac|afc|ssc|sk|fk|rc|vfb|osc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const aliases: Record<string, string> = {
  "inter milano": "inter",
  "inter milan": "inter",
  "paris saint germain": "paris saint germain",
  "psg": "paris saint germain",
  "atletico madrid": "atletico madrid",
  "club atletico de madrid": "atletico madrid",
  "bayern munich": "bayern munich",
  "bayern munchen": "bayern munich",
  "sporting cp": "sporting lisbon",
  "sporting lisbon": "sporting lisbon",
  "slavia praha": "slavia prague",
  "slavia prague": "slavia prague",
  "shakhtar donetsk": "shakhtar donetsk",
  "shakhtar": "shakhtar donetsk",
  "bodoe glimt": "bodo glimt",
  "bodo glimt": "bodo glimt",
  "galatasaray": "galatasaray",
  "sabah masazir": "sabah",
  "sabah": "sabah",
  "psv eindhoven": "psv",
  "psv": "psv",
  "fenerbahce istanbul": "fenerbahce",
  "fenerbahce": "fenerbahce",
  "aek athens": "aek",
  "pae aek": "aek",
  "bod glimt": "bodo glimt",
  "real betis seville": "real betis",
  "real betis balompie": "real betis",
  "shaktar": "shakhtar donetsk",
};

function clubKey(value: unknown) {
  const key = norm(value);
  return aliases[key] || key;
}

function statusOf(short: string) {
  if (["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT", "LIVE"].includes(short)) return "live";
  if (["FINISHED", "AWARDED"].includes(short)) return "completed";
  return "scheduled";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const footballDataToken = Deno.env.get("FOOTBALL_DATA_TOKEN");
  if (!supabaseUrl || !serviceKey || !footballDataToken) return response({ error: "Server configuration incomplete" }, 503);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let input: { mode?: string; date?: string } = {};
  try { input = await req.json(); } catch { input = {}; }
  const mode = input.mode === "preview" ? "preview" : "sync";

  const { data: settings, error: settingsError } = await db.from("tournament_live_sync_settings")
    .select("*").eq("tournament_id", UEFA_TOURNAMENT_ID).single();
  if (settingsError || !settings) return response({ error: "Live sync settings unavailable" }, 503);
  if (!settings.enabled && mode === "sync") return response({ skipped: "disabled" });

  const now = new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))
    ? String(input.date) : new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  const { data: matches, error: matchError } = await db.from("matches")
    .select("id,match_no,match_date,match_time,status,home_team_id,away_team_id,external_fixture_id,home:teams!matches_home_team_id_fkey(id,name,name_ar,external_team_id),away:teams!matches_away_team_id_fkey(id,name,name_ar,external_team_id)")
    .eq("tournament_id", UEFA_TOURNAMENT_ID).eq("match_date", date).order("match_time");
  if (matchError) return response({ error: "Unable to read scheduled matches", details: matchError.message }, 500);
  if (!matches?.length) return response({ skipped: "no-local-matches", date });

  if (mode === "sync") {
    const inWindow = matches.some((m: any) => {
      const kickoff = new Date(`${m.match_date}T${String(m.match_time || "00:00:00").slice(0, 8)}+04:00`).getTime();
      return now.getTime() >= kickoff - settings.pre_match_minutes * 60000 && now.getTime() <= kickoff + settings.post_match_minutes * 60000;
    });
    if (!inWindow) return response({ skipped: "outside-match-window", date });
    if (settings.last_provider_call_at && now.getTime() - new Date(settings.last_provider_call_at).getTime() < 45000) {
      return response({ skipped: "rate-limited" });
    }
    await db.from("tournament_live_sync_settings").update({ last_provider_call_at: now.toISOString() }).eq("tournament_id", UEFA_TOURNAMENT_ID);
  }

  const providerUrl = `https://api.football-data.org/v4/competitions/CL/matches?dateFrom=${date}&dateTo=${date}`;
  const providerResponse = await fetch(providerUrl, { headers: { "X-Auth-Token": footballDataToken } });
  const providerPayload = await providerResponse.json();
  if (!providerResponse.ok) {
    const message = JSON.stringify(providerPayload || { status: providerResponse.status }).slice(0, 1000);
    await db.from("tournament_live_sync_settings").update({ last_error: message }).eq("tournament_id", UEFA_TOURNAMENT_ID);
    return response({ error: "Provider request failed", details: providerPayload || null }, 502);
  }
  const fixtures = providerPayload?.matches || [];
  const mappings: any[] = [], unmatched: any[] = [];
  for (const local of matches as any[]) {
    let candidates = fixtures.filter((f: any) => Number(local.external_fixture_id) === Number(f.id));
    if (!candidates.length && !local.external_fixture_id) {
      candidates = fixtures.filter((f: any) =>
        [f.homeTeam?.name, f.homeTeam?.shortName].some((n: any) => clubKey(local.home?.name) === clubKey(n)) &&
        [f.awayTeam?.name, f.awayTeam?.shortName].some((n: any) => clubKey(local.away?.name) === clubKey(n)));
    }
    if (candidates.length !== 1) {
      unmatched.push({ match_id: local.id, match_no: local.match_no, home: local.home?.name, away: local.away?.name, candidate_count: candidates.length });
      continue;
    }
    mappings.push({ local, fixture: candidates[0] });
  }

  if (mode === "preview" || !settings.auto_apply) {
    return response({ mode, date, auto_apply: settings.auto_apply, provider_count: fixtures.length,
      matched: mappings.map(({ local, fixture }) => ({ match_id: local.id, match_no: local.match_no, fixture_id: fixture.id, home: fixture.homeTeam?.name, away: fixture.awayTeam?.name, kickoff: fixture.utcDate, status: fixture.status })), unmatched });
  }

  let matchesUpdated = 0, eventsUpserted = 0;
  for (const { local, fixture } of mappings) {
    const fixtureId = Number(fixture.id);
    const short = String(fixture.status || "SCHEDULED");
    const matchUpdate: any = { external_source: SOURCE, external_fixture_id: fixtureId,
      external_last_synced_at: now.toISOString(), status: statusOf(short),
      home_score: fixture.score?.fullTime?.home ?? 0, away_score: fixture.score?.fullTime?.away ?? 0 };
    if (matchUpdate.status === "live") matchUpdate.live_status = short === "PAUSED" ? "halftime" : "live";
    if (matchUpdate.status === "completed") { matchUpdate.live_status = "ended"; matchUpdate.clock_running = false; }
    const { error: updateError } = await db.from("matches").update(matchUpdate).eq("id", local.id);
    if (updateError) throw updateError;
    matchesUpdated++;

    await Promise.all([
      db.from("teams").update({ external_source: SOURCE, external_team_id: fixture.homeTeam?.id }).eq("id", local.home_team_id),
      db.from("teams").update({ external_source: SOURCE, external_team_id: fixture.awayTeam?.id }).eq("id", local.away_team_id),
    ]);
  }

  await db.from("tournament_live_sync_settings").update({ last_success_at: now.toISOString(), last_error: null }).eq("tournament_id", UEFA_TOURNAMENT_ID);
  await db.from("tournament_live_sync_runs").insert({ tournament_id: UEFA_TOURNAMENT_ID, mode, run_status: unmatched.length ? "partial" : "success",
    provider_calls: 1, fixtures_seen: fixtures.length, matches_linked: mappings.length, matches_updated: matchesUpdated, events_upserted: eventsUpserted, unmatched,
    details: { provider: SOURCE, event_feed: false }, finished_at: new Date().toISOString() });
  return response({ mode, date, matches_updated: matchesUpdated, events_upserted: eventsUpserted, unmatched });
});
