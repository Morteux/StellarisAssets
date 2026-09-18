const REPOSITORY = 'Morteux/StellarisAssets';
const BRANCH = 'main';
const API_URL = `https://api.github.com/repos/${REPOSITORY}/git/trees/${BRANCH}?recursive=1`;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

const state = { assets: [], tree: [], folder: '', query: '', sort: 'name' };
const $ = (s) => document.querySelector(s);

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function normalizePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function assetUrl(path) {
  return normalizePath(path);
}

function folderOf(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '(root)' : path.slice(0, i);
}

function filenameOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function renderFolders() {
  const counts = new Map();
  for (const asset of state.assets) {
    const folder = folderOf(asset.path);
    counts.set(folder, (counts.get(folder) || 0) + 1);
  }
  const folders = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  $('#folder-count').textContent = folders.length;
  const all = `<button class="folder-button ${state.folder === '' ? 'active' : ''}" data-folder=""><span class="folder-name">All assets</span><span class="folder-count">${state.assets.length}</span></button>`;
  $('#folders').innerHTML = all + folders.map(folder => `<button class="folder-button ${state.folder === folder ? 'active' : ''}" data-folder="${escapeHtml(folder)}"><span class="folder-name">▱ ${escapeHtml(folder)}</span><span class="folder-count">${counts.get(folder)}</span></button>`).join('');
  $('#folders').querySelectorAll('.folder-button').forEach(btn => btn.addEventListener('click', () => {
    state.folder = btn.dataset.folder;
    renderFolders();
    renderAssets();
  }));
}

function filteredAssets() {
  const q = state.query.trim().toLowerCase();
  let result = state.assets.filter(asset => {
    const folder = folderOf(asset.path);
    if (state.folder && folder !== state.folder) return false;
    if (!q) return true;
    return asset.path.toLowerCase().includes(q);
  });
  result.sort((a, b) => {
    if (state.sort === 'folder') return folderOf(a.path).localeCompare(folderOf(b.path)) || filenameOf(a.path).localeCompare(filenameOf(b.path));
    return filenameOf(a.path).localeCompare(filenameOf(b.path)) || a.path.localeCompare(b.path);
  });
  return result;
}

function copyText(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const old = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = old; }, 1000);
  });
}

function openLightbox(asset) {
  const url = new URL(assetUrl(asset.path), document.baseURI).href;
  $('#lightbox-image').src = url;
  $('#lightbox-image').alt = filenameOf(asset.path);
  $('#lightbox-name').textContent = asset.path;
  $('#lightbox-copy').onclick = () => copyText(url, $('#lightbox-copy'));
  $('#lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  $('#lightbox').hidden = true;
  $('#lightbox-image').src = '';
  document.body.style.overflow = '';
}

function renderAssets() {
  const assets = filteredAssets();
  $('#result-count').textContent = `${assets.length.toLocaleString()} asset${assets.length === 1 ? '' : 's'}`;
  $('#status').style.display = assets.length ? 'none' : 'block';
  $('#status').textContent = state.query ? 'No matching assets.' : 'No assets in this folder.';

  const groups = new Map();
  for (const asset of assets) {
    const folder = folderOf(asset.path);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(asset);
  }

  const html = [...groups.entries()].map(([folder, items]) => `
    <section class="asset-group">
      <div class="group-header"><h2>${escapeHtml(folder)}</h2><span>${items.length}</span></div>
      <div class="asset-grid">
        ${items.map(asset => {
          const name = filenameOf(asset.path);
          const url = assetUrl(asset.path);
          return `<article class="asset-card">
            <button class="thumb-button" type="button" data-preview="${escapeHtml(asset.path)}" aria-label="Preview ${escapeHtml(name)}"><img class="thumb" loading="lazy" decoding="async" src="${url}" alt="${escapeHtml(name)}"></button>
            <div class="asset-info">
              <div class="asset-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
              <div class="asset-path" title="${escapeHtml(asset.path)}">${escapeHtml(asset.path)}</div>
              <div class="asset-actions">
                <a class="button open-link" href="${url}" target="_blank" rel="noreferrer">Open</a>
                <button class="button copy-button" type="button" data-copy="${escapeHtml(url)}">Copy URL</button>
              </div>
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>`).join('');

  $('#asset-groups').innerHTML = html;
  $('#asset-groups').querySelectorAll('[data-preview]').forEach(el => el.addEventListener('click', () => {
    const asset = state.assets.find(a => a.path === el.dataset.preview);
    if (asset) openLightbox(asset);
  }));
  $('#asset-groups').querySelectorAll('[data-copy]').forEach(el => el.addEventListener('click', () => copyText(new URL(el.dataset.copy, document.baseURI).href, el)));
}

async function init() {
  try {
    const response = await fetch(API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.truncated) console.warn('GitHub returned a truncated repository tree. Some assets may be missing.');
    state.assets = data.tree
      .filter(item => item.type === 'blob' && IMAGE_EXTENSIONS.test(item.path))
      .map(item => ({ path: item.path }));
    renderFolders();
    renderAssets();
  } catch (error) {
    console.error(error);
    $('#status').style.display = 'block';
    $('#status').textContent = 'Could not load the GitHub repository tree.';
  }
}

$('#search').addEventListener('input', e => { state.query = e.target.value; renderAssets(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; renderAssets(); });
$('#lightbox-close').addEventListener('click', closeLightbox);
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $('#search')) { e.preventDefault(); $('#search').focus(); }
  if (e.key === 'Escape') {\n    if (!$('#tree-modal').hidden) closeTreeModal();\n    else closeLightbox();\n  }
});
init();
