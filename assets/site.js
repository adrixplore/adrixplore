/* AdriXplore — scripts du site (aucune dépendance obligatoire ; Leaflet utilisé si les fonds de carte sont accessibles) */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const nf=n=>n.toLocaleString('fr-FR'), km=n=>String(Math.round(n*10)/10).replace('.',',');

/* ---------- menu mobile ---------- */
const tog=$('.nav-toggle');
if(tog) tog.addEventListener('click',()=>{const o=document.body.classList.toggle('nav-open');tog.setAttribute('aria-expanded',o)});

/* ---------- carrousels photo ---------- */
$$('.gallery').forEach(g=>{
  const track=$('.g-track',g), slides=$$('.g-slide',g), cnt=$('.g-count',g);
  if(slides.length<2){$$('.g-btn',g).forEach(b=>b.hidden=true); if(cnt)cnt.hidden=true; return}
  const idx=()=>Math.round(track.scrollLeft/track.clientWidth);
  const upd=()=>{if(cnt)cnt.textContent=(idx()+1)+' / '+slides.length};
  $('.g-prev',g).addEventListener('click',()=>track.scrollBy({left:-track.clientWidth,behavior:'smooth'}));
  $('.g-next',g).addEventListener('click',()=>track.scrollBy({left:track.clientWidth,behavior:'smooth'}));
  track.addEventListener('scroll',()=>requestAnimationFrame(upd),{passive:true}); upd();
});

/* ---------- copier l'e-mail ---------- */
$$('[data-copy]').forEach(b=>b.addEventListener('click',()=>{
  const t=b.dataset.copy, done=()=>{const o=b.textContent;b.textContent='Copié ✓';setTimeout(()=>b.textContent=o,1600)};
  try{navigator.clipboard.writeText(t).then(done,()=>{})}catch(e){}
}));

/* ---------- formulaire de contact (ouvre la messagerie) ---------- */
const form=$('#contact-form');
if(form) form.addEventListener('submit',e=>{
  e.preventDefault(); const f=new FormData(form);
  const body=`${f.get('message')}\n\n— ${f.get('nom')} (${f.get('email')})`;
  location.href=`mailto:contact.adrixplore@gmail.com?subject=${encodeURIComponent('Message AdriXplore – '+f.get('nom'))}&body=${encodeURIComponent(body)}`;
  $('#form-note').hidden=false;
});

/* ---------- données des itinéraires ---------- */
const needData=$('.route-viz,.region-map,.mini[data-route]');
if(!needData) return;

let tilesPromise;
function tilesOK(){ // teste si les fonds de carte se chargent (bloqués dans certains aperçus)
  if(tilesPromise) return tilesPromise;
  tilesPromise=new Promise(res=>{
    if(!window.L) return res(false);
    const i=new Image(), t=setTimeout(()=>res(false),3500);
    i.onload=()=>{clearTimeout(t);res(true)}; i.onerror=()=>{clearTimeout(t);res(false)};
    i.src='https://a.tile.opentopomap.org/9/265/187.png';
  });
  return tilesPromise;
}
function tileLayer(){return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'})}

function proj(points,W,H,pad){
  const lat0=points.reduce((a,p)=>a+p[0],0)/points.length, k=Math.cos(lat0*Math.PI/180);
  const xs=points.map(p=>p[1]*k), ys=points.map(p=>p[0]);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const s=Math.min((W-2*pad)/(maxx-minx||1),(H-2*pad)/(maxy-miny||1));
  const ox=(W-(maxx-minx)*s)/2, oy=(H-(maxy-miny)*s)/2;
  return p=>[ox+(p[1]*k-minx)*s, H-(oy+(p[0]-miny)*s)];
}
const pathD=(pts,f)=>'M'+pts.map(p=>f(p).map(v=>v.toFixed(1)).join(',')).join('L');
const nearest=(r,d)=>r.p.reduce((a,c)=>Math.abs(c[2]-d)<Math.abs(a[2]-d)?c:a);

fetch('assets/routes.json').then(r=>r.json()).then(async R=>{
  const byId=Object.fromEntries(R.map(r=>[r.id,r]));
  const ok=await tilesOK();

  /* mini-traces des cartes */
  $$('.mini[data-route]').forEach(el=>{const r=byId[el.dataset.route]; if(!r) return; const f=proj(r.p,300,150,16);
    el.innerHTML=`<svg viewBox="0 0 300 150" aria-hidden="true"><path d="${pathD(r.p,f)}" fill="none" stroke="var(--forest)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${f(r.p[0])[0]}" cy="${f(r.p[0])[1]}" r="5" fill="var(--sun)"/></svg>`});

  /* cartes par région (page Itinéraires) */
  const TOWNS={montpellier:[['Montpellier',43.611,3.877],['Saint-Mathieu-de-Tréviers',43.768,3.858],['Clermont-l’Hérault',43.627,3.432],['Frontignan',43.448,3.756],['Ganges',43.934,3.708]],
    marseille:[['Marseille',43.296,5.37],['Cassis',43.214,5.538]],pyrenees:[['Bagnères-de-Luchon',42.79,0.594]],
    lozere:[['Mende',44.518,3.5],['La Canourgue',44.431,3.215],['Florac',44.324,3.593],['Meyrueis',44.18,3.43]]};
  $$('.region-map').forEach(bm=>{
    const region=bm.dataset.region, rr=R.filter(r=>(r.region||'montpellier')===region);
    if(!rr.length){bm.hidden=true;return}
    const col=r=>r.diff==='soutenue'?'#C9822B':'#1F4D2B';
    if(ok){
      bm.classList.add('is-leaflet');
      const m=L.map(bm,{scrollWheelZoom:false,dragging:!L.Browser.mobile,zoomSnap:0.25}); tileLayer().addTo(m);
      const ls=rr.map(r=>{const l=L.polyline(r.p.map(p=>[p[0],p[1]]),{color:col(r),weight:4}).addTo(m)
        .bindPopup(`<b>${r.t}</b><br>${km(r.km)} km · ${nf(r.dp)} m D+<br><a href="${r.page}.html">Voir la fiche →</a>`);
        l.on('mouseover',()=>l.setStyle({weight:7})).on('mouseout',()=>l.setStyle({weight:4})); return l});
      const bb=L.featureGroup(ls).getBounds(), fit=()=>{m.invalidateSize();m.fitBounds(bb,{padding:[24,24]})};
      fit(); setTimeout(fit,300); window.addEventListener('load',fit);
      return;
    }
    const W=1100,H=region==='montpellier'?620:520, all=rr.flatMap(r=>r.p), towns=TOWNS[region]||[];
    const f=proj(all.concat(towns.map(t=>[t[1],t[2]])),W,H,48);
    let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte des itinéraires">`;
    const c=f(towns.length?[towns[0][1],towns[0][2]]:all[0]);
    for(let i=1;i<14;i++) s+=`<circle cx="${c[0]}" cy="${c[1]}" r="${i*48}" fill="none" stroke="var(--contour)"/>`;
    towns.forEach((t,i)=>{const [x,y]=f([t[1],t[2]]),mm=i===0;s+=`<circle cx="${x}" cy="${y}" r="${mm?6:3.5}" fill="var(--ink)"/><text x="${x+8}" y="${y+4}" font-size="${mm?17:13}" font-weight="${mm?600:400}" fill="var(--muted)">${t[0]}</text>`});
    rr.forEach(r=>{const d=pathD(r.p,f);s+=`<a href="${r.page}.html" data-id="${r.id}"><path d="${d}" fill="none" stroke="transparent" stroke-width="16"/><path class="tr" d="${d}" fill="none" stroke="${r.diff==='soutenue'?'var(--sun)':'var(--forest)'}" stroke-width="3" stroke-linejoin="round"/></a>`});
    bm.innerHTML=s+'</svg><div class="maptip" hidden></div>';
    const tip=$('.maptip',bm);
    $$('a[data-id]',bm).forEach(a=>{const r=byId[a.dataset.id];
      a.addEventListener('mousemove',e=>{const b=bm.getBoundingClientRect();tip.hidden=false;tip.textContent=`${r.t} · ${km(r.km)} km · ${nf(r.dp)} m D+`;
        tip.style.left=Math.max(4,Math.min(e.clientX-b.left+12,b.width-tip.offsetWidth-8))+'px';tip.style.top=(e.clientY-b.top-36)+'px';$('.tr',a).setAttribute('stroke-width','6')});
      a.addEventListener('mouseleave',()=>{tip.hidden=true;$('.tr',a).setAttribute('stroke-width','3')})});
  });

  /* fiches : trace + profil + GPX */
  $$('.route-viz').forEach(el=>{
    const r=byId[el.dataset.route]; if(!r) return;
    const hi=Math.max(...r.p.map(p=>p[3])), lo=Math.min(...r.p.map(p=>p[3]));
    el.innerHTML=`<div class="facts">
      <div class="fact"><span>Distance</span><b>${km(r.km)} km</b></div>
      <div class="fact"><span>Dénivelé +</span><b>${nf(r.dp)} m</b></div>
      <div class="fact"><span>Point haut</span><b>${nf(hi)} m</b></div>
      <div class="fact"><span>Type</span><b>${r.kind}</b></div>
      <div class="fact"><span>Difficulté</span><b>${r.diff}</b></div></div>
      <div class="viz-grid"><div class="panel"><h4>La trace</h4><div class="trace"></div></div>
      <div class="panel"><h4>Profil de dénivelé</h4><p class="readout">Survolez le profil pour suivre le parcours sur la trace.</p><div class="profile"></div>
      <div class="dl"><a class="btn" href="gpx/${r.id}.gpx" download>⬇ Télécharger le GPX</a>${r.komoot?`<a class="btn btn-ghost" href="${r.komoot}" target="_blank" rel="noopener">Voir sur Komoot</a>`:''}</div>
      <p class="small">Altitudes de ${nf(lo)} à ${nf(hi)} m. Trace enregistrée avec ma montre, à utiliser avec une carte et du bon sens.</p></div></div>`;
    const tr=$('.trace',el); let setPos;
    if(ok){
      tr.classList.add('is-leaflet');
      const m=L.map(tr,{scrollWheelZoom:false}); tileLayer().addTo(m);
      const line=L.polyline(r.p.map(p=>[p[0],p[1]]),{color:'#1F4D2B',weight:4}).addTo(m);
      L.circleMarker([r.p[0][0],r.p[0][1]],{radius:7,color:'#fff',weight:2,fillColor:'#C9822B',fillOpacity:1}).addTo(m).bindTooltip('Départ');
      const dot=L.circleMarker([r.p[0][0],r.p[0][1]],{radius:7,color:'#fff',weight:2,fillColor:'#1F4D2B',fillOpacity:1,opacity:0,fillOpacity:0}).addTo(m);
      m.fitBounds(line.getBounds(),{padding:[20,20]});
      setPos=p=>{dot.setLatLng([p[0],p[1]]);dot.setStyle({opacity:1,fillOpacity:1})};
    } else {
      const lat0=r.p[0][0]*Math.PI/180, xs=r.p.map(p=>p[1]*Math.cos(lat0)), ys=r.p.map(p=>p[0]);
      const asp=(Math.max(...ys)-Math.min(...ys))/((Math.max(...xs)-Math.min(...xs))||1);
      const W=420,H=Math.round(Math.min(420,Math.max(230,370*asp+52))),f=proj(r.p,W,H,26);
      let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trace de ${r.t}"><path d="${pathD(r.p,f)}" fill="none" stroke="var(--moss-soft)" stroke-width="10" stroke-linejoin="round"/><path d="${pathD(r.p,f)}" fill="none" stroke="var(--forest)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      for(let k=1;k<r.km;k+=r.km>12?2:1){const [x,y]=f(nearest(r,k));s+=`<circle cx="${x}" cy="${y}" r="4.5" fill="var(--panel)" stroke="var(--forest)" stroke-width="1.5"/><text x="${x+7}" y="${y-5}" font-size="11" fill="var(--muted)">${k}</text>`}
      const [sx,sy]=f(r.p[0]); s+=`<circle cx="${sx}" cy="${sy}" r="7" fill="var(--sun)" stroke="var(--panel)" stroke-width="2.5"/><circle class="dot" r="7" fill="var(--forest)" stroke="var(--panel)" stroke-width="2.5" cx="-20" cy="-20"/></svg>`;
      tr.innerHTML=s; const dot=$('.dot',tr);
      setPos=p=>{const [x,y]=f(p);dot.setAttribute('cx',x);dot.setAttribute('cy',y)};
    }
    // profil
    const PW=Math.round(Math.max(340,Math.min(760,el.clientWidth-30||640))),PH=230,ml=44,mr=12,mt=14,mb=30,tot=r.p[r.p.length-1][2];
    const span=Math.max(hi-lo,40); const ylo=Math.floor((lo-span*.1)/10)*10, yhi=Math.ceil((hi+span*.15)/10)*10;
    const X=d=>ml+d/tot*(PW-ml-mr), Y=a=>PH-mb-(a-ylo)/(yhi-ylo)*(PH-mt-mb);
    let g=`<svg viewBox="0 0 ${PW} ${PH}" class="psvg" role="img" aria-label="Profil de dénivelé">`;
    const step=(yhi-ylo)>300?100:(yhi-ylo)>120?50:10;
    for(let a=Math.ceil(ylo/step)*step;a<=yhi;a+=step) g+=`<line x1="${ml}" x2="${PW-mr}" y1="${Y(a)}" y2="${Y(a)}" stroke="var(--line)"/><text x="${ml-6}" y="${Y(a)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${a}</text>`;
    const ks=tot>12?5:tot>6?2:1; for(let k=0;k<=tot;k+=ks) g+=`<text x="${X(k)}" y="${PH-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${k} km</text>`;
    const line=r.p.map((p,i)=>(i?'L':'M')+X(p[2]).toFixed(1)+','+Y(p[3]).toFixed(1)).join('');
    g+=`<path d="${line}L${X(tot)},${PH-mb}L${ml},${PH-mb}Z" fill="var(--moss-soft)"/><path d="${line}" fill="none" stroke="var(--forest)" stroke-width="2.5"/>`;
    g+=`<line class="cross" y1="${mt}" y2="${PH-mb}" stroke="var(--sun)" stroke-width="1.5" x1="-9" x2="-9"/><circle class="pdot" r="5" fill="var(--sun)" cx="-9" cy="-9"/><rect x="${ml}" y="0" width="${PW-ml-mr}" height="${PH}" fill="transparent" class="hit"/></svg>`;
    const pr=$('.profile',el); pr.innerHTML=g;
    const svg=$('svg',pr), cross=$('.cross',pr), pdot=$('.pdot',pr), ro=$('.readout',el);
    const move=e=>{const b=svg.getBoundingClientRect();const cx=((e.touches?e.touches[0].clientX:e.clientX)-b.left)/b.width*PW;
      const p=nearest(r,Math.max(0,Math.min(tot,(cx-ml)/(PW-ml-mr)*tot)));
      cross.setAttribute('x1',X(p[2]));cross.setAttribute('x2',X(p[2]));pdot.setAttribute('cx',X(p[2]));pdot.setAttribute('cy',Y(p[3]));
      setPos(p); ro.innerHTML=`Km <b>${km(p[2])}</b> · altitude <b>${nf(p[3])} m</b>`};
    const hit=$('.hit',pr); ['mousemove','touchstart','touchmove'].forEach(ev=>hit.addEventListener(ev,move,{passive:true}));
  });
}).catch(()=>{});
})();

/* ---------- treks : carte d'ensemble + profil de chaque jour ---------- */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const nf=n=>n.toLocaleString('fr-FR'), km=n=>String(Math.round(n*10)/10).replace('.',',');
const els=$$('.trek-viz,.day-viz'); if(!els.length) return;
const id=els[0].dataset.trek;
const COLS=['var(--forest)','var(--moss)'];
function proj(points,W,H,pad){
  const lat0=points.reduce((a,p)=>a+p[0],0)/points.length, k=Math.cos(lat0*Math.PI/180);
  const xs=points.map(p=>p[1]*k), ys=points.map(p=>p[0]);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const s=Math.min((W-2*pad)/(maxx-minx||1),(H-2*pad)/(maxy-miny||1));
  const ox=(W-(maxx-minx)*s)/2, oy=(H-(maxy-miny)*s)/2;
  return p=>[ox+(p[1]*k-minx)*s, H-(oy+(p[0]-miny)*s)];
}
const pathD=(pts,f)=>'M'+pts.map(p=>f(p).map(v=>v.toFixed(1)).join(',')).join('L');
function aspect(pts){const k=Math.cos(pts[0][0]*Math.PI/180),xs=pts.map(p=>p[1]*k),ys=pts.map(p=>p[0]);return (Math.max(...ys)-Math.min(...ys))/((Math.max(...xs)-Math.min(...xs))||1)}
function tilesOK(){return new Promise(res=>{if(!window.L)return res(false);const i=new Image(),t=setTimeout(()=>res(false),3500);i.onload=()=>{clearTimeout(t);res(true)};i.onerror=()=>{clearTimeout(t);res(false)};i.src='https://a.tile.opentopomap.org/9/265/187.png'})}

/* profil générique : series = [{p:[[lat,lng,km,alt]...], n}] mis bout à bout */
function profile(el,series,onMove,opts={}){
  const PW=Math.round(Math.max(340,Math.min(900,el.clientWidth||640))),PH=Math.round((opts.h||200)*(PW<500?1.15:1)),ml=44,mr=10,mt=12,mb=26;
  let off=0; const flat=[]; const bounds=[];
  series.forEach(s=>{bounds.push([off,s.n]);s.p.forEach(p=>flat.push([p[0],p[1],off+p[2],p[3],s.n,p[2]]));off+=s.p[s.p.length-1][2]});
  const tot=off, al=flat.map(p=>p[3]); const lo0=Math.min(...al),hi0=Math.max(...al),span=Math.max(hi0-lo0,40);
  const lo=Math.max(lo0>=0?0:-1e9,Math.floor((lo0-span*.08)/50)*50), hi=Math.ceil((hi0+span*.12)/50)*50;
  const X=d=>ml+d/tot*(PW-ml-mr), Y=a=>PH-mb-(a-lo)/(hi-lo)*(PH-mt-mb);
  let g=`<svg viewBox="0 0 ${PW} ${PH}" class="psvg" role="img" aria-label="Profil de dénivelé">`;
  const step=(hi-lo)>1200?500:(hi-lo)>500?200:(hi-lo)>200?100:50;
  for(let a=Math.ceil(lo/step)*step;a<=hi;a+=step) g+=`<line x1="${ml}" x2="${PW-mr}" y1="${Y(a)}" y2="${Y(a)}" stroke="var(--line)"/><text x="${ml-6}" y="${Y(a)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${nf(a)}</text>`;
  if(series.length>1){
    bounds.forEach(([o,n],i)=>{const x2=i<bounds.length-1?bounds[i+1][0]:tot;
      g+=`<rect x="${X(o)}" y="${mt}" width="${X(x2)-X(o)}" height="${PH-mt-mb}" fill="${i%2?'var(--contour)':'transparent'}"/><text x="${(X(o)+X(x2))/2}" y="${PH-9}" text-anchor="middle" font-size="10.5" fill="var(--muted)">J${n}</text>`});
  } else {
    const ks=tot>15?5:tot>6?2:1; for(let k=0;k<=tot;k+=ks) g+=`<text x="${X(k)}" y="${PH-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${k} km</text>`;
  }
  const line=flat.map((p,i)=>(i?'L':'M')+X(p[2]).toFixed(1)+','+Y(p[3]).toFixed(1)).join('');
  g+=`<path d="${line}L${X(tot)},${PH-mb}L${ml},${PH-mb}Z" fill="var(--moss-soft)" opacity=".9"/><path d="${line}" fill="none" stroke="var(--forest)" stroke-width="2"/>`;
  g+=`<line class="cross" y1="${mt}" y2="${PH-mb}" stroke="var(--sun)" stroke-width="1.5" x1="-9" x2="-9"/><circle class="pdot" r="5" fill="var(--sun)" cx="-9" cy="-9"/><rect x="${ml}" y="0" width="${PW-ml-mr}" height="${PH}" fill="transparent" class="hit"/></svg>`;
  el.innerHTML=g;
  const svg=$('svg',el),cross=$('.cross',el),pdot=$('.pdot',el);
  const move=e=>{const b=svg.getBoundingClientRect();const cx=((e.touches?e.touches[0].clientX:e.clientX)-b.left)/b.width*PW;
    const d=Math.max(0,Math.min(tot,(cx-ml)/(PW-ml-mr)*tot));const p=flat.reduce((a,c)=>Math.abs(c[2]-d)<Math.abs(a[2]-d)?c:a);
    cross.setAttribute('x1',X(p[2]));cross.setAttribute('x2',X(p[2]));pdot.setAttribute('cx',X(p[2]));pdot.setAttribute('cy',Y(p[3]));onMove(p)};
  const hit=$('.hit',el);['mousemove','touchstart','touchmove'].forEach(ev=>hit.addEventListener(ev,move,{passive:true}));
  if(opts.onClick) hit.addEventListener('click',e=>{const b=svg.getBoundingClientRect();const d=((e.clientX-b.left)/b.width*PW-ml)/(PW-ml-mr)*tot;const s=bounds.filter(x=>x[0]<=d).pop();if(s)opts.onClick(s[1])});
}

fetch(`assets/treks/${id}.json`).then(r=>r.json()).then(async T=>{
  const ok=await tilesOK();
  const all=T.days.flatMap(d=>d.p);
  const goDay=n=>{const t=document.getElementById('jour-viz-'+n);if(t)t.scrollIntoView({behavior:'smooth',block:'center'})};

  /* vue d'ensemble */
  $$('.trek-viz').forEach(el=>{
    el.innerHTML=`<div class="facts">
      <div class="fact"><span>Jours de marche</span><b>${T.days.length}</b></div>
      <div class="fact"><span>Distance</span><b>${nf(Math.round(T.km))} km</b></div>
      <div class="fact"><span>Dénivelé +</span><b>${nf(T.dp)} m</b></div>
      <div class="fact"><span>Point haut</span><b>${nf(T.hi)} m</b></div></div>
      <div class="panel trek-map-panel"><div class="trek-map"></div><p class="small trek-legend">Chaque couleur correspond à un jour : cliquez sur une étape pour aller à son récit.</p></div>
      <div class="panel"><h4>Profil de tout le parcours</h4><p class="readout">Survolez le profil pour suivre le parcours jour après jour.</p><div class="profile"></div>
      <div class="dl"><a class="btn" href="gpx/${T.id}.gpx" download>⬇ GPX complet</a></div></div>`;
    const mp=$('.trek-map',el); let setPos;
    if(ok){
      mp.classList.add('is-leaflet'); const m=L.map(mp,{scrollWheelZoom:false}); L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)'}).addTo(m);
      const ls=T.days.map((d,i)=>L.polyline(d.p.map(p=>[p[0],p[1]]),{color:i%2?'#6E8B2E':'#1F4D2B',weight:4}).addTo(m).bindTooltip(`Jour ${d.n} · ${km(d.km)} km · ${nf(d.dp)} m D+`,{sticky:true}).on('click',()=>goDay(d.n)));
      m.fitBounds(L.featureGroup(ls).getBounds(),{padding:[20,20]});
      const dot=L.circleMarker(all[0].slice(0,2),{radius:7,color:'#fff',weight:2,fillColor:'#B9731F',fillOpacity:1}).addTo(m);
      setPos=p=>dot.setLatLng([p[0],p[1]]);
    } else {
      const W=560,H=Math.round(Math.min(720,Math.max(300,500*aspect(all)+60))),f=proj(all,W,H,28);
      let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carte du ${T.title}">`;
      T.days.forEach((d,i)=>{const dd=pathD(d.p,f);s+=`<a href="#jour-viz-${d.n}" data-n="${d.n}"><path d="${dd}" fill="none" stroke="transparent" stroke-width="14"/><path class="tr" d="${dd}" fill="none" stroke="${COLS[i%2]}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></a>`});
      T.days.forEach(d=>{const [x,y]=f(d.p[0]);s+=`<circle cx="${x}" cy="${y}" r="9" fill="var(--panel)" stroke="var(--forest)" stroke-width="1.5"/><text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--forest)">${d.n}</text>`});
      const e=f(all[all.length-1]);s+=`<circle cx="${e[0]}" cy="${e[1]}" r="6" fill="var(--sun)"/><circle class="dot" r="7" fill="var(--sun)" stroke="var(--panel)" stroke-width="2.5" cx="-20" cy="-20"/></svg>`;
      mp.innerHTML=s; const dot=$('.dot',mp);
      $$('a[data-n]',mp).forEach(a=>a.addEventListener('click',e=>{e.preventDefault();goDay(+a.dataset.n)}));
      setPos=p=>{const [x,y]=f(p);dot.setAttribute('cx',x);dot.setAttribute('cy',y)};
    }
    const ro=$('.readout',el);
    profile($('.profile',el),T.days,p=>{setPos(p);ro.innerHTML=`Jour <b>${p[4]}</b> · km <b>${km(p[5])}</b> · altitude <b>${nf(p[3])} m</b>`},{h:220,onClick:goDay});
  });

  /* un bloc par jour */
  $$('.day-viz').forEach(el=>{
    const d=T.days.find(x=>x.n===+el.dataset.day); if(!d) return;
    el.id='jour-viz-'+d.n;
    const stats=el.dataset.nostats?'' :`<span><b>${km(d.km)}</b> km</span><span><b>${nf(d.dp)}</b> m D+</span><span><b>${nf(d.dm)}</b> m D−</span>`;
    el.innerHTML=`<div class="day-head"><span class="day-chip">Jour ${d.n}</span>${d.name?`<span class="day-name">${d.name}</span>`:""}${stats||`<span><b>${km(d.km)}</b> km</span>`}<span>point haut <b>${nf(d.hi)}</b> m</span><a class="day-gpx" href="gpx/${T.id}-jour-${d.n}.gpx" download>GPX</a></div>
      <div class="day-grid"><div class="day-map"></div><div><div class="profile"></div><p class="readout small"></p></div></div>`;
    const W=200,H=200,f=proj(d.p,W,H,22);
    let s=`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${pathD(all,f)}" fill="none" stroke="var(--line)" stroke-width="3"/><path d="${pathD(d.p,f)}" fill="none" stroke="var(--forest)" stroke-width="3.5" stroke-linecap="round"/>`;
    const [x0,y0]=f(d.p[0]); s+=`<circle cx="${x0}" cy="${y0}" r="4" fill="var(--sun)"/><circle class="dot" r="5" fill="var(--sun)" stroke="var(--panel)" stroke-width="2" cx="-20" cy="-20"/></svg>`;
    const mp=$('.day-map',el); mp.innerHTML=s; const dot=$('.dot',mp), ro=$('.readout',el);
    profile($('.profile',el),[d],p=>{const [x,y]=f(p);dot.setAttribute('cx',x);dot.setAttribute('cy',y);ro.innerHTML=`km <b>${km(p[5])}</b> · altitude <b>${nf(p[3])} m</b>`},{h:150});
  });
}).catch(()=>{});
})();

(function(){document.querySelectorAll('canvas.topo').forEach(function(c){
  var dpr=Math.min(2,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;c.width=w*dpr;c.height=h*dpr;
  var x=c.getContext('2d');x.scale(dpr,dpr);x.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--contour').trim()||'rgba(31,77,43,.1)';x.lineWidth=1.2;
  var seed=(location.pathname.length*7)%13;
  function fz(px,py){return Math.sin(px*.006+seed+Math.cos(py*.004)*1.6)*Math.cos(py*.007-px*.002)+Math.sin((px+py)*.003+seed)*.6}
  for(var lev=-1.4;lev<1.6;lev+=.18){x.beginPath();
    for(var py=0;py<h;py+=6)for(var px=0;px<w;px+=6){var a=fz(px,py)-lev,b=fz(px+6,py)-lev,d=fz(px,py+6)-lev,t;
      if(a*b<0){t=a/(a-b);x.moveTo(px+t*6,py);x.lineTo(px+t*6+.8,py+.8)} if(a*d<0){t=a/(a-d);x.moveTo(px,py+t*6);x.lineTo(px+.8,py+t*6+.8)}}
    x.stroke()}
})})();
