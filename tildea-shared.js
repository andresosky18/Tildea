// ═══════════════════════════════════════════════════
//  TILDEA — Shared JS
//  Dark mode · Hamburger · Toast notifications · Onboarding
// ═══════════════════════════════════════════════════

// ── Dark Mode ────────────────────────────────────────
(function() {
  const saved = localStorage.getItem('tildea-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleDark() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tildea-theme', next);
  // Update toggle icon
  document.querySelectorAll('.dark-toggle i').forEach(i => {
    i.className = next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  });
}

function initDarkToggle() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.querySelectorAll('.dark-toggle i').forEach(i => {
    i.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  });
}

// ── Hamburger / Mobile Nav ────────────────────────────
function toggleMobileNav() {
  const nav = document.getElementById('mobileNav');
  const ham = document.getElementById('hamburgerBtn');
  if (!nav || !ham) return;
  const isOpen = nav.classList.toggle('open');
  ham.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileNav() {
  const nav = document.getElementById('mobileNav');
  const ham = document.getElementById('hamburgerBtn');
  if (nav) nav.classList.remove('open');
  if (ham) ham.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Toast Notifications ───────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${msg}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()">
      <i class="bi bi-x"></i>
    </button>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 380);
  }, duration);
}

// ── Onboarding ────────────────────────────────────────
const ONBOARD_STEPS = [
  {
    icon: '👋',
    iconBg: 'linear-gradient(135deg,#E3F2FD,#BBDEFB)',
    title: '¡Bienvenido a Tildea!',
    text: 'Tildea corrige tu ortografía y gramática en tiempo real mientras escribes en WhatsApp, Gmail, Google Docs y miles de sitios más.',
    btn: 'Siguiente →',
  },
  {
    icon: '⚡',
    iconBg: 'linear-gradient(135deg,#FFF3EE,#FFD8C4)',
    title: 'Instala la extensión',
    text: 'Para corregir mientras escribes en cualquier web, necesitas la extensión de Chrome. ¡Tarda menos de 30 segundos!',
    btn: 'Instalar Chrome →',
    link: 'install.html',
  },
  {
    icon: '📖',
    iconBg: 'linear-gradient(135deg,#E8F8F4,#C3F0E4)',
    title: 'Tu diccionario personal',
    text: 'Agrega palabras propias — nombres, marcas, términos técnicos — para que Tildea nunca las marque como error.',
    btn: 'Ir al diccionario →',
    action: () => document.getElementById('dict-section')?.scrollIntoView({ behavior: 'smooth' }),
  },
  {
    icon: '🚀',
    iconBg: 'linear-gradient(135deg,#EDE7F6,#D1C4E9)',
    title: '¡Listo para escribir perfecto!',
    text: 'Tu cuenta está configurada. Usa el corrector online, revisa tus estadísticas y actualiza a Pro cuando lo necesites.',
    btn: '¡Empezar!',
  },
];

let onboardStep = 0;

function showOnboarding() {
  if (localStorage.getItem('tildea-onboarded')) return;
  const overlay = document.getElementById('onboardOverlay');
  if (!overlay) return;
  onboardStep = 0;
  renderOnboardStep();
  overlay.classList.add('show');
}

function renderOnboardStep() {
  const step = ONBOARD_STEPS[onboardStep];
  const total = ONBOARD_STEPS.length;
  const modal = document.getElementById('onboardModal');
  if (!modal || !step) return;

  // Dots
  const dots = Array.from({ length: total }, (_, i) => {
    let cls = 'step-dot';
    if (i < onboardStep) cls += ' done';
    else if (i === onboardStep) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');

  modal.innerHTML = `
    <div class="onboard-step-indicator">${dots}</div>
    <div class="onboard-icon" style="background:${step.iconBg}">${step.icon}</div>
    <h2>${step.title}</h2>
    <p>${step.text}</p>
    <div class="onboard-actions">
      <button class="btn-onboard-next" onclick="nextOnboardStep()">${step.btn}</button>
      ${onboardStep < total - 1 ? '<button class="btn-onboard-skip" onclick="skipOnboarding()">Saltar</button>' : ''}
    </div>`;
}

function nextOnboardStep() {
  const step = ONBOARD_STEPS[onboardStep];
  if (step.link) {
    window.location.href = step.link;
    return;
  }
  if (step.action) step.action();

  onboardStep++;
  if (onboardStep >= ONBOARD_STEPS.length) {
    skipOnboarding();
    showToast('¡Bienvenido a Tildea! 🎉', 'success');
    return;
  }
  renderOnboardStep();
}

function skipOnboarding() {
  const overlay = document.getElementById('onboardOverlay');
  if (overlay) overlay.classList.remove('show');
  localStorage.setItem('tildea-onboarded', '1');
}

// ── Reveal on scroll (shared) ─────────────────────────
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── Nav scroll effect ─────────────────────────────────
function initNavScroll(id = 'navbar') {
  const nav = document.getElementById(id);
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));
}

// ── Init all on DOM ready ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkToggle();
  initNavScroll();
  initReveal();

  // Close mobile nav when clicking a link
  document.querySelectorAll('#mobileNav a').forEach(a => {
    a.addEventListener('click', closeMobileNav);
  });

  // Close mobile nav on outside click
  document.addEventListener('click', e => {
    const nav = document.getElementById('mobileNav');
    const ham = document.getElementById('hamburgerBtn');
    if (nav && ham && nav.classList.contains('open')
        && !nav.contains(e.target) && !ham.contains(e.target)) {
      closeMobileNav();
    }
  });
});
