// ---------- 导航栏 ----------
const navToggle = document.getElementById('nav-toggle');
const navMobile = document.getElementById('nav-mobile');
if (navToggle) navToggle.addEventListener('click', () => navMobile.classList.toggle('hidden'));

// ---------- 返回顶部 + 滚动进度 ----------
const scrollTopBtn = document.getElementById('scroll-to-top-btn');
const scrollProgress = document.getElementById('scroll-progress-circle');
const CIRCUMFERENCE = 125.6;

function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    let percentage = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    scrollProgress.style.strokeDashoffset = CIRCUMFERENCE - percentage * CIRCUMFERENCE;
    if (scrollTop > 100) {
        scrollTopBtn.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
    } else {
        scrollTopBtn.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
    }
}
window.addEventListener('scroll', updateScrollProgress);
window.addEventListener('DOMContentLoaded', updateScrollProgress);

// ---------- 滚动入场动画 ----------
window.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.scroll-bounce, .fade-up').forEach(el => observer.observe(el));
});

// ---------- 登录态 ----------
async function api(url, options = {}) {
    const resp = await fetch(url, {
        headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        ...options,
    });
    return resp.json();
}

async function logout() {
    await api('/api/logout', { method: 'POST' });
    location.reload();
}
