// Instant search and filter for picks
function filterPicks(category, btn) {
  if (btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const cards = document.querySelectorAll('.match-card');
  const rows = document.querySelectorAll('.match-row');

  function matchesFilter(method, text) {
    const textMatch = !q || text.includes(q);
    if (!textMatch) return false;
    if (category === 'all') return true;
    if (category === 'market') return method.startsWith('MARKET_');
    if (category === 'model') return method.startsWith('MODEL_');
    if (category === 'unresolved') return method === 'UNRESOLVED';
    return true;
  }

  cards.forEach(card => {
    const method = card.getAttribute('data-method') || '';
    const text = card.textContent.toLowerCase();
    card.style.display = matchesFilter(method, text) ? '' : 'none';
  });

  rows.forEach(row => {
    const method = row.getAttribute('data-method') || '';
    const text = row.textContent.toLowerCase();
    row.style.display = matchesFilter(method, text) ? '' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('input', () => {
      const activeBtn = document.querySelector('.filter-btn.active');
      const cat = activeBtn ? activeBtn.getAttribute('data-cat') : 'all';
      filterPicks(cat);
    });
  }
});
