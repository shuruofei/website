// ---------- 术语小百科：全站术语悬停解释 ----------
// 首次出现的术语自动加虚线下划线，悬停/点击弹出解释卡片
(function () {
    const TERMS = {
        '桦树皮画': '以白桦树皮为画布和颜料的独特画种，经剥取、熟化、剪贴、烫烙而成，2006 年列入首批国家级非遗名录（编号 Ⅷ-83）。',
        '桦树皮制作技艺': '国家级非物质文化遗产代表性项目（编号 Ⅷ-83，传统技艺类），涵盖桦皮器物与画的完整制作传统。',
        '相皮': '桦皮画独有的构思环节：匠人审视树皮天然的纹理、结节与色差，顺势确定画面布局，"看皮定图、因材施艺"。',
        '烫烙': '以加热的金属工具在桦皮表面烫出深浅不一的焦痕，营造明暗与细节，被称为"以火为墨"的技法。',
        '烙烫': '同"烫烙"：以高温烙铁在桦皮上烫出深浅焦痕，塑造光影与细节。',
        '剪贴': '用剪刀将深浅不同的桦皮剪出形状，层层拼贴成立体画面，是桦皮画的核心造型手法。',
        '拼贴': '将不同颜色、厚薄的桦皮按构图叠合粘贴，利用天然色差形成层次。',
        '使鹿部落': '鄂温克族中以驯鹿为伴、游猎于大兴安岭的部落，是中国唯一的驯鹿族群，桦皮文化的重要承载者。',
        '鄂温克族': '主要分布于内蒙古与黑龙江的森林民族，"鄂温克"意为"住在大山林中的人们"，部分支系以驯鹿为生。',
        '鄂伦春族': '世居大小兴安岭的游猎民族，"鄂伦春"意为"山岭上的人"，以桦皮船、桦皮器物闻名。',
        '驯鹿': '俗称"四不像"，栖息于寒带森林的鹿科动物，是使鹿部落的交通与生活伙伴，桦皮画中的经典意象。',
        '桦皮船': '以桦树皮包覆船骨制成的轻便独木舟，可一人搬运，是鄂伦春族水上狩猎的智慧结晶。',
        '白桦': '寒温带落叶乔木，树皮洁白含油脂，柔韧防水、易剥取，是桦皮画的天然材料。',
        '大兴安岭': '中国面积最大的寒温带林区，白桦的主要产地，桦皮文化生长的摇篮。',
        '国家级非物质文化遗产': '由国务院批准公布的最高级别非遗名录，桦树皮制作技艺于 2006 年入选第一批（编号 Ⅷ-83）。',
        '非遗': '非物质文化遗产的简称：世代相传的活态文化实践，桦树皮画即国家级非遗项目。',
    };

    const SKIP = 'a,button,script,style,textarea,input,select,option,label,.term-chip,#term-popover,nav,footer';

    let popover = null, usedTerms = new Set();

    function createPopover() {
        popover = document.createElement('div');
        popover.id = 'term-popover';
        popover.className = 'term-popover';
        popover.setAttribute('role', 'tooltip');
        document.body.appendChild(popover);
        document.addEventListener('click', (e) => {
            if (!popover.contains(e.target) && !e.target.closest('.term-chip')) hidePopover();
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopover(); });
        window.addEventListener('scroll', hidePopover, { passive: true });
        window.addEventListener('resize', hidePopover);
    }

    function showPopover(chip) {
        const term = chip.dataset.term;
        const desc = TERMS[term] || '';
        popover.innerHTML = `<div class="term-popover-title"><i class="fas fa-book-open"></i>${term}</div><div class="term-popover-desc">${desc}</div>`;
        popover.style.display = 'block';
        const rect = chip.getBoundingClientRect();
        const pw = popover.offsetWidth, ph = popover.offsetHeight;
        let left = rect.left + rect.width / 2 - pw / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
        let top = rect.top - ph - 10;
        if (top < 60) top = rect.bottom + 10;  // 顶部有固定导航，留出空间
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    }

    function hidePopover() { if (popover) popover.style.display = 'none'; }

    // 在文本节点中查找术语匹配，优先保留更长的词条（如"国家级非物质文化遗产"优先于"非遗"）
    function findRanges(text) {
        const ranges = [];
        for (const term of Object.keys(TERMS)) {
            if (usedTerms.has(term)) continue;
            const idx = text.indexOf(term);
            if (idx !== -1) ranges.push({ start: idx, end: idx + term.length, term });
        }
        // 长词条优先，避免"非遗"抢走"国家级非物质文化遗产"内部的匹配
        ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start));
        const taken = [], chosen = [];
        for (const r of ranges) {
            if (taken.some(t => r.start < t.end && r.end > t.start)) continue;
            chosen.push(r); taken.push(r);
        }
        return chosen.sort((a, b) => a.start - b.start);
    }

    function wrapNode(node) {
        const text = node.nodeValue;
        const ranges = findRanges(text);
        if (!ranges.length) return;
        const frag = document.createDocumentFragment();
        let pos = 0;
        for (const r of ranges) {
            if (r.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, r.start)));
            const chip = document.createElement('span');
            chip.className = 'term-chip';
            chip.dataset.term = r.term;
            chip.tabIndex = 0;
            chip.textContent = r.term;
            frag.appendChild(chip);
            usedTerms.add(r.term);
            pos = r.end;
        }
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        node.parentNode.replaceChild(frag, node);
    }

    function scan(root) {
        if (!root || root.nodeType !== 1) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                if (n.parentElement.closest(SKIP)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const targets = [];
        while (walker.nextNode()) targets.push(walker.currentNode);
        targets.forEach(wrapNode);
    }

    document.addEventListener('DOMContentLoaded', () => {
        createPopover();
        const main = document.querySelector('main');
        if (main) scan(main);
        // 动态插入的内容（如展馆弹窗用 innerText 填充）也纳入扫描
        new MutationObserver((muts) => {
            for (const m of muts) m.addedNodes.forEach(n => {
                // innerText 赋值产生的是文本节点，需转成其父元素再扫描
                const el = n.nodeType === 1 ? n : n.parentElement;
                if (el && !el.closest('#term-popover')) scan(el);
            });
        }).observe(main || document.body, { childList: true, subtree: true });
    });

    // 事件委托：悬停显示，移动端点击切换
    document.addEventListener('mouseover', (e) => {
        const chip = e.target.closest('.term-chip');
        if (chip) showPopover(chip);
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.term-chip')) hidePopover();
    });
    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.term-chip');
        if (chip) { e.preventDefault(); e.stopPropagation(); showPopover(chip); }
    });
    document.addEventListener('focusin', (e) => {
        const chip = e.target.closest('.term-chip');
        if (chip) showPopover(chip);
    });
    document.addEventListener('focusout', hidePopover);
})();
