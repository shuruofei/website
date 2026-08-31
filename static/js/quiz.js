// ---------- 桦艺知识问答 ----------
const QUIZ = [
    { q: '桦树皮制作技艺于哪一年列入第一批国家级非物质文化遗产名录？',
      o: ['1998 年', '2006 年', '2012 年', '2020 年'], a: 1,
      e: '2006 年 5 月 20 日经国务院批准列入，编号 Ⅷ-83（传统技艺类）。' },
    { q: '桦树皮制作技艺的国家级非遗编号是？',
      o: ['Ⅷ-83', 'Ⅴ-6', 'Ⅷ-85', 'Ⅷ-112'], a: 0,
      e: 'Ⅷ-83 是传统技艺类中的桦树皮制作技艺；Ⅷ-85 是赫哲族鱼皮制作技艺。' },
    { q: '桦树皮画的核心上色方式是？',
      o: ['化学颜料喷涂', '天然矿物颜料', '烙铁烫烙碳化', '水墨晕染'], a: 2,
      e: '全程不使用化学颜料，以电烙铁不同温度烫烙，碳化程度即"墨分五色"。' },
    { q: '匠人行话"相皮"指的是？',
      o: ['给树皮打磨上光', '依树皮天然纹理因势构图', '将树皮蒸煮脱脂', '把树皮染成不同颜色'], a: 1,
      e: '"相皮"即观察天然结节、斑点与色晕，因势象形，"虽由人作，宛自天开"。' },
    { q: '剥取桦树皮最合适的时间是？',
      o: ['深冬结冰时', '春末夏初树液旺盛期', '秋叶落尽后', '随时都可以'], a: 1,
      e: '农历五月底六月初至立秋前，树皮与木质层易分离，且只取外皮不伤形成层。' },
    { q: '鄂伦春族的桦皮船，鄂伦春语称为？',
      o: ['撮罗子', '奥木鲁钦', '伊玛堪', '乌力楞'], a: 1,
      e: '"奥木鲁钦"以樟子松为骨、桦皮为体，全船不用一根铁钉；撮罗子是桦皮帐篷。' },
    { q: '首批国家级传承人付占祥来自哪个民族？',
      o: ['鄂伦春族', '鄂温克族', '赫哲族', '达斡尔族'], a: 2,
      e: '付占祥（1955 年生，赫哲族，黑龙江饶河）2007 年入选首批国家级代表性传承人。' },
    { q: '考古发现，北方民族使用桦皮制品约有多少年历史？',
      o: ['约 300 年', '约 800 年', '约 1500 年', '约 3000 年'], a: 3,
      e: '考古资料证明约 3000 年前已有桦皮制品；扎赉诺尔汉代鲜卑墓曾出土上千件桦皮器皿盖。' },
];

let qIndex = 0, score = 0;

function startQuiz() {
    qIndex = 0; score = 0;
    document.getElementById('quiz-start').classList.add('hidden');
    document.getElementById('quiz-result').classList.add('hidden');
    document.getElementById('quiz-box').classList.remove('hidden');
    document.getElementById('q-total').innerText = QUIZ.length;
    showQuestion();
}

function showQuestion() {
    const item = QUIZ[qIndex];
    document.getElementById('q-now').innerText = qIndex + 1;
    document.getElementById('q-score').innerText = score;
    document.getElementById('q-progress').style.width = (qIndex / QUIZ.length * 100) + '%';
    document.getElementById('q-text').innerText = item.q;
    document.getElementById('q-feedback').classList.add('hidden');
    document.getElementById('q-next').classList.add('hidden');

    const box = document.getElementById('q-options');
    box.innerHTML = '';
    item.o.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left border-2 border-gray-100 rounded-xl px-5 py-3.5 hover:border-indigo-300 hover:bg-indigo-50/50 transition font-medium text-gray-700';
        btn.innerHTML = `<span class="inline-flex w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs items-center justify-center mr-2">${'ABCD'[i]}</span>${opt}`;
        btn.onclick = () => answer(i, btn);
        box.appendChild(btn);
    });
}

function answer(i, btn) {
    const item = QUIZ[qIndex];
    const buttons = document.querySelectorAll('#q-options button');
    buttons.forEach(b => b.disabled = true);
    buttons[item.a].className = 'w-full text-left border-2 border-emerald-400 bg-emerald-50 rounded-xl px-5 py-3.5 font-medium text-emerald-800';
    if (i !== item.a) {
        btn.className = 'w-full text-left border-2 border-rose-300 bg-rose-50 rounded-xl px-5 py-3.5 font-medium text-rose-700';
    } else {
        score++;
        document.getElementById('q-score').innerText = score;
    }
    const fb = document.getElementById('q-feedback');
    fb.className = 'mt-5 rounded-xl p-4 text-sm ' + (i === item.a ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700');
    fb.innerHTML = (i === item.a ? '<i class="fas fa-check-circle mr-1"></i> 回答正确！' : '<i class="fas fa-times-circle mr-1"></i> 正确答案：' + item.o[item.a]) + '<br><span class="text-gray-500 mt-1 inline-block">' + item.e + '</span>';
    fb.classList.remove('hidden');

    const next = document.getElementById('q-next');
    if (qIndex < QUIZ.length - 1) {
        next.innerHTML = '下一题 <i class="fas fa-arrow-right ml-1"></i>';
    } else {
        next.innerHTML = '查看成绩 <i class="fas fa-flag-checkered ml-1"></i>';
    }
    next.classList.remove('hidden');
}

function nextQuestion() {
    qIndex++;
    if (qIndex < QUIZ.length) { showQuestion(); return; }
    document.getElementById('quiz-box').classList.add('hidden');
    document.getElementById('q-progress').style.width = '100%';

    const r = document.getElementById('quiz-result');
    document.getElementById('r-score').innerText = score;
    let emoji, title, desc;
    if (score >= 7)      { emoji = '🏆'; title = '桦艺守护者！'; desc = '你对这门技艺的了解已相当深入，欢迎加入我们成为数字传承志愿者。'; }
    else if (score >= 5) { emoji = '🎉'; title = '森林优等生'; desc = '基础扎实！去"工艺详解"再补一补细节，离满分不远了。'; }
    else if (score >= 3) { emoji = '🌿'; title = '初识白桦'; desc = '不错的开始，跟着时间轴和工艺页走一遍，会有大收获。'; }
    else                 { emoji = '🌲'; title = '初入林海'; desc = '别灰心，整个网站就是一本立体教科书——从首页逛起吧！'; }
    document.getElementById('r-emoji').innerText = emoji;
    document.getElementById('r-title').innerText = title;
    document.getElementById('r-desc').innerText = desc;

    const best = +(localStorage.getItem('huayi_quiz_best') || 0);
    if (score > best) localStorage.setItem('huayi_quiz_best', score);
    const bestEl = document.getElementById('best-score');
    bestEl.classList.remove('hidden');
    bestEl.innerHTML = `<i class="fas fa-star mr-1"></i>你的历史最佳：${Math.max(score, best)} 分`;
    r.classList.remove('hidden');
}

// 显示历史最佳
(function () {
    const best = localStorage.getItem('huayi_quiz_best');
    if (best) {
        const el = document.getElementById('best-score');
        el.classList.remove('hidden');
        el.innerHTML = `<i class="fas fa-star mr-1"></i>你的历史最佳：${best} 分`;
    }
})();
