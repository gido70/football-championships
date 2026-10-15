import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// v13 (2026-10-15): ticker news for kick-off/goals/full time; auto kick-off on the official clock, midnight carry-over, per-match sync toggle,
// start/end push notifications, admin-safe scores/status, phase-aware halves, post-match event import.

const UEFA_TOURNAMENT_ID = "eee33333-5d2a-4f3b-a981-d4b8f5f86143";
const SOURCE = "football-data";
const AF_LEAGUE = 2;          // API-Football: UEFA Champions League
const AF_SEASON = 2026;       // 2026-27 season
const MAX_EVENT_MATCHES_PER_RUN = 2;
const MAX_EVENT_ATTEMPTS = 1; // free plans return no event detail (confirmed 2026-10-13); raise after upgrading
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

// ---------- player / event helpers ----------
function pnorm(value: unknown) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z\u0600-\u06ff ]+/g, " ").replace(/\s+/g, " ").trim();
}

type NormEvent = { kind: "goal" | "yellow_card" | "red_card"; subtype: string | null; minute: number;
  side: "home" | "away" | null; playerName: string; extId: string };

function findPlayer(roster: any[], name: string) {
  const n = pnorm(name);
  if (!n) return null;
  const names = (p: any) => [p.name, p.full_name_en, p.full_name_ar].map(pnorm).filter(Boolean);
  let hits = roster.filter((p) => names(p).includes(n));
  if (hits.length === 1) return hits[0];
  const tokens = n.split(" ");
  const last = tokens[tokens.length - 1];
  const initial = tokens.length > 1 && tokens[0].length <= 2 ? tokens[0][0] : null;
  hits = roster.filter((p) => names(p).some((x) => {
    const t = x.split(" ");
    if (t[t.length - 1] !== last) return false;
    return !initial || t[0][0] === initial;
  }));
  if (hits.length === 1) return hits[0];
  hits = roster.filter((p) => names(p).some((x) => x.includes(n) || (n.length > 4 && n.includes(x))));
  return hits.length === 1 ? hits[0] : null;
}

function sideOfName(local: any, providerTeamName: unknown, providerHomeName: unknown, providerAwayName: unknown) {
  const k = clubKey(providerTeamName);
  if (k && k === clubKey(local.home?.name)) return "home";
  if (k && k === clubKey(local.away?.name)) return "away";
  if (k && k === clubKey(providerHomeName)) return "home";
  if (k && k === clubKey(providerAwayName)) return "away";
  return null;
}

async function fdEvents(token: string, fixtureId: number, local: any): Promise<NormEvent[] | null> {
  const r = await fetch(`https://api.football-data.org/v4/matches/${fixtureId}`, { headers: { "X-Auth-Token": token } });
  if (!r.ok) return null;
  const m = await r.json();
  const goals = Array.isArray(m.goals) ? m.goals : null;
  const bookings = Array.isArray(m.bookings) ? m.bookings : null;
  if (!goals || !bookings) return null; // tier does not include event detail
  const scoreTotal = Number(m.score?.fullTime?.home ?? 0) + Number(m.score?.fullTime?.away ?? 0);
  if (goals.length !== scoreTotal) return null; // detail missing or incomplete
  const homeId = m.homeTeam?.id, awayId = m.awayTeam?.id;
  const sideById = (id: unknown) => id === homeId ? "home" : id === awayId ? "away" : null;
  const out: NormEvent[] = [];
  for (const g of goals) {
    const type = String(g.type || "REGULAR").toUpperCase();
    out.push({ kind: "goal", subtype: type === "OWN" ? "own_goal" : type === "PENALTY" ? "penalty" : null,
      minute: Number(g.minute || 0) + Number(g.injuryTime || 0), side: sideById(g.team?.id),
      playerName: g.scorer?.name || "", extId: `fd-${fixtureId}-g-${g.minute}-${g.injuryTime || 0}-${g.scorer?.id || g.scorer?.name || ""}` });
  }
  for (const b of bookings) {
    const card = String(b.card || "").toUpperCase();
    out.push({ kind: card === "YELLOW" ? "yellow_card" : "red_card", subtype: null,
      minute: Number(b.minute || 0), side: sideById(b.team?.id), playerName: b.player?.name || "",
      extId: `fd-${fixtureId}-c-${card}-${b.minute}-${b.player?.id || b.player?.name || ""}` });
  }
  return out;
}

async function afFixtures(key: string, date: string) {
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${AF_LEAGUE}&season=${AF_SEASON}&date=${date}&timezone=Asia/Dubai`,
    { headers: { "x-apisports-key": key } });
  const p = await r.json().catch(() => null);
  if (!r.ok || (p?.errors && Object.keys(p.errors).length)) return { error: p?.errors || r.status, list: [] as any[] };
  return { error: null, list: (p?.response || []) as any[] };
}

async function afEvents(key: string, fixtures: any[], local: any): Promise<{ events: NormEvent[] | null; note?: string }> {
  const hits = fixtures.filter((f) => {
    const h = clubKey(f.teams?.home?.name), a = clubKey(f.teams?.away?.name);
    return h === clubKey(local.home?.name) && a === clubKey(local.away?.name);
  });
  const loose = hits.length ? hits : fixtures.filter((f) =>
    clubKey(f.teams?.home?.name) === clubKey(local.home?.name) || clubKey(f.teams?.away?.name) === clubKey(local.away?.name));
  if (loose.length !== 1) return { events: null, note: `af-fixture-candidates:${loose.length}` };
  const fx = loose[0];
  const short = String(fx.fixture?.status?.short || "");
  if (!["FT", "AET", "PEN"].includes(short)) return { events: null, note: `af-not-finished:${short}` };
  const r = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fx.fixture.id}`, { headers: { "x-apisports-key": key } });
  const p = await r.json().catch(() => null);
  if (!r.ok || (p?.errors && Object.keys(p.errors).length)) return { events: null, note: "af-events-error" };
  const out: NormEvent[] = [];
  for (const e of (p?.response || [])) {
    const type = String(e.type || "").toLowerCase();
    const detail = String(e.detail || "").toLowerCase();
    if (String(e.comments || "").toLowerCase().includes("shootout")) continue;
    const minute = Number(e.time?.elapsed || 0) + Number(e.time?.extra || 0);
    const side = sideOfName(local, e.team?.name, fx.teams?.home?.name, fx.teams?.away?.name) as any;
    const base = `af-${fx.fixture.id}-${e.time?.elapsed || 0}-${e.time?.extra || 0}-${e.player?.id || e.player?.name || ""}`;
    if (type === "goal") {
      if (detail.includes("missed")) continue;
      out.push({ kind: "goal", subtype: detail.includes("own") ? "own_goal" : detail.includes("penalty") ? "penalty" : null,
        minute, side, playerName: e.player?.name || "", extId: `${base}-goal` });
    } else if (type === "card") {
      const isRed = detail.includes("red") || detail.includes("second");
      out.push({ kind: isRed ? "red_card" : "yellow_card", subtype: null, minute, side, playerName: e.player?.name || "",
        extId: `${base}-${isRed ? "red" : "yellow"}` });
    }
  }
  return { events: out };
}

async function applyEvents(db: any, local: any, events: NormEvent[], source: string) {
  const teamIds = [local.home_team_id, local.away_team_id];
  const { data: roster } = await db.from("players")
    .select("id,team_id,name,full_name_en,full_name_ar,is_active").in("team_id", teamIds).eq("tournament_id", UEFA_TOURNAMENT_ID);
  const homeRoster = (roster || []).filter((p: any) => p.team_id === local.home_team_id);
  const awayRoster = (roster || []).filter((p: any) => p.team_id === local.away_team_id);
  const { data: existing } = await db.from("match_events")
    .select("id,team_id,player_id,event_type,event_subtype,minute,external_event_id,manual_player_name")
    .eq("match_id", local.id).in("event_type", ["goal", "yellow_card", "red_card"]);
  const locals = [...(existing || [])];
  const claimed = new Set<string>();
  const scoringSide = (teamId: string, subtype: string | null) => {
    const own = teamId === local.home_team_id ? "home" : "away";
    return subtype === "own_goal" ? (own === "home" ? "away" : "home") : own;
  };
  let inserted = 0, updated = 0, unchanged = 0;
  const unresolved: string[] = [];
  const now = new Date().toISOString();

  for (const ev of events) {
    // which team does the player belong to (handles own-goal team conventions)
    let player = null, teamId: string | null = null;
    const ph = findPlayer(homeRoster, ev.playerName), pa = findPlayer(awayRoster, ev.playerName);
    if (ph && !pa) { player = ph; teamId = local.home_team_id; }
    else if (pa && !ph) { player = pa; teamId = local.away_team_id; }
    else {
      const provTeam = ev.side === "home" ? local.home_team_id : ev.side === "away" ? local.away_team_id : null;
      teamId = provTeam;
      player = provTeam === local.home_team_id ? ph : provTeam === local.away_team_id ? pa : null;
    }
    if (!teamId) { unresolved.push(`${ev.kind}@${ev.minute}:${ev.playerName}:no-team`); continue; }
    if (!player) unresolved.push(`${ev.kind}@${ev.minute}:${ev.playerName}:no-player`);

    if (locals.some((l) => l.external_event_id === ev.extId)) { unchanged++; claimed.add(locals.find((l) => l.external_event_id === ev.extId).id); continue; }

    const evSide = ev.kind === "goal" ? scoringSide(teamId, ev.subtype) : null;
    const cands = locals.filter((l) => !claimed.has(l.id) && !l.external_event_id && l.event_type === ev.kind &&
      Math.abs(Number(l.minute || 0) - ev.minute) <= 3 &&
      (ev.kind === "goal" ? scoringSide(l.team_id, l.event_subtype) === evSide : l.team_id === teamId))
      .sort((x, y) => Math.abs(Number(x.minute || 0) - ev.minute) - Math.abs(Number(y.minute || 0) - ev.minute));

    const row: any = { team_id: teamId, minute: ev.minute, event_subtype: ev.subtype,
      external_source: source, external_event_id: ev.extId, external_updated_at: now };
    if (cands.length) {
      const target = cands[0];
      claimed.add(target.id);
      if (player) { row.player_id = player.id; row.manual_player_name = null; }
      else if (!target.player_id) row.manual_player_name = ev.playerName || null;
      else delete row.team_id; // keep admin's player + team when provider name is unknown
      const { error } = await db.from("match_events").update(row).eq("id", target.id);
      if (error) unresolved.push(`update-failed:${error.message}`); else updated++;
    } else {
      Object.assign(row, { match_id: local.id, tournament_id: UEFA_TOURNAMENT_ID, event_type: ev.kind, event_order: 0,
        player_id: player?.id || null, manual_player_name: player ? null : (ev.playerName || null) });
      const { error } = await db.from("match_events").insert(row);
      if (error) unresolved.push(`insert-failed:${error.message}`); else inserted++;
    }
  }
  const leftovers = locals.filter((l) => !claimed.has(l.id) && !l.external_event_id)
    .map((l) => ({ id: l.id, type: l.event_type, minute: l.minute }));
  return { inserted, updated, unchanged, unresolved, leftovers };
}

async function notify(url: string, serviceKey: string, type: "start" | "end", matchId: string) {
  try {
    const r = await fetch(`${url}/functions/v1/send-match-notification`, { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      body: JSON.stringify({ type, match_id: matchId }) });
    const body = await r.text();
    return { type, match_id: matchId, status: r.status, body: body.slice(0, 200) };
  } catch (e) { return { type, match_id: matchId, error: String(e).slice(0, 200) }; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const footballDataToken = Deno.env.get("FOOTBALL_DATA_TOKEN");
  const apiFootballKey = Deno.env.get("API_FOOTBALL_KEY") || "";
  if (!supabaseUrl || !serviceKey || !footballDataToken) return response({ error: "Server configuration incomplete" }, 503);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let input: { mode?: string; date?: string } = {};
  try { input = await req.json(); } catch { input = {}; }
  const mode = input.mode === "preview" ? "preview" : "sync";
  if (input.mode === "probe_notify") {
    // Auth check only: a bogus match id must come back as match_not_found (404), not 401/403.
    const r = await notify(supabaseUrl, serviceKey, "start", "00000000-0000-0000-0000-000000000000");
    return response({ probe: r });
  }

  const { data: settings, error: settingsError } = await db.from("tournament_live_sync_settings")
    .select("*").eq("tournament_id", UEFA_TOURNAMENT_ID).single();
  if (settingsError || !settings) return response({ error: "Live sync settings unavailable" }, 503);
  if (!settings.enabled && mode === "sync") return response({ skipped: "disabled" });

  const now = new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))
    ? String(input.date) : new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  // Today's matches plus anything from yesterday still live (23:00 kick-offs cross midnight).
  const yesterday = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const { data: matches, error: matchError } = await db.from("matches")
    .select("id,match_no,match_date,match_time,status,home_score,away_score,current_half,is_paused,auto_live_managed,live_sync_enabled,live_started_at,home_team_id,away_team_id,external_fixture_id,home:teams!matches_home_team_id_fkey(id,name,name_ar,external_team_id),away:teams!matches_away_team_id_fkey(id,name,name_ar,external_team_id)")
    .eq("tournament_id", UEFA_TOURNAMENT_ID)
    .or(`match_date.eq.${date},and(match_date.eq.${yesterday},status.eq.live)`)
    .order("match_date").order("match_time");
  if (matchError) return response({ error: "Unable to read scheduled matches", details: matchError.message }, 500);
  if (!matches?.length) return response({ skipped: "no-local-matches", date });

  if (mode === "sync") {
    const inWindow = matches.some((m: any) => {
      const kickoff = new Date(`${m.match_date}T${String(m.match_time || "00:00:00").slice(0, 8)}+04:00`).getTime();
      return now.getTime() >= kickoff - settings.pre_match_minutes * 60000 && now.getTime() <= kickoff + settings.post_match_minutes * 60000;
    });
    if (!inWindow && !matches.some((m: any) => m.status === "live")) return response({ skipped: "outside-match-window", date });
    if (settings.last_provider_call_at && now.getTime() - new Date(settings.last_provider_call_at).getTime() < 45000) {
      return response({ skipped: "rate-limited" });
    }
    await db.from("tournament_live_sync_settings").update({ last_provider_call_at: now.toISOString() }).eq("tournament_id", UEFA_TOURNAMENT_ID);
  }

  const fromDate = matches.some((m: any) => m.match_date === yesterday) ? yesterday : date;
  const providerUrl = `https://api.football-data.org/v4/competitions/CL/matches?dateFrom=${fromDate}&dateTo=${date}`;
  const providerResponse = await fetch(providerUrl, { headers: { "X-Auth-Token": footballDataToken } });
  const providerPayload = await providerResponse.json();
  if (!providerResponse.ok) {
    const message = JSON.stringify(providerPayload || { status: providerResponse.status }).slice(0, 1000);
    await db.from("tournament_live_sync_settings").update({ last_error: message }).eq("tournament_id", UEFA_TOURNAMENT_ID);
    return response({ error: "Provider request failed", details: providerPayload || null }, 502);
  }
  const fixtures = providerPayload?.matches || [];
  const mappings: any[] = [], unmatched: any[] = [];
  const skippedManual: any[] = [];
  for (const local of matches as any[]) {
    if (local.live_sync_enabled === false) { skippedManual.push(local.id); continue; } // admin runs this match manually
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

  let matchesUpdated = 0, eventsUpserted = 0, providerCalls = 1;
  const finishedForEvents: any[] = [];
  // Floor for live scores = goals the admin actually logged (not the stored score),
  // so a provider correction (e.g. VAR-disallowed goal) can still bring the score down.
  const { data: goalRows } = await db.from("match_events").select("match_id,team_id,event_subtype")
    .in("match_id", mappings.map((x) => x.local.id)).eq("event_type", "goal");
  const loggedGoals = (local: any, side: "home" | "away") => (goalRows || []).filter((g: any) => {
    if (g.match_id !== local.id) return false;
    const own = g.team_id === local.home_team_id ? "home" : "away";
    return (g.event_subtype === "own_goal" ? (own === "home" ? "away" : "home") : own) === side;
  }).length;
  const RANK: Record<string, number> = { scheduled: 0, live: 1, completed: 2 };
  const notifications: { type: "start" | "end"; matchId: string }[] = [];
  const tickerNews: { key: string; matchId: string; text: string }[] = [];
  const nm = (t: any) => t?.name_ar || t?.name || "";
  for (const { local, fixture } of mappings) {
    const fixtureId = Number(fixture.id);
    const short = String(fixture.status || "SCHEDULED");
    let provStatus = statusOf(short);
    // Kick-off on the official clock: the free feed reports IN_PLAY ~5 min late, so a match
    // still TIMED/SCHEDULED after its kick-off time is treated as started (not postponed/cancelled).
    const koTime = fixture.utcDate ? new Date(fixture.utcDate).getTime() : null;
    if (provStatus === "scheduled" && ["TIMED", "SCHEDULED"].includes(short) && koTime && now.getTime() >= koTime && now.getTime() - koTime < 3 * 3600000) provStatus = "live";
    const localStatus = ["live", "completed"].includes(String(local.status)) ? String(local.status) : "scheduled";
    // Never move a match backwards (e.g. admin started it before the delayed feed did).
    const status = RANK[provStatus] >= RANK[localStatus] ? provStatus : localStatus;
    const provHome = fixture.score?.fullTime?.home ?? 0, provAway = fixture.score?.fullTime?.away ?? 0;
    const matchUpdate: any = { external_source: SOURCE, external_fixture_id: fixtureId, external_last_synced_at: now.toISOString(), status };
    if (status === "completed" && provStatus !== "completed") {
      // Admin ended the match before the feed did: leave score/state alone; import events at real full time.
    } else if (status === "completed") {
      // Full time: provider score is final and authoritative.
      Object.assign(matchUpdate, { home_score: provHome, away_score: provAway, live_status: "ended", clock_running: false, is_paused: false, current_period: "full_time" });
      finishedForEvents.push({ local, fixtureId });
      // Skip a stale "match ended" push (e.g. a match closed hours late).
      const koMs = fixture.utcDate ? new Date(fixture.utcDate).getTime() : now.getTime();
      if (localStatus !== "completed" && now.getTime() - koMs < 4 * 3600000) {
        notifications.push({ type: "end", matchId: local.id });
        tickerNews.push({ key: `sync-end:${local.id}`, matchId: local.id, text: `🏁 انتهت المباراة: ${nm(local.home)} ${provHome} - ${provAway} ${nm(local.away)}` });
      }
    } else if (status === "live") {
      // While live the free feed lags: score never drops below the goals the admin logged.
      matchUpdate.home_score = Math.max(Number(provHome), loggedGoals(local, "home"));
      matchUpdate.away_score = Math.max(Number(provAway), loggedGoals(local, "away"));
      // Ticker: a goal the admin did not already log (admin-logged goals post their own news).
      if (localStatus === "live" && (matchUpdate.home_score > Number(local.home_score ?? 0) || matchUpdate.away_score > Number(local.away_score ?? 0))) {
        tickerNews.push({ key: `sync-goal:${local.id}:${matchUpdate.home_score}-${matchUpdate.away_score}`, matchId: local.id,
          text: `⚽ هدف! ${nm(local.home)} ${matchUpdate.home_score} - ${matchUpdate.away_score} ${nm(local.away)}` });
      }
      if (localStatus === "scheduled") {
        // Auto kick-off: start the in-app clock from the official kick-off time and notify.
        const kickoff = fixture.utcDate ? new Date(fixture.utcDate).toISOString() : now.toISOString();
        Object.assign(matchUpdate, { auto_live_managed: true, live_status: "live", live_started_at: kickoff, phase_started_at: kickoff,
          period_start_at: kickoff, current_half: 1, current_period: "first_half", is_paused: false, half_length_minutes: 45, clock_running: true });
        notifications.push({ type: "start", matchId: local.id });
        tickerNews.push({ key: `sync-start:${local.id}`, matchId: local.id, text: `🔴 بدأت المباراة: ${nm(local.home)} × ${nm(local.away)}` });
      } else if (local.auto_live_managed) {
        // Halves only for matches the sync started; admin-run matches keep the admin's clock.
        // The free feed rarely reports PAUSED, so halves also follow the clock:
        // half-time from 47' after kick-off, second half from 62'.
        const ko = local.live_started_at ? new Date(local.live_started_at).getTime() : null;
        const mins = ko ? (now.getTime() - ko) / 60000 : 0;
        const half = Number(local.current_half || 1);
        const secondHalf = () => {
          const start = new Date((ko ?? now.getTime()) + 60 * 60000).toISOString(); // ~real 2nd-half kick-off; page adds the 45' offset
          Object.assign(matchUpdate, { live_status: "live", is_paused: false, clock_running: true, current_half: 2,
            current_period: "second_half", phase_started_at: start, period_start_at: start, added_minutes: null });
        };
        if (half === 1 && (short === "PAUSED" || (mins >= 47 && mins < 62)) && !local.is_paused) {
          Object.assign(matchUpdate, { live_status: "halftime", is_paused: true, clock_running: false, current_period: "half_time" });
        } else if (half === 1 && short !== "PAUSED" && mins >= 62) {
          secondHalf();
        } else if (short !== "PAUSED" && !local.is_paused) matchUpdate.live_status = "live";
      }
    }
    const { error: updateError } = await db.from("matches").update(matchUpdate).eq("id", local.id);
    if (updateError) throw updateError;
    matchesUpdated++;

    await Promise.all([
      db.from("teams").update({ external_source: SOURCE, external_team_id: fixture.homeTeam?.id }).eq("id", local.home_team_id),
      db.from("teams").update({ external_source: SOURCE, external_team_id: fixture.awayTeam?.id }).eq("id", local.away_team_id),
    ]);
  }

  // Ticker news (deduplicated by dedupe_key).
  if (tickerNews.length) {
    try {
      const { data: seen } = await db.from("news_items").select("dedupe_key").in("dedupe_key", tickerNews.map((n) => n.key));
      const seenKeys = new Set((seen || []).map((r: any) => r.dedupe_key));
      const rows = tickerNews.filter((n) => !seenKeys.has(n.key)).map((n) => ({ tournament_id: UEFA_TOURNAMENT_ID, match_id: n.matchId,
        title: n.text, content: n.text, dedupe_key: n.key, display_mode: "internal", source_type: "legacy", category: "official",
        editorial_status: "published", published_at: now.toISOString(), is_visible: true }));
      if (rows.length) await db.from("news_items").insert(rows);
    } catch (_) { /* ticker is best-effort */ }
  }

  // Start/end push notifications (deduplicated server-side per match + type).
  const notifyResults: any[] = [];
  if (notifications.length) {
    const job = Promise.all(notifications.map((n) => notify(supabaseUrl, serviceKey, n.type, n.matchId)))
      .then(async (rs) => { notifyResults.push(...rs);
        await db.from("tournament_live_sync_runs").insert({ tournament_id: UEFA_TOURNAMENT_ID, mode: "notify", run_status: "success",
          provider_calls: 0, fixtures_seen: 0, matches_linked: 0, matches_updated: 0, events_upserted: 0, unmatched: [],
          details: { notifications: rs }, finished_at: new Date().toISOString() }); });
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(job); else await job;
  }

  // ---------- events import for finished matches (bounded per run) ----------
  const eventReport: any[] = [];
  try {
    if (finishedForEvents.length) {
      const ids = finishedForEvents.map((x) => x.local.id);
      const { data: done } = await db.from("live_sync_event_imports").select("match_id,imported_at,attempts").in("match_id", ids);
      const doneMap = new Map((done || []).map((d: any) => [d.match_id, d]));
      const pending = finishedForEvents.filter((x) => {
        const d: any = doneMap.get(x.local.id);
        return !d || (!d.imported_at && Number(d.attempts || 0) < MAX_EVENT_ATTEMPTS);
      }).slice(0, MAX_EVENT_MATCHES_PER_RUN);
      let afList: any[] | null = null, afErr: unknown = null;
      for (const { local, fixtureId } of pending) {
        const prev: any = doneMap.get(local.id);
        let events: NormEvent[] | null = null, source = "", note = "";
        // API-Football first (event detail on free plan); football-data detail as fallback.
        if (apiFootballKey) {
          if (afList === null) { const r = await afFixtures(apiFootballKey, date); afList = r.list; afErr = r.error; providerCalls++; }
          if (afErr) note = `af-error:${JSON.stringify(afErr).slice(0, 200)}`;
          else { const r = await afEvents(apiFootballKey, afList || [], local); if (!r.note?.startsWith("af-fixture")) providerCalls++; events = r.events; note = r.note || ""; if (events) source = "api-football"; }
        }
        if (!events) {
          const fd = await fdEvents(footballDataToken, fixtureId, local); providerCalls++;
          if (fd) { events = fd; source = "football-data"; note = ""; }
          else note = (note ? note + ";" : "") + "fd-no-detail";
        }
        const attempts = Number(prev?.attempts || 0) + 1;
        if (!events) {
          await db.from("live_sync_event_imports").upsert({ match_id: local.id, attempts, last_attempt_at: now.toISOString(), details: { note } });
          eventReport.push({ match_id: local.id, status: "no-events", note });
          continue;
        }
        const res = await applyEvents(db, local, events, source);
        eventsUpserted += res.inserted + res.updated;
        await db.from("live_sync_event_imports").upsert({ match_id: local.id, source, attempts, imported_at: now.toISOString(),
          last_attempt_at: now.toISOString(), events_seen: events.length, inserted: res.inserted, updated: res.updated,
          details: { unresolved: res.unresolved, leftovers: res.leftovers, unchanged: res.unchanged } });
        eventReport.push({ match_id: local.id, source, seen: events.length, ...res });
      }
    }
  } catch (e) {
    eventReport.push({ error: String(e).slice(0, 300) });
  }

  await db.from("tournament_live_sync_settings").update({ last_success_at: now.toISOString(), last_error: null }).eq("tournament_id", UEFA_TOURNAMENT_ID);
  await db.from("tournament_live_sync_runs").insert({ tournament_id: UEFA_TOURNAMENT_ID, mode, run_status: unmatched.length ? "partial" : "success",
    provider_calls: providerCalls, fixtures_seen: fixtures.length, matches_linked: mappings.length, matches_updated: matchesUpdated, events_upserted: eventsUpserted, unmatched,
    details: { provider: SOURCE, event_feed: true, events: eventReport }, finished_at: new Date().toISOString() });
  return response({ mode, date, matches_updated: matchesUpdated, events_upserted: eventsUpserted, unmatched, events: eventReport, notifications: notifications.length, manual: skippedManual.length });
});
