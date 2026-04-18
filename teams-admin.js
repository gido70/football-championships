(function () {
  const form = document.getElementById('team-form');
  const statusEl = document.getElementById('form-status');
  const bodyEl = document.getElementById('teams-body');
  const connectionEl = document.getElementById('teams-connection');
  const activeTournamentEl = document.getElementById('active-tournament-name');
  const totalCountEl = document.getElementById('teams-total-count');
  const tournamentSelect = document.getElementById('tournament-select');
  const resetBtn = document.getElementById('reset-form');
  const refreshBtn = document.getElementById('refresh-list');

  const teamsTable = 'teams';
  const tournamentsTable = 'tournaments';
  let client = null;
  let tournamentsMap = new Map();

  function msg(text, cls = '') {
    statusEl.className = 'status-line ' + cls;
    statusEl.textContent = text;
  }

  function readForm() {
    const fd = new FormData(form);
    return {
      name: (fd.get('name') || '').toString().trim(),
      short_name: (fd.get('short_name') || '').toString().trim() || null,
      logo_url: (fd.get('logo_url') || '').toString().trim() || null,
      color_primary: (fd.get('color_primary') || '').toString().trim() || null,
      color_secondary: (fd.get('color_secondary') || '').toString().trim() || null,
      notes: (fd.get('notes') || '').toString().trim() || null,
      tournament_id: fd.get('tournament_id') ? String(fd.get('tournament_id')) : null, // UUID-safe
      is_active: document.getElementById('is-active').checked
    };
  }

  function teamDisplayName(row) {
    return row.name || row.team_name || row.title || '';
  }

  async function loadTournaments() {
    tournamentSelect.innerHTML = '<option value="">اختر البطولة</option>';
    const { data, error } = await client
      .from(tournamentsTable)
      .select('id, name, season_label, is_active')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      activeTournamentEl.textContent = 'تعذر القراءة';
      msg('تعذر قراءة البطولات: ' + error.message, 'error');
      return;
    }

    tournamentsMap = new Map();
    let activeFound = false;

    (data || []).forEach(row => {
      tournamentsMap.set(String(row.id), row);
      const label = row.name + (row.season_label ? ' - ' + row.season_label : '');
      const option = document.createElement('option');
      option.value = String(row.id); // UUID-safe
      option.textContent = label;
      if (row.is_active && !activeFound) {
        option.selected = true;
        activeFound = true;
        activeTournamentEl.textContent = label;
      }
      tournamentSelect.appendChild(option);
    });

    if (!activeFound && data && data.length) {
      const first = data[0];
      tournamentSelect.value = String(first.id);
      activeTournamentEl.textContent = first.name + (first.season_label ? ' - ' + first.season_label : '');
    } else if (!data || !data.length) {
      activeTournamentEl.textContent = 'لا توجد بطولة';
    }
  }

  function renderRows(rows) {
    if (!rows || rows.length === 0) {
      bodyEl.innerHTML = '<tr><td colspan="5">لا توجد فرق حالياً</td></tr>';
      totalCountEl.textContent = '0';
      return;
    }

    totalCountEl.textContent = String(rows.length);

    bodyEl.innerHTML = rows.map(row => {
      const t = tournamentsMap.get(String(row.tournament_id));
      const tournamentLabel = t ? (t.name + (t.season_label ? ' - ' + t.season_label : '')) : (row.tournament_id ?? '');
      return `
        <tr>
          <td>${teamDisplayName(row)}</td>
          <td>${row.short_name ?? ''}</td>
          <td>${tournamentLabel}</td>
          <td>${row.is_active ? 'نعم' : 'لا'}</td>
          <td><button class="small-btn delete" data-id="${String(row.id)}">حذف</button></td>
        </tr>
      `;
    }).join('');

    bodyEl.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('هل تريد حذف هذا الفريق؟')) return;
        const { error } = await client.from(teamsTable).delete().eq('id', id); // UUID-safe
        if (error) {
          msg('فشل الحذف: ' + error.message, 'error');
          return;
        }
        msg('تم حذف الفريق بنجاح', 'success');
        loadRows();
      });
    });
  }

  async function loadRows() {
    bodyEl.innerHTML = '<tr><td colspan="5">جاري التحميل...</td></tr>';
    const { data, error } = await client
      .from(teamsTable)
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      bodyEl.innerHTML = `<tr><td colspan="5">تعذر القراءة: ${error.message}</td></tr>`;
      return;
    }

    renderRows(data || []);
  }

  async function init() {
    try {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

      const test = await client.from(teamsTable).select('id', { count: 'exact', head: true });
      if (test.error) {
        connectionEl.textContent = 'متصل لكن جدول teams غير جاهز';
        bodyEl.innerHTML = `<tr><td colspan="5">تعذر قراءة الفرق: ${test.error.message}</td></tr>`;
        return;
      }

      connectionEl.textContent = 'متصل';
      await loadTournaments();
      await loadRows();
    } catch (e) {
      connectionEl.textContent = 'خطأ في الربط';
      bodyEl.innerHTML = '<tr><td colspan="5">تعذر بدء الصفحة</td></tr>';
      console.error(e);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readForm();

    if (!payload.name) {
      msg('أدخل اسم الفريق أولاً', 'warning');
      return;
    }

    msg('جاري الحفظ...');
    const { error } = await client.from(teamsTable).insert(payload);

    if (error) {
      msg('فشل الحفظ: ' + error.message, 'error');
      return;
    }

    msg('تم حفظ الفريق بنجاح', 'success');
    form.reset();
    document.getElementById('is-active').checked = true;
    await loadTournaments();
    await loadRows();
  });

  resetBtn.addEventListener('click', async () => {
    form.reset();
    document.getElementById('is-active').checked = true;
    await loadTournaments();
    msg('تم تفريغ الحقول');
  });

  refreshBtn.addEventListener('click', async () => {
    await loadTournaments();
    await loadRows();
    msg('تم تحديث القائمة');
  });

  init();
})();