// Client-side filtering, sorting, and mobile card generation
function initTable(tableId, data, columns, cardRenderer){
  const table = document.getElementById(tableId);
  if(!table) return;
  const tbody = table.querySelector('tbody');
  const search = document.getElementById(tableId+'-search');
  const tierFilter = document.getElementById(tableId+'-tier');
  const statusFilter = document.getElementById(tableId+'-status');
  const tournamentFilter = document.getElementById(tableId+'-tournament');
  let filtered = [...data];
  let sortCol = null, sortAsc = true;

  function render(){
    // apply filters
    filtered = data.filter(r=>{
      const q = (search && search.value || '').toLowerCase();
      const tier = tierFilter && tierFilter.value;
      const status = statusFilter && statusFilter.value;
      const tour = tournamentFilter && tournamentFilter.value;
      let ok = true;
      if(q){
        const hay = `${r.team1} ${r.team2} ${r.tournament} ${r.tier} ${r.date_display}`.toLowerCase();
        ok = ok && hay.includes(q);
      }
      if(tier && tier!=='all') ok = ok && r.tier === tier;
      if(status && status!=='all'){
        if(status==='verified') ok = ok && r.verified;
        if(status==='unverified') ok = ok && !r.verified;
        if(status==='market') ok = ok && r.status && r.status.includes('Verified');
      }
      if(tour && tour!=='all') ok = ok && r.tournament===tour;
      return ok;
    });
    // sort
    if(sortCol){
      filtered.sort((a,b)=>{
        let av = a[sortCol], bv = b[sortCol];
        if(av==null) av=''; if(bv==null) bv='';
        if(typeof av==='number' && typeof bv==='number') return sortAsc ? av-bv : bv-av;
        av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
        if(av<bv) return sortAsc ? -1 : 1;
        if(av>bv) return sortAsc ? 1 : -1;
        return 0;
      });
    }
    // render table rows
    tbody.innerHTML = '';
    filtered.forEach(r=>{
      const tr = document.createElement('tr');
      let html = '';
      columns.forEach(col=>{
        let val = r[col.key];
        if(col.render) val = col.render(r);
        else if(val==null) val='';
        html += `<td data-label="${col.label}">${val}</td>`;
      });
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
    // update count
    const cnt = document.getElementById(tableId+'-count');
    if(cnt) cnt.textContent = `${filtered.length} matches`;
    // mobile cards
    const cardsEl = document.getElementById(tableId+'-cards');
    if(cardsEl && cardRenderer){
      cardsEl.innerHTML = '';
      filtered.forEach(r=>{
        const div = document.createElement('div');
        div.className='card';
        div.innerHTML = cardRenderer(r);
        cardsEl.appendChild(div);
      });
    }
  }
  // listeners
  if(search) search.addEventListener('input', render);
  if(tierFilter) tierFilter.addEventListener('change', render);
  if(statusFilter) statusFilter.addEventListener('change', render);
  if(tournamentFilter) tournamentFilter.addEventListener('change', render);
  table.querySelectorAll('th[data-sort]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const col = th.getAttribute('data-sort');
      if(sortCol===col) sortAsc=!sortAsc; else {sortCol=col; sortAsc=true;}
      render();
    });
  });
  render();
}

function pctBar(p1, p2){
  return `<div class="prob-bar" title="${p1}% vs ${p2}%">
    <span class="t1" style="width:${p1}%"></span>
    <span class="t2" style="width:${p2}%"></span>
  </div>`;
}
function tierBadge(t){
  const cls = (t||'').toLowerCase();
  return `<span class="badge ${cls}">${t} • ${t==='S'?'Tier S ×3':t==='A'?'Tier A ×2':t==='C'?'Tier C':'Tier '+t}</span>`;
}
