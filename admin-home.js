
(function () {
  const connectionEl = document.getElementById('connection-status');
  const teamsEl = document.getElementById('teams-count');
  const playersEl = document.getElementById('players-count');
  const matchesEl = document.getElementById('matches-count');

  function setOffline() {
    connectionEl.textContent = 'غير مربوط بعد';
  }

  async function start() {
    if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR-PROJECT')) {
      setOffline();
      return;
    }

    try {
      const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      connectionEl.textContent = 'جاري الفحص...';

      const teams = await client.from('teams').select('*', { count: 'exact', head: true });
      const players = await client.from('players').select('*', { count: 'exact', head: true });
      const matches = await client.from('matches').select('*', { count: 'exact', head: true });

      if (teams.error || players.error || matches.error) {
        connectionEl.textContent = 'متصل لكن يحتاج مراجعة الجداول';
        return;
      }

      teamsEl.textContent = teams.count ?? 0;
      playersEl.textContent = players.count ?? 0;
      matchesEl.textContent = matches.count ?? 0;
      connectionEl.textContent = 'متصل';
    } catch (e) {
      connectionEl.textContent = 'خطأ في الربط';
      console.error(e);
    }
  }

  start();
})();
