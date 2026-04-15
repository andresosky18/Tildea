// ═══════════════════════════════════════════════════════
//  TILDEA — Corrector inteligente v7
//  Mejoras: contador palabras, copiar, stats, atajos,
//  auto-check al pegar, historial, mejor UX panel
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  TILDEA — Sistema de planes (corrector online)
//  - Gratis: 20 correcciones por sesión, sin gramática IA
//  - Pro/Teams: ilimitado, gramática IA, sin banners
// ═══════════════════════════════════════════════════════

// ── Plan state ────────────────────────────────────────
const PLAN = {
  FREE_LIMIT: 20,
  current: 'free',
  usedToday: 0,
  dismissed: false,
};

// Firebase refs (populated when user logs in)
let _fbUser = null;
// Pending individual word corrections to write
window._pendingWords = [];
let _fbDb   = null;
let _fbDoc  = null;
let _fbIncrement = null;
let _fbArrayUnion = null;
let _pendingStats  = 0;
let _statsTimer    = null;

// Load plan from Firebase (lazy, non-blocking)
async function loadUserPlan() {
  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const cfg = {
      apiKey:"AIzaSyAuYd7g-d9j-xDdy7--bj4j5g550b36a14",
      authDomain:"tildea-47a04.firebaseapp.com",
      projectId:"tildea-47a04",
      storageBucket:"tildea-47a04.firebasestorage.app",
      messagingSenderId:"653195240806",
      appId:"1:653195240806:web:94f09a861cbdbd782394a7"
    };
    const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    const { updateDoc, increment, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    onAuthStateChanged(auth, async user => {
      if (!user) { applyPlan('free'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        const plan = data.plan || 'free';
        const active = data.planActive !== false;
        const expiry = data.planExpiry ? new Date(data.planExpiry.seconds * 1000) : null;
        const expired = expiry && expiry < new Date();

        // Save Firebase refs for stats writing
        _fbUser      = user;
        _fbDb        = db;
        _fbDoc       = doc;
        _fbIncrement = increment;
        _fbArrayUnion = arrayUnion;

        applyPlan(active && !expired ? plan : 'free', user);
      } catch { applyPlan('free', user); }
    });
  } catch(e) {
    applyPlan('free');
  }
}

function applyPlan(plan, user) {
  PLAN.current = plan;
  const isPro = plan === 'pro' || plan === 'teams';

  // Plan indicator bar
  const planBar = document.getElementById('planBar');
  const usageBar = document.getElementById('usageBar');
  const proHint  = document.getElementById('proHint');

  if (isPro) {
    if (planBar) {
      const badge = document.getElementById('planBarBadge');
      const name  = document.getElementById('planBarName');
      if (badge) badge.textContent = plan === 'teams' ? '👥 Equipos' : '⚡ Pro';
      if (name)  name.textContent  = 'Todas las funciones activas';
      planBar.style.display = 'flex';
    }
    if (usageBar) usageBar.style.display = 'none';
    if (proHint)  proHint.style.display  = 'none';
    // Hide ads for Pro/Teams
    if (window.tildeaHideAds) window.tildeaHideAds();
  } else {
    if (planBar)  planBar.style.display  = 'none';
    if (usageBar) usageBar.style.display = 'flex';
    updateUsageBar();
    // Show ads for Free users
    if (window.tildeaShowAds) window.tildeaShowAds();
  }
}

function updateUsageBar() {
  const countEl = document.getElementById('usageCount');
  const fillEl  = document.getElementById('usageFill');
  if (countEl) countEl.textContent = PLAN.usedToday;
  if (fillEl) {
    const pct = (PLAN.usedToday / PLAN.FREE_LIMIT) * 100;
    fillEl.style.width = Math.min(pct, 100) + '%';
    fillEl.className = 'usage-fill' + (pct >= 100 ? ' danger' : pct >= 75 ? ' warn' : '');
  }
}

function isAtLimit() {
  if (PLAN.current === 'pro' || PLAN.current === 'teams') return false;
  return PLAN.usedToday >= PLAN.FREE_LIMIT;
}

function incrementUsage() {
  if (PLAN.current === 'free') {
    PLAN.usedToday++;
    updateUsageBar();
  }
}

function showPaywall() {
  if (PLAN.dismissed) return;
  const pw = document.getElementById('corrPaywall');
  if (pw) pw.style.display = 'flex';
}

function dismissPaywall() {
  PLAN.dismissed = true;
  const pw = document.getElementById('corrPaywall');
  if (pw) pw.style.display = 'none';
}
window.dismissPaywall = dismissPaywall;

// ── Write stats to Firebase (debounced, batched) ─────
async function writeStatsToFirebase(count) {
  if (!_fbUser || !_fbDb || !_fbDoc || !_fbIncrement) return;
  _pendingStats += count;
  clearTimeout(_statsTimer);
  _statsTimer = setTimeout(async () => {
    if (_pendingStats <= 0) return;
    const toWrite = _pendingStats;
    _pendingStats = 0;
    try {
      const today = new Date().getDay(); // 0=Sun..6=Sat
      const dayIdx = (today + 6) % 7;   // Mon=0..Sun=6
      const weeklyField = `stats.weekly.${dayIdx}`;

      await _fbDoc(_fbDb, 'users', _fbUser.uid); // get ref
      const userRef = _fbDoc(_fbDb, 'users', _fbUser.uid);

      // Build update: increment totals + today's slot in weekly array
      // We use a transaction-like approach with increment
      const { getDoc, updateDoc, arrayUnion, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {};
      const stats = data.stats || { total: 0, today: 0, streak: 0, weekly: [0,0,0,0,0,0,0] };

      // Update weekly array
      const weekly = [...(stats.weekly || [0,0,0,0,0,0,0])];
      while (weekly.length < 7) weekly.push(0);
      weekly[dayIdx] = (weekly[dayIdx] || 0) + toWrite;

      // Check streak: last correction date
      const todayStr = new Date().toDateString();
      const lastDate = data.lastCorrectionDate || '';
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      let streak = stats.streak || 0;
      if (lastDate === todayStr) {
        // Same day, no streak change
      } else if (lastDate === yesterday) {
        streak += 1; // consecutive day
      } else if (lastDate !== todayStr) {
        streak = 1; // reset or first time today
      }

      await updateDoc(userRef, {
        'stats.total': _fbIncrement(toWrite),
        'stats.today': _fbIncrement(toWrite),
        'stats.streak': streak,
        'stats.weekly': weekly,
        lastCorrectionDate: todayStr,
      });

      // Log individual corrections to history (stored separately)
      // _pendingWords is populated by doFix/applyFix
      if (window._pendingWords && window._pendingWords.length > 0) {
        const words = window._pendingWords.splice(0);
        for (const entry of words) {
          await updateDoc(userRef, {
            recentCorrections: arrayUnion(entry),
          });
        }
      } else {
        // Fallback: log as session entry
        const recent = {
          count: toWrite,
          date: new Date().toISOString(),
          lang: currentLang,
          type: 'session',
        };
        await updateDoc(userRef, {
          recentCorrections: arrayUnion(recent),
        });
      }

    } catch(e) {
      console.warn('Stats write error:', e);
    }
  }, 2000); // batch writes with 2s debounce
}



function showGrammarTeaser(hasSpelling) {
  // Show teaser for free users if text is long enough to have grammar issues
  if (PLAN.current !== 'free') return;
  const teaser = document.getElementById('grammarTeaser');
  if (!teaser) return;
  // Show teaser if text > 50 chars and no spelling errors found (likely grammar issues)
  const inp = document.getElementById('correctorInput');
  const text = inp ? inp.value : '';
  if (text.length > 50 && hasSpelling === false) {
    teaser.classList.add('show');
  } else {
    teaser.classList.remove('show');
  }
}

let currentLang  = 'es';
let errors       = [];
let isChecking   = false;
let debounceTimer = null;
let tooltipIdx   = -1;
let hideTimer    = null;
let correctionCount = 0; // session corrections applied

const LT_URL  = 'https://api.languagetool.org/v2/check';
const LT_LANG = { es: 'es', en: 'en-US' };

// ── Diccionario offline ───────────────────────────────
const DICT_ES = {
  'komo':'cómo','ke':'que','kien':'quién','kiere':'quiere','kiero':'quiero',
  'kasa':'casa','kalle':'calle','klaro':'claro','kual':'cual','kuando':'cuando',
  'eztas':'estás','eztoy':'estoy','eztaba':'estaba','ezo':'eso','zoy':'soy',
  'vien':'bien','mui':'muy','ola':'hola','aser':'hacer','aber':'haber',
  'haiga':'haya','tubo':'tuvo','baya':'vaya','saver':'saber','bengo':'vengo',
  'bamos':'vamos','beo':'veo','bida':'vida','biaje':'viaje','biejo':'viejo',
  'bolber':'volver','estaz':'estás',
  'xq':'porque','porq':'porque','porke':'porque','xke':'porque','pk':'porque',
  'q':'que','k':'que','tb':'también','tmb':'también','tmbn':'también',
  'graxias':'gracias','grasias':'gracias','wenas':'buenas','weno':'bueno',
  'aki':'aquí','ahi':'ahí','aca':'acá','alla':'allá',
  'tambien':'también','ademas':'además','despues':'después','recien':'recién',
  'pagina':'página','numero':'número','ultimo':'último','rapido':'rápido',
  'telefono':'teléfono','musica':'música','medico':'médico','basico':'básico',
  'clasico':'clásico','tipico':'típico','logico':'lógico','magico':'mágico',
  'fisico':'físico','practico':'práctico','historico':'histórico',
  'automatico':'automático','electronico':'electrónico','economico':'económico',
  'dinamico':'dinámico','fantastico':'fantástico','grafico':'gráfico',
  'publico':'público','unico':'único','proximo':'próximo',
  'estas':'estás','esta':'está','estan':'están','seria':'sería',
  'podria':'podría','queria':'quería','tenia':'tenía','habia':'había',
  'venia':'venía','sabia':'sabía','decia':'decía',
  'nacion':'nación','version':'versión','relacion':'relación',
  'situacion':'situación','opinion':'opinión','camion':'camión',
  'corazon':'corazón','razon':'razón','millon':'millón',
  'accion':'acción','leccion':'lección',
  'haber':'haber','a ver':'a ver','aver':'a ver',
  'por favor':'por favor','porfa':'por favor',
  'osea':'o sea','ps':'pues','wey':'güey',
  'mas':'más','si':'sí','tu':'tú','el':'él','mi':'mí',
  'de':'de','se':'sé','te':'té',
};
const DICT_EN = {
  'recieve':'receive','beleive':'believe','seperate':'separate',
  'definitly':'definitely','definately':'definitely','occured':'occurred',
  'tommorow':'tomorrow','becuase':'because','alot':'a lot',
  'untill':'until','wierd':'weird','freind':'friend','thier':'their',
  'wich':'which','writting':'writing','begining':'beginning',
  'comming':'coming','runing':'running','truely':'truly',
  'teh':'the','adn':'and','yuo':'you','hte':'the',
  'waht':'what','taht':'that','dont':'don\'t','cant':'can\'t',
  'wont':'won\'t','im':'I\'m','ive':'I\'ve','id':'I\'d',
};

// ── DOM helpers ───────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Stats counter ─────────────────────────────────────
function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function updateStats(text) {
  const chars   = text.length;
  const words   = countWords(text);
  const cc = $('charCount');
  if (cc) {
    cc.textContent = `${words} palabra${words !== 1 ? 's' : ''} · ${chars} caracter${chars !== 1 ? 'es' : ''}`;
  }
}

// ── Badge ─────────────────────────────────────────────
function setBadge(state, count) {
  const b = $('errorBadge'); if (!b) return;
  if (state === 'loading') {
    b.className = 'error-badge loading';
    b.innerHTML = '<span class="lt-spinner"></span>Analizando…';
  } else if (state === 'ok') {
    b.className = 'error-badge no-errors';
    b.innerHTML = '<i class="bi bi-check-circle-fill"></i>Sin errores';
  } else {
    const spell   = errors.filter(e => e.type === 'spelling').length;
    const grammar = errors.filter(e => e.type === 'grammar').length;
    let detail = '';
    if (spell > 0 && grammar > 0) detail = ` (${spell} ortografía · ${grammar} gramática)`;
    else if (spell > 0)            detail = ` · ${spell} ortografía`;
    else if (grammar > 0)          detail = ` · ${grammar} gramática`;
    b.className = 'error-badge has-errors';
    b.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i>${count} error${count > 1 ? 'es' : ''}${detail}`;
  }
}

function setBtn(loading) {
  const btn = $('btnCheck') || document.querySelector('.btn-check');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="lt-spinner lt-spinner-white"></span>Analizando…'
    : '<i class="bi bi-spellcheck"></i>Corregir texto';
}

// ── Copy button ───────────────────────────────────────
function copyText() {
  const inp = $('correctorInput'); if (!inp) return;
  const text = inp.value;
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = $('btnCopy'); if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-lg"></i>Copiado';
    btn.style.color = 'var(--green)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.color = '';
    }, 2000);
  }).catch(() => {
    // Fallback
    inp.select();
    document.execCommand('copy');
  });
}

// ── Highlight ─────────────────────────────────────────
function applyHighlight(text, errs) {
  const hl = $('correctorHighlight'); if (!hl) return;
  let html = '', cursor = 0;
  errs.forEach((err, i) => {
    html += esc(text.slice(cursor, err.start));
    const cls = err.type === 'grammar' ? 'err-grammar' : 'err-spell';
    html += `<mark class="${cls}" data-idx="${i}">${esc(text.slice(err.start, err.end))}</mark>`;
    cursor = err.end;
  });
  html += esc(text.slice(cursor));
  hl.innerHTML = html.replace(/\n/g, '<br>');
}

// ── Tooltip ───────────────────────────────────────────
function showTooltip(idx, markEl) {
  const err = errors[idx];
  const tip = $('corrTooltip');
  if (!err || !tip) return;
  clearTimeout(hideTimer);
  tooltipIdx = idx;

  const typeEl = $('cttType');
  if (typeEl) {
    const isG = err.type === 'grammar';
    typeEl.textContent = isG ? 'Gramática' : 'Ortografía';
    typeEl.className   = 'ctt-type ' + (isG ? 'grammar' : 'spell');
  }
  const wordEl = $('cttWord'); if (wordEl) wordEl.textContent = err.original;
  const msgEl  = $('cttMsg');  if (msgEl)  msgEl.textContent  = err.msg || '';

  const fixesEl = $('cttFixes');
  if (fixesEl) {
    const all = err.allFixes && err.allFixes.length ? err.allFixes : [err.fix];
    fixesEl.innerHTML = all.slice(0, 4).map((fix, fi) =>
      fi === 0
        ? `<button class="ctt-fix" data-fix="${esc(fix)}" data-idx="${idx}">
             <i class="bi bi-check-lg"></i>${esc(fix)}
           </button>`
        : `<button class="ctt-fix-alt" data-fix="${esc(fix)}" data-idx="${idx}">${esc(fix)}</button>`
    ).join('');
  }

  const ignBtn = $('cttIgnore');
  if (ignBtn) ignBtn.dataset.idx = idx;

  tip.style.display = 'block';
  tip.classList.remove('visible');

  const rect   = markEl.getBoundingClientRect();
  const tipW   = 268;
  const tipH   = tip.scrollHeight || 180;
  const gap    = 10;
  const arrow  = $('cttArrow');

  let left = rect.left;
  let top  = rect.bottom + gap;
  let arrowUp = false;

  if (rect.bottom + tipH + gap > window.innerHeight) {
    top = rect.top - tipH - gap;
    arrowUp = true;
  }
  if (arrow) arrow.className = 'ctt-arrow' + (arrowUp ? ' arrow-up' : '');

  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

  const markCX    = rect.left + rect.width / 2;
  const arrowLeft = Math.max(12, Math.min(markCX - left, tipW - 24));
  if (arrow) arrow.style.left = arrowLeft + 'px';

  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';

  requestAnimationFrame(() => tip.classList.add('visible'));
}

function hideTooltip() {
  const tip = $('corrTooltip'); if (!tip) return;
  tip.classList.remove('visible');
  setTimeout(() => {
    if (!tip.classList.contains('visible')) tip.style.display = 'none';
  }, 200);
  document.querySelectorAll('mark.active-mark')
    .forEach(m => m.classList.remove('active-mark'));
  tooltipIdx = -1;
}

function scheduleHide(delay) {
  hideTimer = setTimeout(hideTooltip, delay || 250);
}

// ── Apply fixes ───────────────────────────────────────
function doFix(idx, fix) {
  const err = errors[idx]; if (!err) return;
  const inp = $('correctorInput'); if (!inp) return;
  const cap = err.original[0] === err.original[0].toUpperCase()
    && err.original[0] !== err.original[0].toLowerCase();
  const fixed = cap ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix;

  const mark = document.querySelector(`mark[data-idx="${idx}"]`);
  if (mark) {
    mark.style.transition = 'background .12s';
    mark.style.background = 'rgba(0,200,150,.3)';
  }
  correctionCount++;
  updateSessionCounter();
  // Record individual correction for history
  if (window._pendingWords) {
    window._pendingWords.push({
      wrong: err.original,
      right: fixed,
      type: err.type,
      msg: err.msg || '',
      lang: currentLang,
      date: new Date().toISOString(),
    });
  }
  writeStatsToFirebase(1);

  setTimeout(() => {
    const inp2 = $('correctorInput'); if (!inp2) return;
    inp2.value = inp2.value.slice(0, err.start) + fixed + inp2.value.slice(err.end);
    hideTooltip();
    runCheck();
  }, 130);
}

function applyFix(i) {
  const err = errors[i]; if (!err) return;
  const inp = $('correctorInput'); if (!inp) return;
  const cap = err.original[0] === err.original[0].toUpperCase()
    && err.original[0] !== err.original[0].toLowerCase();
  const fixed = cap ? err.fix.charAt(0).toUpperCase() + err.fix.slice(1) : err.fix;
  correctionCount++;
  updateSessionCounter();
  if (window._pendingWords) {
    window._pendingWords.push({
      wrong: err.original, right: fixed,
      type: err.type, msg: err.msg || '',
      lang: currentLang, date: new Date().toISOString(),
    });
  }
  writeStatsToFirebase(1);
  inp.value = inp.value.slice(0, err.start) + fixed + inp.value.slice(err.end);
  runCheck();
}

function applyAllFixes() {
  const inp = $('correctorInput'); if (!inp) return;
  let text = inp.value;
  const count = errors.length;
  [...errors].sort((a, b) => b.start - a.start).forEach(err => {
    const cap = err.original[0] === err.original[0].toUpperCase()
      && err.original[0] !== err.original[0].toLowerCase();
    const fixed = cap ? err.fix.charAt(0).toUpperCase() + err.fix.slice(1) : err.fix;
    text = text.slice(0, err.start) + fixed + text.slice(err.end);
  });
  inp.value = text;
  correctionCount += count;
  updateSessionCounter();
  // Record all corrections individually
  if (window._pendingWords) {
    [...errors].forEach(err => {
      const cap = err.original[0] === err.original[0].toUpperCase() && err.original[0] !== err.original[0].toLowerCase();
      const fixed2 = cap ? err.fix.charAt(0).toUpperCase() + err.fix.slice(1) : err.fix;
      window._pendingWords.push({
        wrong: err.original, right: fixed2,
        type: err.type, msg: err.msg || '',
        lang: currentLang, date: new Date().toISOString(),
      });
    });
  }
  writeStatsToFirebase(count);

  // Flash success
  const box = document.querySelector('.corrector-box');
  if (box) {
    box.style.borderColor = 'var(--green)';
    setTimeout(() => box.style.borderColor = '', 800);
  }
  runCheck();
}

function ignoreError(idx) {
  if (idx < 0 || idx >= errors.length) { hideTooltip(); return; }
  errors.splice(idx, 1);
  hideTooltip();
  const inp = $('correctorInput');
  if (inp) applyHighlight(inp.value, errors);
  setBadge(errors.length === 0 ? 'ok' : 'errors', errors.length);
  renderPanel();
}

// ── Session counter ───────────────────────────────────
function updateSessionCounter() {
  const el = $('sessionCorrections');
  if (el) el.textContent = correctionCount;
  const wrap = $('sessionCountWrap');
  if (wrap) wrap.style.display = correctionCount > 0 ? 'flex' : 'none';
}

// ── Panel ─────────────────────────────────────────────
function renderPanel() {
  const panel    = $('errorsPanel');
  const chips    = $('errChips');
  const countEl  = $('errPanelCount');
  const applyAll = $('btnApplyAll');
  if (!panel) return;

  if (!errors.length) {
    panel.classList.remove('show');
    if (applyAll) applyAll.style.display = 'none';
    return;
  }
  panel.classList.add('show');
  if (applyAll) applyAll.style.display = errors.length > 1 ? 'flex' : 'none';

  const spellCount   = errors.filter(e => e.type === 'spelling').length;
  const grammarCount = errors.filter(e => e.type === 'grammar').length;

  if (countEl) {
    let detail = '';
    if (spellCount > 0 && grammarCount > 0) detail = ` <span style="color:var(--faint);font-weight:400;font-size:12px;">(${spellCount} ortografía · ${grammarCount} gramática)</span>`;
    else if (spellCount > 0)  detail = ` <span style="color:var(--faint);font-weight:400;font-size:12px;">· ${spellCount} ortografía</span>`;
    else if (grammarCount > 0) detail = ` <span style="color:var(--faint);font-weight:400;font-size:12px;">· ${grammarCount} gramática</span>`;
    countEl.innerHTML = `${errors.length} corrección${errors.length > 1 ? 'es' : ''} sugerida${errors.length > 1 ? 's' : ''}${detail}`;
  }

  if (!chips) return;

  chips.innerHTML = errors.map((err, i) => `
    <div class="err-chip" data-chip="${i}">
      <span class="err-chip-dot${err.type === 'grammar' ? ' dot-grammar' : ''}"></span>
      <div class="err-chip-info">
        <div class="err-chip-row">
          <span class="err-chip-wrong">${esc(err.original)}</span>
          <i class="bi bi-arrow-right" style="color:var(--faint);font-size:11px"></i>
          <span class="err-chip-fix">${esc(err.fix)}</span>
        </div>
        <div class="err-chip-msg">${esc(err.msg)}</div>
      </div>
      <div class="err-chip-actions">
        <button class="err-chip-btn" data-apply="${i}" title="Aplicar corrección">
          <i class="bi bi-check-lg"></i>Aplicar
        </button>
        <button class="err-chip-ignore" data-ignore="${i}" title="Ignorar">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>`).join('');

  // Hover → highlight mark
  chips.querySelectorAll('.err-chip').forEach(chip => {
    const i = parseInt(chip.dataset.chip, 10);
    chip.addEventListener('mouseenter', () => {
      document.querySelectorAll('mark.active-mark').forEach(m => m.classList.remove('active-mark'));
      const mark = document.querySelector(`mark[data-idx="${i}"]`);
      if (mark) { mark.classList.add('active-mark'); mark.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
    chip.addEventListener('mouseleave', () => {
      const mark = document.querySelector(`mark[data-idx="${i}"]`);
      if (mark) mark.classList.remove('active-mark');
    });
    // Click chip → scroll to mark + show tooltip
    chip.addEventListener('click', e => {
      if (e.target.closest('[data-apply]') || e.target.closest('[data-ignore]')) return;
      const mark = document.querySelector(`mark[data-idx="${i}"]`);
      if (mark) { mark.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); showTooltip(i, mark); }
    });
  });

  chips.querySelectorAll('[data-apply]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      applyFix(parseInt(btn.dataset.apply, 10));
    });
  });

  chips.querySelectorAll('[data-ignore]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ignoreError(parseInt(btn.dataset.ignore, 10));
    });
  });
}

function clearAll() {
  const inp = $('correctorInput');   if (inp) inp.value = '';
  const hl  = $('correctorHighlight'); if (hl) hl.innerHTML = '';
  const panel = $('errorsPanel');    if (panel) panel.classList.remove('show');
  const cc  = $('charCount');        if (cc) cc.textContent = '0 palabras · 0 caracteres';
  const ab  = $('btnApplyAll');      if (ab) ab.style.display = 'none';
  setBadge('ok');
  hideTooltip();
  errors = [];
}

// ── LanguageTool API ──────────────────────────────────
async function checkWithLT(text) {
  const params = new URLSearchParams({
    text, language: LT_LANG[currentLang] || 'es',
    enabledOnly: 'false', level: 'picky',
  });
  const resp = await fetch(LT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: params.toString(),
  });
  if (!resp.ok) throw new Error('LT ' + resp.status);
  return resp.json();
}

function parseLT(data, text) {
  if (!data || !Array.isArray(data.matches)) return [];
  return data.matches
    .filter(m => m.replacements && m.replacements.length > 0)
    .map(m => ({
      original: text.slice(m.offset, m.offset + m.length),
      fix:      m.replacements[0].value,
      allFixes: m.replacements.slice(0, 4).map(r => r.value),
      msg:      m.message || 'Posible error',
      type:     (m.rule && !m.rule.id.includes('MORFOLOGIK') && !m.rule.id.includes('SPELL'))
                  ? 'grammar' : 'spelling',
      start: m.offset,
      end:   m.offset + m.length,
    }));
}

function checkOffline(text) {
  const dict = currentLang === 'es' ? DICT_ES : DICT_EN;
  const found = [];
  const re = /[\w\u00C0-\u024F]+/gu;
  let m;
  while ((m = re.exec(text)) !== null) {
    const lo = m[0].toLowerCase();
    if (dict[lo] && dict[lo] !== lo) {
      found.push({
        original: m[0], fix: dict[lo], allFixes: [dict[lo]],
        msg: currentLang === 'es'
          ? 'Posible error ortográfico' : 'Possible spelling error',
        type: 'spelling', start: m.index, end: m.index + m[0].length,
      });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

async function runCheck() {
  const inp = $('correctorInput'); if (!inp) return;
  const text = inp.value;
  if (!text.trim()) { clearAll(); return; }
  if (isChecking) return;

  // ── Plan limit check ──────────────────────────────
  if (isAtLimit()) {
    showPaywall();
    return;
  }

  isChecking = true;
  setBadge('loading');
  setBtn(true);
  hideTooltip();

  let usedLT = false;
  let ltErrors = [];

  try {
    const data = await checkWithLT(text);
    ltErrors = parseLT(data, text);
    usedLT = true;

    // For FREE users: only show spelling errors, not grammar
    if (PLAN.current === 'free') {
      errors = ltErrors.filter(e => e.type === 'spelling');
      // Show grammar teaser if LanguageTool found grammar issues
      const hasGrammar = ltErrors.some(e => e.type === 'grammar');
      showGrammarTeaser(hasGrammar ? true : false);
    } else {
      errors = ltErrors;
      // Hide grammar teaser for Pro users
      const teaser = document.getElementById('grammarTeaser');
      if (teaser) teaser.classList.remove('show');
    }

    // Supplement with offline dict
    checkOffline(text).forEach(oe => {
      const covered = errors.some(e =>
        (oe.start >= e.start && oe.start < e.end) ||
        (e.start >= oe.start && e.start < oe.end)
      );
      if (!covered) errors.push(oe);
    });
    errors.sort((a, b) => a.start - b.start);

  } catch(e) {
    errors = checkOffline(text);
    showGrammarTeaser(false);
  }

  isChecking = false;
  setBtn(false);
  applyHighlight(text, errors);
  setBadge(errors.length === 0 ? 'ok' : 'errors', errors.length);
  renderPanel();

  // Increment usage counter for free users
  incrementUsage();

  // Show paywall warning at 75% usage
  if (PLAN.current === 'free' && PLAN.usedToday >= Math.floor(PLAN.FREE_LIMIT * 0.75)) {
    const usageBar = document.getElementById('usageBar');
    if (usageBar) {
      usageBar.style.border = '1.5px solid #FF9800';
      setTimeout(() => {
        if (usageBar) usageBar.style.border = '';
      }, 2000);
    }
  }
}

function setLang(l) {
  currentLang = l;
  const es = $('langEs'); const en = $('langEn');
  if (es) es.classList.toggle('active', l === 'es');
  if (en) en.classList.toggle('active', l === 'en');
  const inp = $('correctorInput');
  if (inp && inp.value.trim()) runCheck();
}

function togglePfaq(el) { if (el) el.closest('.pfaq-item').classList.toggle('open'); }

// ── Keyboard shortcuts ────────────────────────────────
function setupShortcuts() {
  document.addEventListener('keydown', e => {
    // Ctrl/Cmd + Enter → check
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const inp = $('correctorInput');
      if (inp === document.activeElement || !inp) {
        e.preventDefault();
        runCheck();
      }
    }
    // Ctrl/Cmd + Shift + C → copy
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      copyText();
    }
    // Escape → close tooltip
    if (e.key === 'Escape') hideTooltip();
  });
}

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inp = $('correctorInput');
  const hl  = $('correctorHighlight');
  if (!inp) return;

  // Sync scroll
  inp.addEventListener('scroll', () => { if (hl) hl.scrollTop = inp.scrollTop; });

  // Input: debounced check + stats
  inp.addEventListener('input', () => {
    updateStats(inp.value);
    if (hl) hl.innerHTML = '';
    hideTooltip();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (inp.value.trim()) runCheck(); else clearAll();
    }, 700);
  });

  // Paste: immediate check (after paste is processed)
  inp.addEventListener('paste', () => {
    setTimeout(() => {
      updateStats(inp.value);
      clearTimeout(debounceTimer);
      if (inp.value.trim()) runCheck();
    }, 50);
  });

  // ── Event delegation on highlight overlay ──────────
  if (hl) {
    hl.addEventListener('mouseenter', e => {
      const mark = e.target.closest('mark[data-idx]');
      if (!mark) return;
      clearTimeout(hideTimer);
      const idx = parseInt(mark.dataset.idx, 10);
      mark.classList.add('active-mark');
      showTooltip(idx, mark);
    }, true);

    hl.addEventListener('mouseleave', e => {
      const mark = e.target.closest('mark[data-idx]');
      if (!mark) return;
      mark.classList.remove('active-mark');
      scheduleHide(280);
    }, true);

    hl.addEventListener('click', e => {
      const mark = e.target.closest('mark[data-idx]');
      if (!mark) return;
      const idx = parseInt(mark.dataset.idx, 10);
      const tip = $('corrTooltip');
      if (tooltipIdx === idx && tip && tip.classList.contains('visible')) {
        hideTooltip();
      } else {
        showTooltip(idx, mark);
      }
    });
  }

  // Tooltip hover
  const tip = $('corrTooltip');
  if (tip) {
    tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    tip.addEventListener('mouseleave', () => scheduleHide(280));
    tip.addEventListener('click', e => {
      const btn = e.target.closest('[data-fix]');
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10);
        doFix(idx, btn.dataset.fix);
      }
    });
  }

  const ignBtn = $('cttIgnore');
  if (ignBtn) {
    ignBtn.addEventListener('click', () => ignoreError(tooltipIdx));
  }

  document.addEventListener('click', e => {
    const tip2 = $('corrTooltip');
    if (!tip2) return;
    if (!tip2.contains(e.target) && !e.target.closest('mark')) hideTooltip();
  });

  // Nav scroll
  const nav = $('navbar');
  if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));

  // Reveal on scroll
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  // Shortcuts
  setupShortcuts();

  // Load user plan from Firebase (non-blocking)
  loadUserPlan();

  // Show shortcut hints
  const hint = $('shortcutHint');
  if (hint) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    hint.textContent = isMac ? '⌘↵ corregir · ⌘⇧C copiar' : 'Ctrl+↵ corregir · Ctrl+Shift+C copiar';
  }

  // Init counter display
  updateSessionCounter();
});
