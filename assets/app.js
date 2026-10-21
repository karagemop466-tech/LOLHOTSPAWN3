// time-zone rendering + client-side filtering (progressive enhancement only)
(function () {
  var tzSel = document.getElementById('fTz');
  function fmt(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function applyTz(mode) {
    document.querySelectorAll('.when[data-fmt="utc"]').forEach(function (el) {
      var card = el.closest('[data-utc]');
      if (!card) return;
      if (mode === 'local') { el.textContent = fmt(card.dataset.utc) + ' local'; }
      else { el.textContent = el.dataset.orig || el.textContent; }
    });
  }
  document.querySelectorAll('.when').forEach(function (el) { el.dataset.orig = el.textContent; });
  if (tzSel) tzSel.addEventListener('change', function () { applyTz(tzSel.value); });

  var q = document.getElementById('q'), fComp = document.getElementById('fComp'), fRes = document.getElementById('fRes');
  var list = document.getElementById('list'), count = document.getElementById('count');
  function filter() {
    if (!list) return;
    var term = (q && q.value || '').toLowerCase().trim();
    var comp = fComp && fComp.value, res = fRes && fRes.value, shown = 0;
    list.querySelectorAll('.match').forEach(function (el) {
      var ok = (!term || el.dataset.search.indexOf(term) > -1)
        && (!comp || el.dataset.comp === comp)
        && (!res || el.dataset.res === res);
      el.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (count) count.textContent = 'Showing ' + shown + ' matches';
  }
  [q, fComp, fRes].forEach(function (el) { if (el) el.addEventListener('input', filter); });
})();
