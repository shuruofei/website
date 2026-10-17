// ---------- 我是桦皮画师：拼贴创作 ----------
// 画布内部坐标固定 900x675，CSS 拉伸自适应；桦皮块按数组顺序即图层顺序
(function () {
    const CW = 900, CH = 675;
    const mainCanvas = document.getElementById('main-canvas');
    const guideCanvas = document.getElementById('guide-canvas');
    const ctx = mainCanvas.getContext('2d');
    const gctx = guideCanvas.getContext('2d');
    mainCanvas.width = CW; mainCanvas.height = CH;
    guideCanvas.width = CW; guideCanvas.height = CH;

    const texCache = new Map();   // src -> Image
    let pieces = [];              // {id, img, x, y, w, h, scale, rot, flip}
    let selected = null, dragging = null, idSeq = 0;
    let history = [], lastKey = null, lastTime = 0;
    let currentGuide = 'deer', guideVisible = true;

    // ---------- 基础工具 ----------
    function toast(msg, ms = 2800) {
        const t = document.getElementById('create-toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        clearTimeout(t._tm);
        t._tm = setTimeout(() => t.classList.add('hidden'), ms);
    }

    function snapshot() { return pieces.map(p => ({ ...p })); }

    // 连续操作（拖动/滚轮/连点）在 500ms 内只记录一次历史
    function commit(key) {
        const now = Date.now();
        if (key && key === lastKey && now - lastTime < 500) { lastTime = now; return; }
        history.push(snapshot());
        if (history.length > 30) history.shift();
        lastKey = key || 'op' + now; lastTime = now;
        document.getElementById('btn-undo').disabled = false;
    }

    function loadTexture(src) {
        return new Promise(resolve => {
            if (texCache.has(src)) return resolve(texCache.get(src));
            const img = new Image();
            img.onload = () => { texCache.set(src, img); resolve(img); };
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    function toCanvasPt(e) {
        const r = mainCanvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height };
    }

    // ---------- 渲染 ----------
    function render() {
        ctx.clearRect(0, 0, CW, CH);
        for (const p of pieces) drawPiece(ctx, p);
        if (cropMode) {
            drawCropOverlay();
        } else if (selected) {
            ctx.save();
            ctx.translate(selected.x, selected.y);
            ctx.rotate(selected.rot);
            const w = selected.w * selected.scale * selected.sx, h = selected.h * selected.scale * selected.sy;
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#0284c7';
            ctx.strokeRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10);
            // 四边中点为拉伸控制点：左右横向拉伸、上下纵向拉伸
            ctx.setLineDash([]);
            ctx.fillStyle = '#fff';
            for (const [hx, hy] of [[w / 2 + 5, 0], [-w / 2 - 5, 0], [0, h / 2 + 5], [0, -h / 2 - 5]]) {
                ctx.fillRect(hx - 5, hy - 5, 10, 10);
                ctx.strokeRect(hx - 5, hy - 5, 10, 10);
            }
            ctx.restore();
        }
        document.getElementById('stage-empty').style.display = pieces.length ? 'none' : 'flex';
        document.getElementById('piece-count').textContent = pieces.length + ' 块桦皮';
        const bar = document.getElementById('piece-bar');
        if (selected) { bar.classList.remove('opacity-40', 'pointer-events-none'); }
        else { bar.classList.add('opacity-40', 'pointer-events-none'); }
    }

    function drawPiece(c, p) {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.scale((p.flip ? -1 : 1) * p.scale * p.sx, p.scale * p.sy);
        c.drawImage(p.img, -p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
    }

    // ---------- 命中检测（从顶层往下找） ----------
    function hitPiece(pt) {
        for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            const dx = pt.x - p.x, dy = pt.y - p.y;
            const cos = Math.cos(-p.rot), sin = Math.sin(-p.rot);
            const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
            if (Math.abs(lx) <= p.w * p.scale * p.sx / 2 && Math.abs(ly) <= p.h * p.scale * p.sy / 2) return p;
        }
        return null;
    }

    // ---------- 添加 / 编辑桦皮块 ----------
    async function addPiece(src, x, y) {
        const img = await loadTexture(src);
        if (!img) { toast('纹理加载失败，请重试'); return; }
        if (cropMode) exitCrop();
        const k = 240 / Math.max(img.naturalWidth, img.naturalHeight);
        commit();
        pieces.push({
            id: ++idSeq, img,
            x: x ?? CW / 2 + (Math.random() - 0.5) * 120,
            y: y ?? CH / 2 + (Math.random() - 0.5) * 120,
            w: img.naturalWidth * k, h: img.naturalHeight * k,
            scale: 1, sx: 1, sy: 1, rot: (Math.random() - 0.5) * 0.25, flip: false,
        });
        selected = pieces[pieces.length - 1];
        render();
    }

    document.querySelectorAll('#piece-bar [data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!selected) return;
            const act = btn.dataset.act, id = selected.id;
            if (act === 'crop') { cropMode ? exitCrop() : enterCrop(selected); return; }
            if (cropMode) exitCrop();   // 其他编辑操作自动退出裁剪
            if (act === 'bigger' || act === 'smaller') {
                commit('scale' + id);
                selected.scale = Math.min(4, Math.max(0.2, selected.scale * (act === 'bigger' ? 1.18 : 0.85)));
            } else if (act === 'rotl' || act === 'rotr') {
                commit('rot' + id);
                selected.rot += (act === 'rotr' ? 1 : -1) * Math.PI / 12;
            } else if (act === 'flip') {
                commit('flip' + id);
                selected.flip = !selected.flip;
            } else if (act === 'del') {
                commit();
                pieces = pieces.filter(p => p !== selected);
                selected = null;
            } else {  // 图层上移 / 下移（交换数组位置）
                const i = pieces.indexOf(selected);
                const j = act === 'up' ? Math.min(i + 1, pieces.length - 1) : Math.max(i - 1, 0);
                if (i !== j) { commit('layer' + id); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
            }
            render();
        });
    });

    // ---------- 拉伸：图块显示坐标 <-> 世界坐标（含旋转/翻转/缩放/拉伸） ----------
    function boxToWorld(bx, by, p) {
        let x = (p.flip ? -bx : bx) * p.scale * p.sx, y = by * p.scale * p.sy;
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        return { x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos };
    }

    function stretchHandleAt(pt, p) {
        const pts = [[p.w / 2, 0, 'x'], [-p.w / 2, 0, 'x'], [0, p.h / 2, 'y'], [0, -p.h / 2, 'y']];
        for (const [bx, by, axis] of pts) {
            const w = boxToWorld(bx, by, p);
            if (Math.hypot(pt.x - w.x, pt.y - w.y) <= 14) return axis;
        }
        return null;
    }

    function ptToStretchedLocal(pt, p) {
        // 指针 -> 旋转对齐、未除拉伸系数的坐标系（范围 ±w·sx/2, ±h·sy/2）
        const dx = pt.x - p.x, dy = pt.y - p.y;
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        let ux = (dx * cos + dy * sin) / p.scale;
        let uy = (-dx * sin + dy * cos) / p.scale;
        if (p.flip) ux = -ux;
        return { x: ux, y: uy };
    }

    // ---------- 画布指针交互（拖动 / 缩放；裁剪模式另有一组监听） ----------
    mainCanvas.addEventListener('pointerdown', e => {
        if (cropMode) return;
        e.preventDefault();
        try { mainCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        const pt = toCanvasPt(e);
        // 优先命中选中块的拉伸控制点
        if (selected) {
            const axis = stretchHandleAt(pt, selected);
            if (axis) { dragging = { p: selected, mode: 'stretch', axis, moved: false, start: pt }; render(); return; }
        }
        const hit = hitPiece(pt);
        selected = hit;
        if (hit) dragging = { p: hit, mode: 'move', dx: pt.x - hit.x, dy: pt.y - hit.y, moved: false, start: pt };
        render();
    });
    mainCanvas.addEventListener('pointermove', e => {
        if (cropMode) return;
        if (!dragging) {   // 悬停时提示拉伸光标
            if (selected) {
                const ax = stretchHandleAt(toCanvasPt(e), selected);
                mainCanvas.style.cursor = ax === 'x' ? 'ew-resize' : ax === 'y' ? 'ns-resize' : 'default';
            } else mainCanvas.style.cursor = 'default';
            return;
        }
        const pt = toCanvasPt(e);
        if (!dragging.moved) {
            if (Math.hypot(pt.x - dragging.start.x, pt.y - dragging.start.y) < 4) return;
            dragging.moved = true;
            commit((dragging.mode === 'stretch' ? 'stretch' : 'drag') + dragging.p.id);   // 记录变化前状态
        }
        if (dragging.mode === 'stretch') {
            const p = dragging.p, local = ptToStretchedLocal(pt, p);
            if (dragging.axis === 'x') p.sx = Math.min(6, Math.max(0.15, 2 * Math.abs(local.x) / p.w));
            else p.sy = Math.min(6, Math.max(0.15, 2 * Math.abs(local.y) / p.h));
        } else {
            dragging.p.x = Math.max(-80, Math.min(CW + 80, pt.x - dragging.dx));
            dragging.p.y = Math.max(-80, Math.min(CH + 80, pt.y - dragging.dy));
        }
        render();
    });
    mainCanvas.addEventListener('pointerup', () => { dragging = null; });
    mainCanvas.addEventListener('wheel', e => {
        if (cropMode || !selected) return;
        e.preventDefault();
        commit('wheel' + selected.id);
        selected.scale = Math.min(4, Math.max(0.2, selected.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
        render();
    }, { passive: false });

    // ---------- 素材架：点击添加，或拖入画布指定位置 ----------
    document.querySelectorAll('.palette-item').forEach(item => {
        item.style.touchAction = 'none';
        let ghost = null, startPt = null, moved = false;

        item.addEventListener('pointerdown', e => {
            e.preventDefault();
            try { item.setPointerCapture(e.pointerId); } catch (_) {}
            startPt = { x: e.clientX, y: e.clientY };
            moved = false;
        });
        item.addEventListener('pointermove', e => {
            if (!startPt) return;
            if (!moved && Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y) > 6) {
                moved = true;
                ghost = document.createElement('img');
                ghost.src = item.dataset.src;
                ghost.style.cssText = 'position:fixed;width:96px;height:96px;object-fit:cover;border-radius:12px;border:3px solid #5e4229;z-index:300;pointer-events:none;opacity:.9;transform:translate(-50%,-50%);';
                document.body.appendChild(ghost);
            }
            if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
        });
        item.addEventListener('pointerup', e => {
            const src = item.dataset.src;
            if (moved && ghost) {
                const r = mainCanvas.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                    const pt = toCanvasPt(e);
                    addPiece(src, pt.x, pt.y);
                }
                ghost.remove(); ghost = null;
            } else if (!moved) {
                addPiece(src);   // 纯点击：放到画布中央
            }
            startPt = null; moved = false;
        });
        item.addEventListener('pointercancel', () => { if (ghost) ghost.remove(); ghost = null; startPt = null; moved = false; });
    });

    // ---------- 底稿 ----------
    const GUIDES = {
        none: null,
        deer: { name: '驯鹿', draw: drawDeerGuide },
        mountain: { name: '群山', draw: drawMountainGuide },
        birch: { name: '白桦林', draw: drawBirchGuide },
    };

    function drawGuide() {
        gctx.clearRect(0, 0, CW, CH);
        const g = GUIDES[currentGuide];
        if (!g || !guideVisible) return;
        gctx.save();
        gctx.fillStyle = 'rgba(94,66,41,.07)';
        gctx.strokeStyle = 'rgba(94,66,41,.5)';
        gctx.lineWidth = 2.5;
        gctx.setLineDash([9, 7]);
        gctx.lineCap = 'round';
        gctx.lineJoin = 'round';
        g.draw(gctx);
        gctx.restore();
        gctx.font = '20px "Microsoft YaHei", sans-serif';
        gctx.fillStyle = 'rgba(94,66,41,.4)';
        gctx.textAlign = 'right';
        gctx.fillText('底稿 · ' + g.name, CW - 20, CH - 20);
    }

    function drawDeerGuide(c) {
        // 角（线描）
        c.beginPath(); c.moveTo(600, 195); c.quadraticCurveTo(575, 130, 560, 75); c.moveTo(592, 160); c.lineTo(625, 140); c.moveTo(578, 125); c.lineTo(545, 118);
        c.moveTo(645, 195); c.quadraticCurveTo(668, 130, 662, 85); c.moveTo(655, 150); c.lineTo(688, 132);
        c.stroke();
        // 头 + 耳
        c.beginPath(); c.ellipse(630, 210, 40, 25, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(650, 188); c.lineTo(672, 170); c.lineTo(658, 200); c.closePath(); c.fill(); c.stroke();
        // 颈
        c.beginPath(); c.moveTo(565, 255); c.lineTo(612, 200); c.lineTo(648, 242); c.lineTo(600, 295); c.closePath(); c.fill(); c.stroke();
        // 身体 + 尾
        c.beginPath(); c.ellipse(430, 350, 155, 82, -0.04, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(558, 292); c.lineTo(592, 280); c.lineTo(578, 316); c.closePath(); c.fill(); c.stroke();
        // 四腿
        c.lineWidth = 17;
        c.beginPath();
        c.moveTo(340, 405); c.lineTo(322, 630);
        c.moveTo(380, 412); c.lineTo(392, 628);
        c.moveTo(508, 412); c.lineTo(528, 632);
        c.moveTo(468, 408); c.lineTo(452, 626);
        c.stroke();
    }

    function drawMountainGuide(c) {
        // 远山
        c.beginPath(); c.moveTo(0, CH); c.lineTo(150, 290); c.lineTo(310, 555); c.lineTo(540, 210); c.lineTo(705, 540); c.lineTo(900, 350); c.lineTo(900, CH); c.closePath(); c.fill(); c.stroke();
        // 近山
        c.beginPath(); c.moveTo(0, CH); c.lineTo(250, 430); c.lineTo(440, 625); c.lineTo(660, 390); c.lineTo(900, 605); c.lineTo(900, CH); c.closePath(); c.fill(); c.stroke();
        // 月亮
        c.beginPath(); c.arc(760, 110, 45, 0, Math.PI * 2); c.stroke();
    }

    function drawBirchGuide(c) {
        [250, 455, 660].forEach((x, i) => {
            const top = 150 + i * 28;
            // 树干
            c.beginPath(); c.roundRect(x - 22, top, 44, CH - top - 30, 20); c.fill(); c.stroke();
            // 桦皮斑纹
            c.setLineDash([4, 10]);
            c.beginPath();
            for (let y = top + 40; y < CH - 60; y += 55) { c.moveTo(x - 14, y); c.lineTo(x + 10, y + 12); }
            c.stroke();
            c.setLineDash([9, 7]);
            // 枝
            c.lineWidth = 8;
            c.beginPath();
            c.moveTo(x, top + 15); c.quadraticCurveTo(x - 55, top - 40, x - 95, top - 75);
            c.moveTo(x, top + 25); c.quadraticCurveTo(x + 50, top - 30, x + 92, top - 62);
            c.stroke();
            c.lineWidth = 2.5;
        });
    }

    document.querySelectorAll('.guide-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentGuide = btn.dataset.guide;
            document.querySelectorAll('.guide-btn').forEach(b => {
                const on = b === btn;
                b.classList.toggle('bg-birch-dark', on);
                b.classList.toggle('text-white', on);
                b.classList.toggle('border-birch-dark', on);
                b.classList.toggle('text-gray-600', !on);
                b.classList.toggle('border-gray-200', !on);
            });
            drawGuide();
        });
    });
    document.querySelector('.guide-btn[data-guide="deer"]').click();

    document.getElementById('guide-toggle').addEventListener('click', function () {
        guideVisible = !guideVisible;
        guideCanvas.style.opacity = guideVisible ? '1' : '0';
        this.innerHTML = guideVisible ? '<i class="fas fa-eye mr-1"></i>隐藏底稿' : '<i class="fas fa-eye-slash mr-1"></i>显示底稿';
        drawGuide();
    });

    // ---------- 撤销 / 清空 ----------
    document.getElementById('btn-undo').addEventListener('click', () => {
        if (!history.length) return;
        if (cropMode) exitCrop();
        pieces = history.pop();
        selected = null;
        document.getElementById('btn-undo').disabled = history.length === 0;
        render();
    });
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (!pieces.length) return;
        if (cropMode) exitCrop();
        if (!confirm('确定清空画布吗？可用"撤销"找回。')) return;
        commit();
        pieces = []; selected = null;
        render();
    });

    // ---------- 装裱导出 ----------
    function buildExport() {
        const M = 50;
        const out = document.createElement('canvas');
        out.width = CW + M * 2; out.height = CH + M * 2;
        const c = out.getContext('2d');
        c.fillStyle = '#f9f3e9';
        c.fillRect(0, 0, out.width, out.height);
        c.translate(M, M);
        for (const p of pieces) drawPiece(c, p);
        c.setTransform(1, 0, 0, 1, 0, 0);
        // 双层画框
        c.strokeStyle = '#5e4229'; c.lineWidth = 7;
        c.strokeRect(M / 2, M / 2, CW + M, CH + M);
        c.strokeStyle = '#7a5b3c'; c.lineWidth = 2;
        c.strokeRect(M / 2 + 12, M / 2 + 12, CW + M - 24, CH + M - 24);
        // 题字
        const title = (document.getElementById('work-title').value || '').trim();
        c.font = '24px "Microsoft YaHei", sans-serif';
        c.fillStyle = '#7a5b3c';
        c.textAlign = 'center';
        c.fillText(title ? `《${title}》 · 桦艺新生` : '桦艺新生 · 桦皮拼贴', out.width / 2, out.height - 18);
        // 印章
        const sx = M + CW - 62, sy = M + CH - 62;
        c.fillStyle = '#b03a2e';
        c.beginPath(); c.roundRect(sx, sy, 44, 44, 6); c.fill();
        c.fillStyle = '#f9f3e9';
        c.font = 'bold 27px "Microsoft YaHei", sans-serif';
        c.fillText('桦', sx + 22, sy + 32);
        return out;
    }

    function exportBlob() {
        return new Promise(resolve => buildExport().toBlob(resolve, 'image/png'));
    }

    document.getElementById('btn-download').addEventListener('click', async () => {
        if (!pieces.length) { toast('画布还是空的，先拖几块桦皮进来吧'); return; }
        const blob = await exportBlob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '桦艺新生-拼贴作品.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast('装裱作品已开始下载');
    });

    document.getElementById('btn-ar').addEventListener('click', async () => {
        if (!pieces.length) { toast('画布还是空的，先拖几块桦皮进来吧'); return; }
        const blob = await exportBlob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '桦艺新生-拼贴作品.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        window.open(window.AR_URL, '_blank', 'noopener');
        toast('作品已下载——在打开的 AR 页面选择"上传图片"，即可贴到现实墙面', 5000);
    });

    document.getElementById('btn-submit').addEventListener('click', async function () {
        if (!pieces.length) { toast('画布还是空的，先拖几块桦皮进来吧'); return; }
        if (!window.CURRENT_USER) {
            toast('请先登录后再投稿，正在前往登录页…');
            setTimeout(() => location.href = '/login', 1500);
            return;
        }
        const title = (document.getElementById('work-title').value || '').trim() || '我的桦皮拼贴';
        const btn = this;
        btn.disabled = true;
        try {
            const blob = await exportBlob();
            const fd = new FormData();
            fd.append('file', new File([blob], 'collage.png', { type: 'image/png' }));
            fd.append('title', title);
            const data = await api('/api/materials', { method: 'POST', body: fd });
            if (data.ok) toast('投稿成功！作品已加入素材共创库');
            else toast(data.msg || '投稿失败，请重试');
        } catch (err) {
            toast('网络异常，请重试');
        }
        btn.disabled = false;
    });

    // ---------- 裁剪纹理：直接在画布上框选保留区域 ----------
    // 选区定义在块的本地坐标系，跟随块的旋转/翻转/缩放显示；确认后原位替换
    let cropMode = null;   // { piece, sel: {x,y,w,h}, drag }
    const CROP_PTS = [[0, 0, 'nw'], [.5, 0, 'n'], [1, 0, 'ne'], [1, .5, 'e'], [1, 1, 'se'], [.5, 1, 's'], [0, 1, 'sw'], [0, .5, 'w']];
    const CROP_CURSORS = { move: 'move', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

    function worldToLocal(pt, p) {
        const dx = pt.x - p.x, dy = pt.y - p.y;
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        let lx = (dx * cos + dy * sin) / (p.scale * p.sx);
        let ly = (-dx * sin + dy * cos) / (p.scale * p.sy);
        if (p.flip) lx = -lx;
        return { x: lx, y: ly };
    }

    function localToWorld(lx, ly, p) {
        let x = p.flip ? -lx : lx, y = ly;
        x *= p.scale * p.sx; y *= p.scale * p.sy;
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        return { x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos };
    }

    function enterCrop(piece) {
        if (!piece) return;
        cropMode = { piece, sel: { x: -piece.w / 2, y: -piece.h / 2, w: piece.w, h: piece.h }, drag: null };
        document.getElementById('edit-actions').classList.add('hidden');
        const ca = document.getElementById('crop-actions');
        ca.classList.remove('hidden'); ca.classList.add('flex');
        render();
    }

    function exitCrop() {
        if (!cropMode) return;
        cropMode = null;
        document.getElementById('edit-actions').classList.remove('hidden');
        const ca = document.getElementById('crop-actions');
        ca.classList.add('hidden'); ca.classList.remove('flex');
        mainCanvas.style.cursor = 'default';
        render();
    }

    function cropHandleAt(lx, ly) {
        const p = cropMode.piece, s = cropMode.sel;
        const thx = 14 / (p.scale * p.sx), thy = 14 / (p.scale * p.sy);
        for (const [fx, fy, k] of CROP_PTS) {
            const hx = s.x + s.w * fx, hy = s.y + s.h * fy;
            if (Math.abs(lx - hx) <= thx && Math.abs(ly - hy) <= thy) return k;
        }
        return null;
    }

    function cropModeAt(lx, ly) {
        const s = cropMode.sel;
        const h = cropHandleAt(lx, ly);
        if (h) return h;
        if (lx > s.x && lx < s.x + s.w && ly > s.y && ly < s.y + s.h) return 'move';
        return 'inside';   // 块内选区外：从此点重新框选
    }

    function clampCropSel() {
        const p = cropMode.piece, s = cropMode.sel;
        s.w = Math.max(8, Math.min(s.w, p.w));
        s.h = Math.max(8, Math.min(s.h, p.h));
        s.x = Math.max(-p.w / 2, Math.min(s.x, p.w / 2 - s.w));
        s.y = Math.max(-p.h / 2, Math.min(s.y, p.h / 2 - s.h));
    }

    function drawCropOverlay() {
        const p = cropMode.piece, s = cropMode.sel;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale((p.flip ? -1 : 1) * p.scale * p.sx, p.scale * p.sy);
        // 非均匀拉伸下用几何均值近似补偿线宽/控制点尺寸
        const kf = p.scale * Math.sqrt(Math.abs(p.sx * p.sy));
        const lw = 2 / kf;
        // 选区外压暗（奇偶填充）
        ctx.beginPath();
        ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.rect(s.x, s.y, s.w, s.h);
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.fill('evenodd');
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = lw;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
        // 三分线辅助构图
        ctx.save();
        ctx.setLineDash([5 / kf, 5 / kf]);
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = lw / 2;
        ctx.beginPath();
        for (let i = 1; i <= 2; i++) {
            ctx.moveTo(s.x + s.w * i / 3, s.y); ctx.lineTo(s.x + s.w * i / 3, s.y + s.h);
            ctx.moveTo(s.x, s.y + s.h * i / 3); ctx.lineTo(s.x + s.w, s.y + s.h * i / 3);
        }
        ctx.stroke();
        ctx.restore();
        // 控制点：四角 + 四边中点
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#5e4229';
        const hs = 10 / kf;
        for (const [fx, fy] of CROP_PTS) {
            const hx = s.x + s.w * fx - hs / 2, hy = s.y + s.h * fy - hs / 2;
            ctx.fillRect(hx, hy, hs, hs);
            ctx.strokeRect(hx, hy, hs, hs);
        }
        ctx.restore();
    }

    mainCanvas.addEventListener('pointerdown', e => {
        if (!cropMode) return;
        e.preventDefault();
        try { mainCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        const local = worldToLocal(toCanvasPt(e), cropMode.piece);
        const p = cropMode.piece;
        // 点在块外视为取消裁剪
        if (Math.abs(local.x) > p.w / 2 || Math.abs(local.y) > p.h / 2) { exitCrop(); return; }
        const mode = cropModeAt(local.x, local.y), s = cropMode.sel;
        if (mode === 'inside') {
            cropMode.sel = { x: local.x, y: local.y, w: 0, h: 0 };
            cropMode.drag = { mode: 'new', ax: local.x, ay: local.y };
        } else if (mode === 'move') {
            cropMode.drag = { mode, offX: local.x - s.x, offY: local.y - s.y };
        } else if (mode === 'nw' || mode === 'ne' || mode === 'se' || mode === 'sw') {
            // 锚定对角，拖动本角
            const ax = (mode === 'ne' || mode === 'se') ? s.x : s.x + s.w;
            const ay = (mode === 'nw' || mode === 'ne') ? s.y + s.h : s.y;
            cropMode.drag = { mode, ax, ay };
        } else {
            cropMode.drag = { mode };   // 四边中点：只动一条边
        }
    });

    mainCanvas.addEventListener('pointermove', e => {
        if (!cropMode) return;
        const local = worldToLocal(toCanvasPt(e), cropMode.piece);
        const p = cropMode.piece, s = cropMode.sel, d = cropMode.drag;
        if (!d) {   // 悬停时更新光标
            const outside = Math.abs(local.x) > p.w / 2 || Math.abs(local.y) > p.h / 2;
            mainCanvas.style.cursor = outside ? 'default' : (CROP_CURSORS[cropModeAt(local.x, local.y)] || 'crosshair');
            return;
        }
        if (d.mode === 'move') {
            s.x = local.x - d.offX; s.y = local.y - d.offY;
        } else if (d.mode === 'e') { s.w = local.x - s.x; }
        else if (d.mode === 'w') { const r = s.x + s.w; s.x = local.x; s.w = r - local.x; }
        else if (d.mode === 'n') { const b = s.y + s.h; s.y = local.y; s.h = b - local.y; }
        else if (d.mode === 's') { s.h = local.y - s.y; }
        else {   // 四角 / 新框选：锚点固定，指针为对角
            s.x = Math.min(d.ax, local.x); s.y = Math.min(d.ay, local.y);
            s.w = Math.abs(local.x - d.ax); s.h = Math.abs(local.y - d.ay);
        }
        clampCropSel();
        render();
    });
    mainCanvas.addEventListener('pointerup', () => { if (cropMode) cropMode.drag = null; });

    function applyCrop() {
        if (!cropMode) return;
        const p = cropMode.piece, s = cropMode.sel;
        const NW = p.img.naturalWidth || p.img.width, NH = p.img.naturalHeight || p.img.height;
        // 本地选区 -> 原图像素
        const cx = Math.max(0, Math.round((s.x + p.w / 2) * NW / p.w));
        const cy = Math.max(0, Math.round((s.y + p.h / 2) * NH / p.h));
        const cw = Math.min(NW - cx, Math.max(4, Math.round(s.w * NW / p.w)));
        const ch = Math.min(NH - cy, Math.max(4, Math.round(s.h * NH / p.h)));
        exitCrop();
        if (cw >= NW && ch >= NH) { toast('已选中整块纹理，无需裁剪'); return; }
        commit();
        // 裁剪结果画到独立画布，可直接作为 drawImage 的源
        const out = document.createElement('canvas');
        out.width = cw; out.height = ch;
        out.getContext('2d').drawImage(p.img, cx, cy, cw, ch, 0, 0, cw, ch);
        // 新块中心 = 选区中心的世界坐标，内容保持原位
        const c = localToWorld(s.x + s.w / 2, s.y + s.h / 2, p);
        p.x = c.x; p.y = c.y;
        p.w = s.w; p.h = s.h;
        p.img = out;
        render();
        toast('已裁剪，可用"撤销"恢复');
    }

    document.getElementById('crop-cancel').addEventListener('click', exitCrop);
    document.getElementById('crop-ok').addEventListener('click', applyCrop);
    document.addEventListener('keydown', e => {
        if (!cropMode) return;
        if (e.key === 'Escape') exitCrop();
        else if (e.key === 'Enter') { e.preventDefault(); applyCrop(); }
    });

    render();
})();
