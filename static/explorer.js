'use strict';
// Public, finite examples and images. Uploaded pixels stay in the browser.
window.Explorer = (() => {
 let data, selected='vqa-1', request=0;
 const taskNames={vqa:'Question answering',recommendation:'Recommendation',substitution:'Substitution'};
 const taskSelection={}, modelSelection={};
 const descriptors=new Map();
 const catalogPhotos=()=>data.photos.filter(p=>p.catalog_visible);
 const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const asset=p=>DashboardData.assetUrl(p);
 const photo=id=>data?.photos.find(p=>p.id===id);
 const byFood=code=>data?.photos.find(p=>p.food_code===String(code));
 function thumbnail(code){const p=byFood(code);return p?`<span class="photo-thumb"><img src="${asset(p.src)}" alt="${html(p.name)}" loading="lazy"></span>`:'';}
 function photoHTML(p){return `<div class="food-photo"><img src="${asset(p.src)}" alt="Image assigned to ${html(p.name)}" loading="lazy"></div>`;}
 function credit(p){const source=p.source_url?`<a href="${html(p.source_url)}" target="_blank" rel="noopener">Source</a>`:'Source not recorded';const rights=p.license_url?`<a href="${html(p.license_url)}" target="_blank" rel="noopener">${html(p.license)}</a>`:html(p.license);return `${html(p.credit)} · ${source} · ${rights}`;}
 function details(code){const p=byFood(code);return p?`<div class="node-photo">${photoHTML(p)}<p class="credit">${credit(p)}</p><p class="muted small">${html(p.association)}</p></div>`:'<p class="muted small">No public photo is included for this food record.</p>';}
 function tiles(photos){return photos.map(p=>`<article class="photo-tile">${photoHTML(p)}<button class="food-button" data-node="${p.food_code}">${html(p.name)}</button><span class="code">${p.food_code}</span><details class="photo-credit"><summary>Image source</summary><p class="credit">${credit(p)}</p></details></article>`).join('');}
 function browser(){return `<section class="food-explorer"><div class="explorer-heading"><div><h3>Explore foods with photos</h3><p class="muted small">Browse photos and open food records. ${catalogPhotos().length} credited image–record examples are available.</p></div><a href="#scenarios">Try benchmark examples →</a></div><div class="image-search"><label for="photo-query" class="upload-button">Search by image <input id="photo-query" type="file" accept="image/jpeg,image/png,image/webp"></label><span class="small muted">Local appearance matching across these sample photos. This is not a food classifier.</span><button id="reset-photos" hidden>Reset images</button></div><p id="photo-status" class="small" role="status"></p><div id="photo-results" class="photo-grid">${tiles(catalogPhotos().slice(0,12))}</div><button id="more-photos" class="more-photos">Show all ${catalogPhotos().length} image examples</button></section>`;}
 function image(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('This image could not be opened. Try a JPEG, PNG or WebP file.'));im.src=url;});}
 function descriptor(im){
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,16,16);ctx.drawImage(im,0,0,16,16);
  const pixels=ctx.getImageData(0,0,16,16).data;const v=[];
  for(let i=0;i<pixels.length;i+=4)v.push(pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255);
  return v;
 }
 function filterPhotos(query){
  request++;
  const target=document.getElementById('photo-results');if(!target)return;
  const words=query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w&&!['a','an','the','with','and','of','in'].includes(w));
  const matches=catalogPhotos().filter(p=>words.every(w=>p.name.toLowerCase().includes(w)));
  target.innerHTML=matches.length?tiles(matches.slice(0,12)):'<p class="muted small">No sample photos match this description. Matching catalog records are listed below.</p>';
  document.getElementById('more-photos').hidden=!!query.trim();
  document.getElementById('photo-status').textContent='';document.getElementById('reset-photos').hidden=true;
 }
 async function bindBrowser(){
  const upload=document.getElementById('photo-query');if(!upload)return;
  document.getElementById('more-photos').onclick=e=>{document.getElementById('photo-results').innerHTML=tiles(catalogPhotos());e.target.hidden=true;};
  document.getElementById('reset-photos').onclick=()=>{request++;upload.value='';document.getElementById('photo-results').innerHTML=tiles(catalogPhotos().slice(0,12));document.getElementById('photo-status').textContent='';document.getElementById('more-photos').hidden=false;document.getElementById('reset-photos').hidden=true;};
  upload.onchange=async()=>{
   const file=upload.files[0];if(!file)return;
   const serial=++request;const status=document.getElementById('photo-status');let local;
   try{
    if(file.size>15*1024*1024)throw new Error('Choose an image smaller than 15 MB.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP image.');
    status.textContent='Comparing your image locally…';local=URL.createObjectURL(file);
    const v=descriptor(await image(local));
    const ranked=await Promise.all(catalogPhotos().map(async p=>{
     if(!descriptors.has(p.src))descriptors.set(p.src,image(asset(p.src)).then(descriptor).catch(e=>{descriptors.delete(p.src);throw e;}));
     const w=await descriptors.get(p.src);return {p,d:v.reduce((sum,x,i)=>sum+(x-w[i])**2,0)/v.length};
    }));
    if(serial!==request||!status.isConnected)return;
    ranked.sort((a,b)=>a.d-b.d);document.getElementById('photo-results').innerHTML=tiles(ranked.slice(0,8).map(x=>x.p));
    status.textContent='Closest sample photos by color and spatial appearance. Your file stayed in this browser; a match is not a verified food identity.';
    document.getElementById('more-photos').hidden=true;document.getElementById('reset-photos').hidden=false;
   }catch(e){if(serial===request&&status.isConnected)status.textContent=e.message;}
   finally{if(local)URL.revokeObjectURL(local);}
  };
 }
 function format(value){return typeof value==='object'?JSON.stringify(value):String(value??'No parsed answer');}
 function ruleHTML(r){return `<li>${html(r.nutrient_name||r.nutrient)} &lt; ${html(r.less_than??r.fail_if_at_least)} ${html(r.unit)} <span class="muted small">${html(r.basis)}</span></li>`;}
 function recordHTML(r){const nutrients=r.nutrients_per_serving||r.nutrients_per_100g||{};return `<article class="evidence-record"><h4>${html(r.entry||r.record_id||'')} · <button class="food-button" data-node="${r.food_code}">${html(r.name)}</button></h4><p class="muted small">${html(r.family||r.category||'')}${r.serving_grams?` · ${r.serving_grams} g per serving`:''}</p><dl>${Object.entries(nutrients).map(([name,n])=>`<div><dt>${html(name)}</dt><dd>${html(n.value)} ${html(n.unit)}</dd></div>`).join('')}</dl><p class="small muted">${r.nutrients_per_serving?'Per database serving':'Per 100 g'}</p></article>`;}
 function scenarios(){return `<div class="view-head"><div><h2>Benchmark examples</h2><p class="muted small">${data.scenarios.length} examples across three tasks · Saved model decisions</p></div><a href="#benchmark">Aggregate results →</a></div><p class="benchmark-note">Choose a task, explore an example, then compare the models’ saved answers. Paired examples change the food identity or personal context. These examples illustrate behavior, not overall performance.</p><div class="scenario-task-tabs" role="group" aria-label="Choose a task">${Object.entries(taskNames).map(([key,name])=>`<button data-example-task="${key}" aria-pressed="false">${name}<span>${data.scenarios.filter(s=>s.task===key).length} examples</span></button>`).join('')}</div><div id="example-navigation"></div><section id="scenario-body" aria-label="Selected example"></section>`;}
 function renderNavigation(s){
  const examples=data.scenarios.filter(x=>x.task===s.task), index=examples.findIndex(x=>x.id===s.id);
  document.querySelectorAll('[data-example-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exampleTask===s.task)));
  document.getElementById('example-navigation').innerHTML=`<div class="example-nav-heading"><p aria-live="polite">Example <strong>${index+1}</strong> of ${examples.length} <span class="muted">· Pair ${s.pair}, ${s.member==='A'?'first case':'paired case'}</span></p><div><button data-example-step="-1" ${index===0?'disabled':''} aria-label="Previous example">← Previous</button><button data-example-step="1" ${index===examples.length-1?'disabled':''} aria-label="Next example">Next →</button></div></div><div class="example-cards" role="group" aria-label="Choose an example">${examples.map((x,i)=>{const p=photo(x.cards[0].photo);return `<button data-example="${x.id}" aria-pressed="${x.id===s.id}"><img src="${asset(p.src)}" alt="" loading="lazy"><span><small>Example ${i+1} · Pair ${x.pair}${x.member}</small><strong>${html(x.title)}</strong><span>${html(p.name)}</span></span></button>`;}).join('')}</div>`;
  document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>chooseExample(b.dataset.example));
  document.querySelectorAll('[data-example-step]').forEach(b=>b.onclick=()=>chooseExample(examples[index+Number(b.dataset.exampleStep)].id));
 }
 function chooseExample(id){selected=id;const s=data.scenarios.find(x=>x.id===id);taskSelection[s.task]=id;renderNavigation(s);renderScenario();}
 function renderScenario(){
  const s=data.scenarios.find(x=>x.id===selected)||data.scenarios[0];selected=s.id;
 const answerName=value=>s.records?.find(r=>r.entry===value)?.name||'';
  document.getElementById('scenario-body').innerHTML=`<article class="scenario"><div class="model-picker"><h3>Compare models</h3><p class="small muted">Choose a model to see its answer for this example.</p><div class="model-buttons" role="group" aria-label="Choose a model">${s.models.map((m,i)=>`<button data-example-model="${i}" aria-pressed="false">${html(m.name)}</button>`).join('')}</div></div><div class="scenario-question"><span class="eyebrow">${html(s.task)} · TEST example</span><h3>${html(s.query)}</h3>${s.rules?`<ul class="scenario-rules">${s.rules.map(ruleHTML).join('')}</ul>`:''}</div><div class="scenario-layout"><section><h3>Food inputs <span class="muted small">Assigned identities shown for inspection</span></h3><div class="scenario-foods">${s.cards.map(c=>{const p=photo(c.photo),rowName=window.CATALOG_NAMES?.[c.food_code]||c.food_code;return `<article class="scenario-food" data-slot="${html(c.slot)}"><div class="slot-label">${html(c.slot)}</div>${p?photoHTML(p):'<div class="photo-unavailable">Evaluation photo<br>not distributed</div>'}<button class="food-button" data-node="${c.food_code}">${html(rowName)}</button>${s.task==='recommendation'?`<div class="small">${c.compliant?'Passes rules':'Fails rules'} · ${c.relevant?'Relevant':'Not observed as relevant'}</div>`:''}</article>`;}).join('')}</div></section><aside class="decision-panel"><h3 id="selected-model-name"></h3><div id="scenario-output" aria-live="polite"></div><div class="reference-answer"><span class="eyebrow">Reference answer</span><p>${html(format(s.gold))}${s.unit?' '+html(s.unit):''}</p>${answerName(s.gold)?`<p class="small">${html(answerName(s.gold))}</p>`:''}</div></aside></div><p class="benchmark-note">${html(s.explanation)}</p><details class="scenario-credits"><summary>Image sources</summary>${s.cards.map(c=>{const p=photo(c.photo);return `<p class="credit">${html(c.slot)} · ${credit(p)}</p>`;}).join('')}</details>${s.records?`<details class="evidence-panel"><summary>Inspect supplied nutrient records (${s.records.length})</summary><div class="record-grid">${s.records.map(recordHTML).join('')}</div></details>`:''}<details><summary>Example provenance and scope</summary><p>${html(data.selection)} Model outputs are stored decisions for the listed image order. Recommendation examples show seed 0, not the three-seed mean. No new model was run for this viewer. Only parsed answers, rankings and food links are displayed.</p></details></article>`;
  const show=()=>{
   const m=s.models.find(m=>m.name===modelSelection[s.task])||s.models[0];modelSelection[s.task]=m.name;
   document.getElementById('selected-model-name').textContent=m.name;
   document.querySelectorAll('[data-example-model]').forEach(b=>b.setAttribute('aria-pressed',String(s.models[Number(b.dataset.exampleModel)].name===m.name)));
   const top=(m.ranking||[]).slice(0,2);
   document.getElementById('scenario-output').innerHTML=`<p class="small muted">${html(m.condition)}</p><span class="eyebrow">${m.ranking?'Selected top two':'Recorded answer'}</span><p class="model-answer">${html(m.ranking?top.join(' + '):format(m.answer))}${!m.ranking&&s.unit?' '+html(s.unit):''}</p>${answerName(m.answer)?`<p class="small">${html(answerName(m.answer))}</p>`:''}${m.ranking?`<ul class="selected-food-names">${top.map(slot=>{const card=s.cards.find(c=>c.slot===slot);return `<li>${html(slot)} · ${html(window.CATALOG_NAMES?.[card?.food_code]||card?.food_code)}</li>`;}).join('')}</ul><p class="small">Full ranking: ${m.ranking.map(html).join(' → ')}</p>${m.boundary_tie?'<p class="notice small">A tie crosses the top-two boundary. This is the saved order; benchmark metrics average over tie breaks.</p>':''}`:''}<p class="small">Response status: ${html(m.status)}</p>${Object.keys(m.links||{}).length?`<details><summary>Matched food records</summary><ul>${Object.entries(m.links).map(([slot,code])=>`<li>${html(slot)} → <button class="food-button" data-node="${html(code)}">${html(code)}</button></li>`).join('')}</ul></details>`:''}`;
   document.querySelectorAll('[data-slot]').forEach(card=>card.classList.toggle('model-selected',top.includes(card.dataset.slot)));
  };
  document.querySelectorAll('[data-example-model]').forEach(b=>b.onclick=()=>{modelSelection[s.task]=s.models[Number(b.dataset.exampleModel)].name;show();});show();
 }
 function bindScenarios(){document.querySelectorAll('[data-example-task]').forEach(b=>b.onclick=()=>chooseExample(taskSelection[b.dataset.exampleTask]||data.scenarios.find(s=>s.task===b.dataset.exampleTask).id));chooseExample(selected);}
 async function load(){const response=await fetch(asset('downloads/explorer.json'));if(!response.ok)throw new Error('Examples unavailable');data=await response.json();}
 document.addEventListener('click',e=>{const n=e.target.closest('[data-node]');if(n&&typeof openFood==='function')openFood(n.dataset.node);});
 return {load,thumbnail,details,browser,bindBrowser,filterPhotos,scenarios,bindScenarios};
})();
