(function () {
  const form = document.getElementById('group-form');
  const statusEl = document.getElementById('form-status');
  const bodyEl = document.getElementById('groups-body');
  const connectionEl = document.getElementById('groups-connection');
  const activeTournamentEl = document.getElementById('active-tournament-name');
  const totalCountEl = document.getElementById('teams-total-count');

  const tournamentSelect = document.getElementById('tournament-select');
  const teamSelect = document.getElementById('team-select');
  const clearBtn = document.getElementById('clear-group');
  const refreshBtn = document.getElementById('refresh-page');

  const teamsTable = 'teams';
  const tournamentsTable = 'tournaments';
  let client = null;
  let tournaments = [];
  let teams = [];

  function msg(text, cls = '') {
    statusEl.className = 'status-line ' + cls;
    statusEl.textContent = text;
  }

  function teamName(row) {
    return row.name || row.team_name || row.title || '';
  }

  async function loadTournaments() {
    const { data, error } = await client
      .from(tournamentsTable)
      .select('id, name, season_label, is_active')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      msg('تعذر قراءة البطولات: ' + error.message, 'error');
      return;
    }

    tournaments = data || [];
    tournamentSelect.innerHTML = '';

    if (!tournaments.length) {
      tournamentSelect.innerHTML = '<option value="">لا توجد بطولة</option>';
      activeTournamentEl.textContent = 'لا توجد بطولة';
      return;
    }

    let selectedId = null;

    tournaments.forEach((row) => {
      const label = row.name + (row.season_label ? ' - ' + row.season_label : '');
      const op = document.createElement('option');
      op.value = String(row.id); // UUID-safe
      op.textContent = label;
      if (row.is_active && selectedId === null) selectedId = String(row.id);
      tournamentSelect.appendChild(op);
    });

    if (!selectedId) selectedId = String(tournaments[0].id);
    tournamentSelect.value = selectedId;

    const active = tournaments.find(x => String(x.id) === selectedId);
    activeTournamentEl.textContent = active ? (active.name + (active.season_label ? ' - ' + active.season_label : '')) : 'غير محددة';
  }

  async function loadTeamsForTournament() {
    const tid = tournamentSelect.value; // keep as string for UUID compatibility
    teamSelect.innerHTML = '<option value="">اختر الفريق</option>';

    if (!tid) {
      teams = [];
      bodyEl.innerHTML = '<tr><td colspan="5">لا توجد بطولة محددة</td></tr>';
      totalCountEl.textContent = '0';
      return;
    }

    const { data, error } = await client
      .from(teamsTable)
      .select('id, name, short_name, tournament_id, group_code, group_seed, is_active')
      .eq('tournament_id', tid) // UUID-safe
      .order('created_at', { ascending: true, nullsFirst: false });

    if (error) {
      bodyEl.innerHTML = `<tr><td colspan="5">تعذر قراءة الفرق: ${error.message}</td></tr>`;
      totalCountEl.textContent = '0';
      return;
    }

    teams = data || [];
    totalCountEl.textContent = String(teams.length);

    teams.forEach(row => {
      const op = document.createElement('option');
      op.value = String(row.id); // UUID-safe
      op.textContent = teamName(row);
      teamSelect.appendChild(op);
    });

    renderRows();
  }

  function renderRows() {
    if (!teams.length) {
      bodyEl.innerHTML = '<tr><td colspan="5">لا توجد فرق في هذه البطولة</td></tr>';
      return;
    }

    const sorted = [...teams].sort((a, b) => {
      const g1 = a.group_code || 'Z';
      const g2 = b.group_code || 'Z';
      if (g1 !== g2) return g1.localeCompare(g2);
      return (a.group_seed || 999) - (b.group_seed || 999);
    });

    bodyEl.innerHTML = sorted.map(row => `
      <tr>
        <td>${teamName(row)}</td>
        <td>${row.short_name ?? ''}</td>
        <td>${row.group_code ?? '-'}</td>
        <td>${row.group_seed ?? '-'}</td>
        <td><button class="small-btn delete" data-id="${String(row.id)}">إزالة</button></td>
      </tr>
    `).join('');

    bodyEl.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const { error } = await client
          .from(teamsTable)
          .update({ group_code: null, group_seed: null })
          .eq('id', id); // UUID-safe

        if (error) {
          msg('فشل إزالة التوزيع: ' + error.message, 'error');
          return;
        }

        msg('تمت إزالة التوزيع بنجاح', 'success');
        await loadTeamsForTournament();
      });
    });
  }

  async function init() {
    try {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

      const test = await client
        .from(teamsTable)
        .select('id, tournament_id, group_code, group_seed', { count: 'exact', head: true });

      if (test.error) {
        connectionEl.textContent = 'متصل لكن أعمدة التوزيع غير جاهزة';
        bodyEl.innerHTML = `<tr><td colspan="5">تعذر بدء الصفحة: ${test.error.message}</td></tr>`;
        return;
      }

      connectionEl.textContent = 'متصل';
      await loadTournaments();
      await loadTeamsForTournament();
    } catch (e) {
      connectionEl.textContent = 'خطأ في الربط';
      bodyEl.innerHTML = '<tr><td colspan="5">تعذر بدء الصفحة</td></tr>';
      console.error(e);
    }
  }

  tournamentSelect.addEventListener('change', async () => {
    const active = tournaments.find(x => String(x.id) === tournamentSelect.value);
    activeTournamentEl.textContent = active ? (active.name + (active.season_label ? ' - ' + active.season_label : '')) : 'غير محددة';
    await loadTeamsForTournament();
  });

  teamSelect.addEventListener('change', () => {
    const selected = teams.find(x => String(x.id) === teamSelect.value);
    document.getElementById('group-code').value = selected?.group_code || '';
    document.getElementById('seed-order').value = selected?.group_seed ?? '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const teamId = teamSelect.value;
    const groupCode = document.getElementById('group-code').value;
    const groupSeed = document.getElementById('seed-order').value;

    if (!teamId) {
      msg('اختر الفريق أولاً', 'warning');
      return;
    }
    if (!groupCode) {
      msg('اختر المجموعة أولاً', 'warning');
      return;
    }

    msg('جاري الحفظ...');
    const { error } = await client
      .from(teamsTable)
      .update({
        group_code: groupCode,
        group_seed: groupSeed ? Number(groupSeed) : null
      })
      .eq('id', teamId); // UUID-safe

    if (error) {
      msg('فشل الحفظ: ' + error.message, 'error');
      return;
    }

    msg('تم حفظ التوزيع بنجاح', 'success');
    await loadTeamsForTournament();
  });

  clearBtn.addEventListener('click', async () => {
    const teamId = teamSelect.value;
    if (!teamId) {
      msg('اختر الفريق أولاً', 'warning');
      return;
    }

    const { error } = await client
      .from(teamsTable)
      .update({ group_code: null, group_seed: null })
      .eq('id', teamId); // UUID-safe

    if (error) {
      msg('فشل إزالة التوزيع: ' + error.message, 'error');
      return;
    }

    document.getElementById('group-code').value = '';
    document.getElementById('seed-order').value = '';
    msg('تمت إزالة التوزيع', 'success');
    await loadTeamsForTournament();
  });

  refreshBtn.addEventListener('click', async () => {
    await loadTournaments();
    await loadTeamsForTournament();
    msg('تم تحديث الصفحة');
  });

  init();
})();