// ---------- AI 问答 ----------
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

function simpleFormat(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function appendMessage(sender, html) {
    const div = document.createElement('div');
    if (sender === 'user') {
        div.className = 'flex items-start gap-3 flex-row-reverse';
        div.innerHTML = `<div class="w-10 h-10 rounded-full bg-tech-blue text-white flex items-center justify-center flex-shrink-0 shadow-md"><i class="fas fa-user"></i></div>
            <div class="bg-blue-50 p-4 rounded-2xl rounded-tr-none shadow border border-blue-100 text-gray-800 max-w-[80%] leading-relaxed">${html}</div>`;
    } else {
        div.className = 'flex items-start gap-3';
        div.innerHTML = `<div class="w-10 h-10 rounded-full bg-tech-blue text-white flex items-center justify-center flex-shrink-0 shadow-md"><i class="fas fa-robot"></i></div>
            <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow border border-gray-100 text-gray-700 leading-relaxed max-w-[80%]">${html}</div>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div.querySelector('div:last-child');
}

function askSuggest(btn) {
    chatInput.value = btn.innerText.trim();
    sendChatMessage();
}

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage('user', simpleFormat(text));
    chatInput.value = '';
    const bubble = appendMessage('ai', '<i class="fas fa-circle-notch fa-spin text-tech-blue"></i> 正在检索非遗知识库…');
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text }),
        });
        const data = await resp.json();
        let content, notice = '';
        if (data.ok) {
            content = data.answer;
            if (data.offline) {
                notice = '<br><span class="text-xs text-gray-400 mt-2 inline-block"><i class="fas fa-wifi mr-1"></i>当前为离线知识库模式，联网后可获得更详尽解答</span>';
            }
        } else {
            content = data.msg || '出错了，请稍后再试';
        }
        bubble.innerHTML = simpleFormat(content) + notice;
    } catch (e) {
        bubble.innerHTML = '<span class="text-rose-500"><i class="fas fa-exclamation-circle mr-1"></i>网络异常，请稍后再试</span>';
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
