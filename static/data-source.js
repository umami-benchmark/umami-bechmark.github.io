'use strict';
// One rendering layer serves the local API and an uploadable public-data snapshot.
window.DashboardData = (() => {
 const isStatic = document.documentElement.dataset.source === 'static';
 const assetUrl = path => new URL(path.replace(/^\//, ''), document.baseURI).href;
 const casefold = value => String(value).toLowerCase().replace(/ß/g,'ss').replace(/ς/g,'σ');
 let catalogPromise;
 async function fetchJSON(path) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
 }
 function catalog() {
  if (!catalogPromise) catalogPromise = fetchJSON('downloads/food_catalog.json').catch(error => {
   catalogPromise = undefined; // A failed first download must remain retryable.
   throw error;
  });
  return catalogPromise;
 }
 function catalogRows(data, params) {
  const q = casefold(params.get('q') || '').trim();
  const words=q.split(/[^\p{L}\p{N}]+/u).filter(w=>w&&!['a','an','the','with','and','of','in'].includes(w));
  const category = params.get('category') || '', profile = params.get('profile') || 'all';
  const sort = params.get('sort') || 'food_code', direction = params.get('direction') || 'asc';
  const offset = Number(params.get('offset') || 0), limit = Number(params.get('limit') || 50);
  const fields = new Set(['food_code','name','category',...data.metadata.nutrients.map(n=>n.key)]);
  if (q.length > 200 || category.length > 200 || !fields.has(sort) ||
      !['all','available','missing'].includes(profile) || !['asc','desc'].includes(direction) ||
      !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
   throw new Error('Invalid catalog query');
  const rows = data.rows.filter(row => (!q || words.every(w=>casefold([row.food_code,row.name,row.category || ''].join(' ')).includes(w))) &&
   (!category || row.category === category) && (profile === 'all' || row.has_profile === (profile === 'available')));
  const value = row => {
   const item = ['food_code','name','category'].includes(sort) ? row[sort] : row.nutrients[sort];
   return typeof item === 'string' ? casefold(item) : item;
  };
  const compare = (a,b) => a === b ? 0 : a < b ? -1 : 1;
  const present = rows.filter(row=>value(row)!==null), missing = rows.filter(row=>value(row)===null);
  present.sort((a,b)=>(compare(value(a),value(b)) || compare(a.food_code,b.food_code)) * (direction==='desc'?-1:1));
  const ordered = present.concat(missing); // Missing values stay last in both directions.
  return {rows:ordered.slice(offset,offset+limit),total:rows.length,offset,limit};
 }
 async function get(path) {
  if (!isStatic) return fetchJSON(path);
  const request = new URL(path, 'https://dashboard.invalid');
  if (request.pathname === '/api/benchmark') return fetchJSON('downloads/benchmark.json');
  if (request.pathname === '/api/catalog/metadata') return (await catalog()).metadata;
  if (request.pathname === '/api/catalog/rows') return catalogRows(await catalog(),request.searchParams);
  if (request.pathname.startsWith('/api/catalog/food/')) {
   const code = decodeURIComponent(request.pathname.slice('/api/catalog/food/'.length));
   const row = (await catalog()).rows.find(item=>item.food_code===code);
   if (!row) throw new Error('Food code not found');
   return row;
  }
  throw new Error('Data request unavailable');
 }
 return {get,assetUrl};
})();
