// Token Radar's page. It renders window.RADAR, which main.ts writes beside dashboard/ as data.js:
// the ranked board of pre-token protocols, the live-token market set aside, and the model constants.
// No framework, no fetch, no network: every number on screen comes from that one script.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA || !Array.isArray(DATA.rows)) return;

  var byId = function (id) { return document.getElementById(id); };
  var state = {
    q: '',
    category: 'all',
    sort: 'rank',
    dir: 1,
    tab: 'pre-token',
    selected: null
  };

  // ---------------------------------------------------------------- formatting

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function usd(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return money.format(n);
  }

  function pct(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : n < 0 ? '' : '') + n.toFixed(2) + '%';
  }

  function age(days) {
    if (typeof days !== 'number' || !isFinite(days)) return 'unknown';
    if (days >= 730) return (days / 365).toFixed(1) + ' yrs';
    if (days >= 365) return '1.0 yr';
    return Math.max(0, Math.round(days)) + ' days';
  }

  function tone(n) {
    if (typeof n !== 'number' || !isFinite(n) || n === 0) return 'flat';
    return n > 0 ? 'up' : 'down';
  }

  // ---------------------------------------------------------------- farm plan
  // The same derivation main.ts uses for board.json: the protocol's category, first chain, TVL and age
  // decide the action, the capital, the hold and every cost and time. No protocol name is special-cased.

  var BENCH = [
    { at: 5e9, capital: 250 },
    { at: 1e9, capital: 150 },
    { at: 1e8, capital: 100 },
    { at: 0, capital: 50 }
  ];

  function capital(row) {
    for (var i = 0; i < BENCH.length; i++) if (row.tvl_usd >= BENCH[i].at) return BENCH[i].capital;
    return 50;
  }

  function chain(row) {
    return row.chains && row.chains.length ? row.chains[0] : 'its main chain';
  }

  function holdDays(days) {
    if (typeof days !== 'number') return 30;
    if (days < 180) return 60;
    if (days < 365) return 45;
    return 30;
  }

  function action(row, stake, where) {
    var c = String(row.category || '').toLowerCase();
    var n = row.name;
    if (/(lend|cdp|collateral)/.test(c)) return 'Supply $' + stake + ' of USDC to ' + n + ' on ' + where + ' and leave it working.';
    if (/(dex|yield|leveraged farm|farm)/.test(c)) return 'Add $' + stake + ' of liquidity to ' + n + "'s deepest pool on " + where + '.';
    if (/bridge/.test(c)) return 'Move $' + stake + ' of USDC across to ' + where + ' through ' + n + ' and use it there.';
    if (/(staking|restak|liquid staking)/.test(c)) return 'Stake $' + stake + " of " + where + "'s staking asset through " + n + '.';
    if (/(perpetual|derivative|options)/.test(c)) return 'Post $' + stake + ' of USDC as margin on ' + n + ' and open one small hedge.';
    if (/prediction/.test(c)) return 'Fund $' + stake + ' on ' + n + ' and take one position you would hold a month.';
    if (/(curator|allocator|vault)/.test(c)) return 'Deposit $' + stake + ' into a ' + n + ' vault on ' + where + ' and keep the shares.';
    if (/stable/.test(c)) return 'Mint or deposit $' + stake + ' of the stable asset through ' + n + ' on ' + where + '.';
    if (/(rwa|real world)/.test(c)) return 'Mint $' + stake + " of the protocol's yield asset on " + where + ' and hold it.';
    if (/insurance/.test(c)) return 'Buy $' + stake + " of cover from " + n + ' on ' + where + '.';
    return 'Deposit $' + stake + ' of USDC into ' + n + ' on ' + where + ' and keep it there.';
  }

  function plan(row) {
    var stake = capital(row);
    var where = chain(row);
    var hold = holdDays(row.age_days);
    var gas = stake >= 150 ? 8 : 4;
    return [
      {
        text: 'Open a fresh wallet for this position only, funded with nothing but the capital you mean to farm.',
        cost: 'under $3 of gas', time: '5 min'
      },
      {
        text: action(row, stake, where),
        cost: '$' + stake + ' plus about $' + gas + ' of gas', time: '15 min'
      },
      {
        text: 'Do one countable thing every week: a deposit, a borrow, a swap or a vote.',
        cost: 'about $2 of gas a week', time: '10 min a week'
      },
      {
        text: 'Stay in for at least ' + hold + ' days so two snapshots see the position, not one.',
        cost: 'the $' + stake + ' stays put', time: hold + ' days'
      },
      {
        text: "Claim only from the rewards page the protocol itself publishes, and never pay to claim.",
        cost: 'no fee', time: '10 min'
      },
      {
        text: 'Keep a farm log: the wallet, the dates, every transaction, so you can repeat or unwind it.',
        cost: 'nothing', time: '5 min'
      }
    ];
  }

  // ---------------------------------------------------------------- model
  // The page recomputes each row from the snapshot's own figures, so the arithmetic on screen is the
  // arithmetic in board.json: TVL x learned multiple x growth x maturity.

  function recompute(row) {
    var m = DATA.model;
    var growth = typeof row.change_7d === 'number' ? row.change_7d : 0;
    growth = Math.min(m.growth_cap, Math.max(m.growth_floor, growth));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var days = typeof row.age_days === 'number' ? row.age_days : m.unknown_age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(days, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturity));
  }

  // ---------------------------------------------------------------- rows

  function visible() {
    var q = state.q.trim().toLowerCase();
    var list = DATA.rows.filter(function (row) {
      if (state.category !== 'all' && row.category !== state.category) return false;
      if (!q) return true;
      var hay = [row.name, row.slug, row.category || '', (row.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    var key = state.sort;
    var dir = state.dir;
    list.sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -1e9 : a.change_7d; bv = b.change_7d === null ? -1e9 : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'multiple') { av = a.multiple; bv = b.multiple; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
    return list;
  }

  function cell(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function drawBoard() {
    var body = byId('rows');
    var rows = visible();
    var top = rows.reduce(function (max, row) { return Math.max(max, row.implied_value_usd); }, 1);
    body.textContent = '';

    var frag = document.createDocumentFragment();
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.dataset.slug = row.slug;
      if (state.selected === row.slug) tr.className = 'is-selected';

      tr.appendChild(cell('td', 'num col-rank', String(row.rank)));

      var nameCell = cell('td', 'col-name');
      nameCell.appendChild(cell('span', 'name', row.name));
      var sub = (row.category || 'uncategorised') + ' · ' + (row.chains || []).slice(0, 3).join(', ');
      nameCell.appendChild(cell('span', 'sub', sub));
      tr.appendChild(nameCell);

      tr.appendChild(cell('td', 'num', usd(row.tvl_usd)));

      var change = cell('td', 'num ' + tone(row.change_7d), pct(row.change_7d));
      tr.appendChild(change);

      tr.appendChild(cell('td', 'num', age(row.age_days)));

      var valueCell = cell('td', 'num');
      var bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.width = Math.max(6, Math.round((row.implied_value_usd / top) * 46)) + 'px';
      valueCell.appendChild(bar);
      valueCell.appendChild(cell('span', 'value', usd(row.implied_value_usd)));
      tr.appendChild(valueCell);

      tr.appendChild(cell('td', 'num col-mult mult', row.multiple.toFixed(2) + 'x'));

      tr.addEventListener('click', function () { select(row.slug); });
      frag.appendChild(tr);
    });
    body.appendChild(frag);

    byId('empty').hidden = rows.length > 0;
    byId('count').textContent = rows.length + ' of ' + DATA.rows.length + ' pre-token rows';
  }

  function drawLive() {
    var body = byId('rows');
    body.textContent = '';
    var q = state.q.trim().toLowerCase();
    var rows = (DATA.live || []).filter(function (row) {
      if (!q) return true;
      return [row.name, row.slug, row.category || ''].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var frag = document.createDocumentFragment();
    rows.forEach(function (row, i) {
      var tr = document.createElement('tr');
      tr.appendChild(cell('td', 'num col-rank', String(i + 1)));

      var nameCell = cell('td', 'col-name');
      nameCell.appendChild(cell('span', 'name', row.name));
      nameCell.appendChild(cell('span', 'sub', (row.category || 'uncategorised') + ' · ' + (row.symbol ? row.symbol + ' trades' : 'token trades')));
      tr.appendChild(nameCell);

      tr.appendChild(cell('td', 'num', usd(row.tvl_usd)));
      tr.appendChild(cell('td', 'num ' + tone(row.change_7d), pct(row.change_7d)));
      tr.appendChild(cell('td', 'num', 'set aside'));
      tr.appendChild(cell('td', 'num value', usd(row.mcap_usd)));
      var ratio = row.mcap_usd && row.tvl_usd ? (row.mcap_usd / row.tvl_usd).toFixed(2) + 'x' : 'n/a';
      tr.appendChild(cell('td', 'num col-mult mult', ratio));
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    byId('empty').hidden = rows.length > 0;
    byId('count').textContent = rows.length + ' live-token protocols, set aside from the board';
  }

  // ---------------------------------------------------------------- detail

  function select(slug) {
    state.selected = state.selected === slug ? null : slug;
    if (!state.selected) {
      byId('detail').hidden = true;
      drawBoard();
      return;
    }
    var row = DATA.rows.filter(function (r) { return r.slug === state.selected; })[0];
    if (!row) return;
    drawDetail(row);
    byId('detail').hidden = false;
    drawBoard();
    remember();
  }

  function drawDetail(row) {
    var box = byId('detail-body');
    box.textContent = '';

    var head = document.createElement('div');
    head.className = 'd-head';
    head.appendChild(cell('h2', null, row.name));
    head.appendChild(cell('p', 'd-sub', 'rank ' + row.rank + ' of ' + DATA.rows.length + ' · ' + (row.category || 'uncategorised') + ' · ' + ((row.chains || []).join(', ') || 'chain not named')));
    box.appendChild(head);

    var valueBlock = document.createElement('div');
    valueBlock.className = 'd-value';
    valueBlock.appendChild(cell('b', null, usd(row.implied_value_usd)));
    valueBlock.appendChild(cell('span', null, 'implied value if the record stayed as it is'));
    box.appendChild(valueBlock);

    var facts = document.createElement('dl');
    facts.className = 'd-facts';
    var list = [
      ['TVL', usd(row.tvl_usd)],
      ['7-day', pct(row.change_7d)],
      ['No token for', age(row.age_days)]
    ];
    list.forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.appendChild(cell('dt', null, pair[0]));
      wrap.appendChild(cell('dd', null, pair[1]));
      facts.appendChild(wrap);
    });
    box.appendChild(facts);

    var math = document.createElement('section');
    math.className = 'd-section';
    math.appendChild(cell('h3', null, 'The model, line by line'));
    var eq = document.createElement('div');
    eq.className = 'math';
    var rowsEq = [
      ['TVL', usd(row.tvl_usd)],
      ['launch multiple, learned', row.multiple.toFixed(4) + 'x'],
      ['growth multiplier', row.growth_multiplier.toFixed(4) + 'x'],
      ['maturity multiplier', row.maturity_multiplier.toFixed(4) + 'x'],
      ['recomputed here', money.format(recompute(row))]
    ];
    rowsEq.forEach(function (pair, i) {
      var line = document.createElement('div');
      if (i === rowsEq.length - 1) line.className = 'result';
      line.appendChild(cell('span', null, pair[0]));
      line.appendChild(cell('span', null, pair[1]));
      eq.appendChild(line);
    });
    math.appendChild(eq);
    box.appendChild(math);

    var farm = document.createElement('section');
    farm.className = 'd-section';
    farm.appendChild(cell('h3', null, 'How to farm it'));
    var ol = document.createElement('ol');
    ol.className = 'plan';
    plan(row).forEach(function (step) {
      var li = document.createElement('li');
      li.appendChild(cell('p', null, step.text));
      var meta = document.createElement('div');
      meta.className = 'meta';
      var cost = cell('span', 'tag', step.cost);
      var time = cell('span', 'tag time', step.time);
      meta.appendChild(cost);
      meta.appendChild(time);
      li.appendChild(meta);
      ol.appendChild(li);
    });
    farm.appendChild(ol);
    box.appendChild(farm);

    var note = cell('p', 'd-note', 'This protocol records no token in the snapshot. That is what the record says, not proof the token does not exist. Implied value is a model, never a promise.');
    box.appendChild(note);
  }

  // ---------------------------------------------------------------- chrome

  function drawHero() {
    byId('pill-snapshot').textContent = 'snapshot ' + DATA.as_of;
    byId('pill-floor').textContent = 'floor ' + usd(DATA.floor_usd);
    byId('pill-model').textContent = DATA.model_version + ' model';

    byId('hero-title').textContent = DATA.watchlist_size + ' protocols record no token yet. Here is what a launch would be worth.';
    byId('hero-lede').textContent =
      'The watchlist is the floor, not the field: every protocol the snapshot carries with at least ' + usd(DATA.floor_usd) +
      ' of TVL and no token on record. The radar also scores ' + DATA.early_size + ' pre-token protocols below that floor.';

    var kpis = byId('kpis');
    kpis.textContent = '';
    [
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Rows ranked', String(DATA.board_size)],
      ['Early rows, below floor', String(DATA.early_size)],
      ['Live tokens set aside', String(DATA.live_size)]
    ].forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.className = 'kpi';
      wrap.appendChild(cell('dt', null, pair[0]));
      wrap.appendChild(cell('dd', null, pair[1]));
      kpis.appendChild(wrap);
    });

    byId('fine').textContent =
      'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · model ' + DATA.model_version +
      ', base multiple ' + DATA.model.base_multiple.toFixed(2) + 'x, growth weight ' + DATA.model.growth_weight +
      ', maturity ' + DATA.model.maturity_floor + ' to ' + (DATA.model.maturity_floor + DATA.model.maturity_range) +
      ' over ' + DATA.model.maturity_days + ' days.';
  }

  function drawCategories() {
    var selectEl = byId('category');
    var seen = {};
    DATA.rows.forEach(function (row) { seen[row.category || 'uncategorised'] = (seen[row.category || 'uncategorised'] || 0) + 1; });
    Object.keys(seen).sort().forEach(function (name) {
      var option = document.createElement('option');
      option.value = name;
      option.textContent = name + ' (' + seen[name] + ')';
      selectEl.appendChild(option);
    });
  }

  function setTab(tab) {
    state.tab = tab;
    byId('tab-pre').className = tab === 'pre-token' ? 'tab is-on' : 'tab';
    byId('tab-live').className = tab === 'live' ? 'tab is-on' : 'tab';
    byId('tab-pre').setAttribute('aria-selected', tab === 'pre-token' ? 'true' : 'false');
    byId('tab-live').setAttribute('aria-selected', tab === 'live' ? 'true' : 'false');
    if (tab === 'live') drawLive(); else drawBoard();
  }

  function sortBy(key) {
    if (state.sort === key) state.dir = -state.dir;
    else {
      state.sort = key;
      state.dir = key === 'name' || key === 'rank' ? 1 : -1;
    }
    Array.prototype.forEach.call(document.querySelectorAll('.board thead th'), function (th) {
      if (th.dataset.sort === key) th.setAttribute('aria-sort', state.dir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    drawBoard();
  }

  function wire() {
    byId('q').addEventListener('input', function (ev) { state.q = ev.target.value; drawBoard(); remember(); });
    byId('category').addEventListener('change', function (ev) { state.category = ev.target.value; drawBoard(); remember(); });
    byId('tab-pre').addEventListener('click', function () { setTab('pre-token'); remember(); });
    byId('tab-live').addEventListener('click', function () { setTab('live'); remember(); });
    byId('close').addEventListener('click', function () { select(state.selected); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') select(state.selected); });
    Array.prototype.forEach.call(document.querySelectorAll('.board thead th'), function (th) {
      th.addEventListener('click', function () { sortBy(th.dataset.sort); });
    });
  }

  // ---------------------------------------------------------------- links
  // The page is static, so a view is addressable by its hash: #p=<slug> opens that protocol,
  // #q= and #cat= pre-fill the filters, #tab=live shows the live-token market. Nothing is fetched.

  function remember() {
    var parts = [];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.selected) parts.push('p=' + encodeURIComponent(state.selected));
    if (state.tab === 'live') parts.push('tab=live');
    var next = parts.length ? '#' + parts.join('&') : '';
    try { window.history.replaceState(null, '', window.location.pathname + window.location.search + next); } catch (err) { /* a file:// page may refuse; the view still works */ }
  }

  function recall() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return { slug: null };
    var params = {};
    raw.split('&').forEach(function (pair) {
      var at = pair.indexOf('=');
      if (at > 0) params[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1));
    });
    if (params.q) { state.q = params.q; byId('q').value = params.q; }
    if (params.cat) state.category = params.cat;
    var slug = params.p || null;
    if (params.tab === 'live') state.tab = 'live';
    return { slug: slug };
  }

  drawHero();
  drawCategories();
  wire();
  var wanted = recall();
  var selectEl = byId('category');
  if (state.category !== 'all' && selectEl.querySelector('option[value="' + state.category.replace(/"/g, '') + '"]')) {
    selectEl.value = state.category;
  } else {
    state.category = 'all';
  }
  setTab(state.tab === 'live' ? 'live' : 'pre-token');
  if (wanted.slug) {
    state.selected = wanted.slug;
    var row = DATA.rows.filter(function (r) { return r.slug === wanted.slug; })[0];
    if (row) { drawDetail(row); byId('detail').hidden = false; drawBoard(); }
    else state.selected = null;
  }
})();
