// ---------- 素材共创库 ----------
async function api(url, options = {}) {
    const resp = await fetch(url, {
        headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        ...options,
    });
    return resp.json();
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadMaterials() {
    const data = await api('/api/materials');
    const grid = document.getElementById('material-grid');
    const empty = document.getElementById('material-empty');
    const count = document.getElementById('material-count');
    if (!data.ok) return;
    count.innerText = data.materials.length ? `（${data.materials.length} 张）` : '';
    grid.innerHTML = '';
    empty.classList.toggle('hidden', data.materials.length > 0);

    data.materials.forEach(m => {
        const html = `
        <div class="relative group rounded-2xl overflow-hidden shadow-md bg-white border-2 border-emerald-300">
            <img src="${m.src}" alt="${esc(m.title)}" loading="lazy" class="w-full h-48 object-cover">
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition p-4 text-center">
                <span class="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">${esc(m.author)} 上传</span>
                <p class="text-white font-bold text-sm mb-3">${esc(m.title)}</p>
                <div class="flex gap-2">
                    <a href="${m.src}" download class="bg-white text-emerald-800 px-4 py-2 rounded-full text-xs font-bold hover:scale-105 transition">
                        <i class="fas fa-download mr-1"></i>提取
                    </a>
                    ${m.mine || (window.CURRENT_USER && window.CURRENT_USER.is_admin) ? `
                    <button onclick="delMaterial(${m.id})" class="bg-rose-500 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-rose-600 transition">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
            <div class="p-3 text-xs text-gray-400 flex justify-between">
                <span class="truncate">${esc(m.title)}</span>
                <span>${esc((m.created_at || '').slice(5, 16))}</span>
            </div>
        </div>`;
        grid.insertAdjacentHTML('beforeend', html);
    });
}

async function uploadFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!window.CURRENT_USER) {
        alert('请先登录后再上传素材');
        location.href = '/login';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过 5MB');
        return;
    }
    const title = prompt('给这张素材起个名字（可留空）：', '') || '';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim() || '未命名素材');
    const data = await api('/api/materials', { method: 'POST', body: fd });
    if (data.ok) {
        loadMaterials();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
        alert(data.msg || '上传失败');
    }
}

async function delMaterial(mid) {
    if (!confirm('确定删除这张素材吗？')) return;
    const data = await api(`/api/materials/${mid}`, { method: 'DELETE' });
    if (data.ok) loadMaterials();
    else alert(data.msg || '删除失败');
}

loadMaterials();
