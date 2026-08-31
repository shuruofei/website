// ---------- 通用评论区组件 ----------
// mountComments(container, key) 在容器内渲染一个完整评论区
// 依赖：base.html 注入的 user 变量 -> 通过 window.CURRENT_USER 传递

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

function renderComments(container, key, comments) {
    const user = window.CURRENT_USER;
    const list = comments.map(c => `
        <div class="flex items-start gap-3 py-3 border-b border-gray-100 last:border-none">
            <div class="w-9 h-9 rounded-full ${c.is_admin ? 'bg-amber-500' : 'bg-tech-blue'} text-white flex items-center justify-center flex-shrink-0 font-bold">
                ${esc(c.author.charAt(0).toUpperCase())}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 text-sm">
                    <span class="font-bold ${c.is_admin ? 'text-amber-700' : 'text-gray-800'}">${esc(c.author)}</span>
                    ${c.is_admin ? '<span class="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">管理员</span>' : ''}
                    ${c.mine ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">我</span>' : ''}
                    <span class="text-xs text-gray-400 ml-auto">${esc(c.created_at)}</span>
                </div>
                <p class="text-gray-600 text-sm mt-1 leading-relaxed break-words">${esc(c.content)}</p>
            </div>
            ${c.mine || (user && user.is_admin) ? `<button onclick="delComment(this, '${key}', ${c.id})" class="text-gray-300 hover:text-red-500 text-sm px-2"><i class="fas fa-trash"></i></button>` : ''}
        </div>`).join('');

    container.innerHTML = `
        <div class="border-t border-gray-200 pt-4">
            <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-comments text-tech-blue"></i> 留言交流
                <span class="text-xs text-gray-400 font-normal">（${comments.length} 条）</span>
            </h4>
            ${user ? `
            <div class="flex gap-2 mb-3">
                <textarea rows="2" maxlength="500" placeholder="说点什么吧…（500 字以内）"
                    class="comment-input flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-tech-blue/40 resize-none"></textarea>
                <button onclick="postComment(this, '${key}')" class="comment-post-btn self-end bg-tech-blue text-white px-5 py-2.5 rounded-xl text-sm hover:bg-blue-700 transition">
                    <i class="fas fa-paper-plane mr-1"></i>发布
                </button>
            </div>` : `
            <p class="text-sm text-gray-400 bg-gray-50 rounded-xl p-3 mb-3">
                <i class="fas fa-lock mr-1"></i> 登录后即可参与留言，
                <a href="/login" class="text-tech-blue hover:underline">去登录</a> /
                <a href="/register" class="text-tech-blue hover:underline">注册</a>
            </p>`}
            <div class="max-h-72 overflow-y-auto">${list || '<p class="text-sm text-gray-300 text-center py-6">还没有留言，来坐第一排吧～</p>'}</div>
        </div>`;
}

async function refreshComments(container, key) {
    const data = await api(`/api/comments?key=${encodeURIComponent(key)}`);
    if (data.ok) renderComments(container, key, data.comments);
}

function mountComments(container, key) {
    container.dataset.key = key;
    refreshComments(container, key);
}

async function postComment(btn, key) {
    const box = btn.closest('div').querySelector('.comment-input');
    const content = box.value.trim();
    if (!content) { box.focus(); return; }
    btn.disabled = true;
    const data = await api('/api/comments', { method: 'POST', body: JSON.stringify({ key, content }) });
    btn.disabled = false;
    if (data.ok) {
        box.value = '';
        renderComments(btn.closest('#modal-comments, .comment-root') || btn.closest('[data-key]'), key, data.comments);
    } else {
        alert(data.msg || '发布失败');
    }
}

async function delComment(btn, key, cid) {
    if (!confirm('确定删除这条留言吗？')) return;
    const data = await api(`/api/comments/${cid}`, { method: 'DELETE' });
    if (data.ok) {
        renderComments(btn.closest('[data-key]'), key, data.comments);
    }
}
