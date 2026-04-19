/* ============================================================
   GRADUATION ANNOUNCEMENT SYSTEM — MAIN SCRIPT
   Features: Countdown, SHA-256 hash, fetch, student photo
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   ⚙️  CONFIGURATION — Edit this section
   ══════════════════════════════════════════════════════════ */

const CONFIG = {
  /*
   * Set the exact date and time when the announcement unlocks.
   * Format: 'YYYY-MM-DDTHH:MM:SS' in LOCAL TIME (school's timezone)
   * Example: '2025-06-15T09:00:00' = June 15 2025 at 09:00 AM
   *
   * To test the countdown RIGHT NOW, set a time a few minutes in the future.
   * To test with form ALREADY UNLOCKED, set a past date.
   */
  UNLOCK_DATE: '2026-04-20T23:00:00',

  /*
   * Student photo folder path.
   * Photos should be named using the student's NISN hash, e.g.:
   *   assets/photos/cbceea57731907646f0f9e163abc46cd41d6762cbc8a424636a307d5f4da30cb.jpg
   *
   * Supported extensions tried in order: .jpg, .jpeg, .png, .webp
   * If no photo is found, a placeholder is shown instead.
   *
   * Photo specs: 4:3 ratio, recommended 400x300px or 800x600px
   */
  PHOTO_PATH: './assets/photos/',
  PHOTO_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
};

/* ══════════════════════════════════════════════════════════
   UTILITY: SHA-256 via Web Crypto API
   ══════════════════════════════════════════════════════════ */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ══════════════════════════════════════════════════════════
   UTILITY: Fetch student data
   ══════════════════════════════════════════════════════════ */
async function fetchStudents() {
  const res = await fetch('./data/students.json');
  if (!res.ok) throw new Error('Gagal memuat data siswa.');
  return res.json();
}

/* ══════════════════════════════════════════════════════════
   UTILITY: Escape HTML (XSS protection)
   ══════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════════════════════
   COUNTDOWN LOGIC
   ══════════════════════════════════════════════════════════ */
function initCountdown(onUnlock) {
  const unlockTime = new Date(CONFIG.UNLOCK_DATE).getTime();

  const elDays    = document.getElementById('cd-days');
  const elHours   = document.getElementById('cd-hours');
  const elMinutes = document.getElementById('cd-minutes');
  const elSeconds = document.getElementById('cd-seconds');
  const elStatus  = document.getElementById('countdown-status');
  const formSection = document.getElementById('form-section');
  const submitBtn   = document.getElementById('submit-btn');

  if (!elDays) return; // Not on index page

  function pad(n) { return String(Math.max(0, n)).padStart(2, '0'); }

  function animateBox(el, newVal) {
    if (el.textContent !== newVal) {
      el.textContent = newVal;
      el.classList.remove('digit-changed');
      // Trigger reflow to restart animation
      void el.offsetWidth;
      el.classList.add('digit-changed');
    }
  }

  function tick() {
    const now  = Date.now();
    const diff = unlockTime - now;

    if (diff <= 0) {
      // UNLOCKED
      animateBox(elDays,    '00');
      animateBox(elHours,   '00');
      animateBox(elMinutes, '00');
      animateBox(elSeconds, '00');

      elStatus.textContent = '🎉 Pengumuman sudah dibuka! Silakan cek kelulusan Anda.';
      elStatus.classList.add('unlocked');

      formSection.classList.remove('locked');
      submitBtn.disabled = false;

      onUnlock();
      return; // Stop ticking
    }

    const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    animateBox(elDays,    pad(days));
    animateBox(elHours,   pad(hours));
    animateBox(elMinutes, pad(minutes));
    animateBox(elSeconds, pad(seconds));

    // Dynamic label
    if (days === 0 && hours === 0 && minutes < 5) {
      elStatus.textContent = '⏳ Sebentar lagi pengumuman dibuka!';
    } else {
      elStatus.textContent = 'Harap tunggu hingga waktu pengumuman tiba';
    }

    setTimeout(tick, 1000);
  }

  tick();
}

/* ══════════════════════════════════════════════════════════
   INDEX PAGE LOGIC
   ══════════════════════════════════════════════════════════ */
function initIndexPage() {
  const form      = document.getElementById('check-form');
  const input     = document.getElementById('nisn-input');
  const btn       = document.getElementById('submit-btn');
  const btnText   = document.getElementById('btn-text');
  const errorMsg  = document.getElementById('error-msg');

  if (!form) return;

  // Start countdown — unlock enables the form
  initCountdown(() => {
    // Called when countdown reaches zero
    // Form is already unlocked in initCountdown
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawNISN = input.value.trim();

    // ── Validation ──────────────────────────────────────
    errorMsg.textContent = '';
    errorMsg.classList.remove('visible');
    input.classList.remove('error');

    if (!rawNISN) {
      showError('Nomor NISN tidak boleh kosong.');
      return;
    }
    if (!/^\d{10}$/.test(rawNISN)) {
      showError('NISN harus terdiri dari 10 digit angka.');
      return;
    }

    setLoading(true);

    try {
      const [nisnHash, students] = await Promise.all([
        sha256(rawNISN),
        fetchStudents()
      ]);

      const found = students.find(s => s.nisn_hash === nisnHash);

      if (found) {
        localStorage.setItem('graduation_result', JSON.stringify({
          nisn_hash: nisnHash,
          nama:      found.nama,
          status:    found.status,
          pesan:     found.pesan,
          foto:      found.foto || null // optional: explicit filename in JSON
        }));
      } else {
        localStorage.setItem('graduation_result', JSON.stringify({
          nisn_hash: nisnHash,
          nama:      null,
          status:    'NOT_FOUND',
          pesan:     null,
          foto:      null
        }));
      }

      window.location.href = './result.html';

    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan. Pastikan koneksi internet aktif dan coba lagi.');
    } finally {
      setLoading(false);
    }
  });

  // Only numeric input
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
  });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('visible');
    input.classList.add('error');
    input.focus();
  }

  function setLoading(state) {
    btn.disabled = state;
    if (state) {
      btnText.innerHTML = '<span class="spinner"></span> Memeriksa...';
    } else {
      btnText.textContent = 'Cek Kelulusan';
    }
  }
}

/* ══════════════════════════════════════════════════════════
   RESULT PAGE LOGIC
   ══════════════════════════════════════════════════════════ */
function initResultPage() {
  const container = document.getElementById('result-container');
  if (!container) return;

  const raw = localStorage.getItem('graduation_result');

  if (!raw) {
    window.location.href = './index.html';
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    window.location.href = './index.html';
    return;
  }

  // Clear after reading (privacy)
  localStorage.removeItem('graduation_result');

  renderResult(container, data);
}

function renderResult(container, data) {
  const { nama, status, pesan, nisn_hash, foto } = data;

  if (status === 'NOT_FOUND' || !nama) {
    container.innerHTML = buildNotFoundHTML();
    return;
  }

  const isLulus = status === 'LULUS';

  container.innerHTML = isLulus
    ? buildLulusHTML(nama, pesan, nisn_hash, foto)
    : buildTidakHTML(nama, pesan, nisn_hash, foto);

  // After rendering, try to load student photo
  loadStudentPhoto(nisn_hash, foto);

  if (isLulus) launchConfetti();
}

/* ── Student Photo Loader ────────────────────────────────── */
function loadStudentPhoto(nisnHash, explicitFoto) {
  const imgEl = document.getElementById('student-photo-img');
  const wrapEl = document.getElementById('student-photo-wrap');

  if (!imgEl || !wrapEl) return;

  // If an explicit filename is given in JSON data, use it directly
  if (explicitFoto) {
    imgEl.src = `${CONFIG.PHOTO_PATH}${explicitFoto}`;
    imgEl.onerror = () => showPhotoPlaceholder(wrapEl);
    return;
  }

  // Otherwise, try hash-based filenames
  if (!nisnHash) {
    showPhotoPlaceholder(wrapEl);
    return;
  }

  let extIndex = 0;

  function tryNextExtension() {
    if (extIndex >= CONFIG.PHOTO_EXTENSIONS.length) {
      showPhotoPlaceholder(wrapEl);
      return;
    }
    const ext = CONFIG.PHOTO_EXTENSIONS[extIndex++];
    const src = `${CONFIG.PHOTO_PATH}${nisnHash}${ext}`;
    const probe = new Image();
    probe.onload = () => { imgEl.src = src; };
    probe.onerror = tryNextExtension;
    probe.src = src;
  }

  tryNextExtension();
}

function showPhotoPlaceholder(wrapEl) {
  wrapEl.innerHTML = '<div class="student-photo-placeholder">👤</div>';
}

/* ── HTML Builders ─────────────────────────────────────── */
function buildLulusHTML(nama, pesan, nisnHash, foto) {
  return `
    <div class="school-header">
      <div class="school-logo-wrap">
        <img class="school-logo-img" src="./assets/logo.png" alt="Logo Sekolah"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="school-logo-fallback" style="display:none;">🎓</div>
      </div>
      <div class="school-name">Pengumuman Kelulusan</div>
    </div>

    <div style="text-align:center; margin-bottom:16px;">
      <!-- Student Photo 4:3 -->
      <div class="student-photo-wrap" id="student-photo-wrap">
        <img class="student-photo-img" id="student-photo-img" src="" alt="Foto ${escapeHtml(nama)}" />
      </div>

      <div class="stamp-wrap">
        <div class="stamp lulus">LULUS</div>
      </div>

      <p class="result-name">${escapeHtml(nama)}</p>
      <p class="result-status-text lulus">Dinyatakan LULUS ✓</p>
    </div>

    <div class="result-card-inner lulus">
      <div class="result-label">Pesan untuk Kamu</div>
      <p class="result-message lulus">${escapeHtml(pesan || 'Selamat! Kamu telah berhasil menyelesaikan studi.')}</p>
    </div>

    <div style="text-align:center;">
      <a href="./index.html" class="btn-back">← Cek NISN Lain</a>
    </div>

    <div class="card-footer">
      Simpan tangkapan layar ini sebagai bukti kelulusan.<br>
      Dokumen resmi akan diterbitkan oleh sekolah.
    </div>
  `;
}

function buildTidakHTML(nama, pesan, nisnHash, foto) {
  return `
    <div class="school-header">
      <div class="school-logo-wrap">
        <img class="school-logo-img" src="./assets/logo.png" alt="Logo Sekolah"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="school-logo-fallback" style="display:none;">🏫</div>
      </div>
      <div class="school-name">Pengumuman Kelulusan</div>
    </div>

    <div style="text-align:center; margin-bottom:16px;">
      <!-- Student Photo 4:3 -->
      <div class="student-photo-wrap" id="student-photo-wrap">
        <img class="student-photo-img" id="student-photo-img" src="" alt="Foto ${escapeHtml(nama)}" />
      </div>

      <div class="stamp-wrap">
        <div class="stamp tidak">TIDAK</div>
      </div>

      <p class="result-name">${escapeHtml(nama)}</p>
      <p class="result-status-text tidak">Belum Dinyatakan Lulus</p>
    </div>

    <div class="result-card-inner tidak">
      <div class="result-label">Informasi</div>
      <p class="result-message tidak">${escapeHtml(pesan || 'Kamu belum dinyatakan lulus. Hubungi pihak sekolah untuk informasi lebih lanjut.')}</p>
    </div>

    <div style="text-align:center;">
      <a href="./index.html" class="btn-back">← Kembali</a>
    </div>

    <div class="card-footer">
      Hubungi wali kelas atau bagian kesiswaan untuk informasi lebih lanjut.
    </div>
  `;
}

function buildNotFoundHTML() {
  return `
    <div class="school-header">
      <div class="school-logo-wrap">
        <img class="school-logo-img" src="./assets/logo.png" alt="Logo Sekolah"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="school-logo-fallback" style="display:none;">🔍</div>
      </div>
      <div class="school-name">Pengumuman Kelulusan</div>
    </div>

    <div style="text-align:center; margin-bottom:16px;">
      <span class="result-icon">❓</span>
      <div class="result-badge notfound">Data Tidak Ditemukan</div>
      <p style="color:var(--text-muted); font-size:15px; line-height:1.65; margin-top:8px;">
        NISN yang Anda masukkan tidak terdaftar.<br>
        Pastikan nomor yang dimasukkan sudah benar.
      </p>
    </div>

    <div class="result-card-inner notfound">
      <div class="result-label">Kemungkinan Penyebab</div>
      <p class="result-message">
        • NISN salah ketik atau tidak lengkap<br>
        • Data belum diinput ke sistem<br>
        • Hubungi pihak sekolah jika masalah berlanjut
      </p>
    </div>

    <div style="text-align:center;">
      <a href="./index.html" class="btn-back">← Coba Lagi</a>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   CONFETTI — Sky blue & green palette
   ══════════════════════════════════════════════════════════ */
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = [
    '#38BDF8','#0EA5E9','#7DD3FC',
    '#34D399','#6EE7B7',
    '#FFFFFF','#BAE6FD','#E0F2FE',
  ];

  const pieces = Array.from({ length: 130 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * -canvas.height * 0.5,
    w:     Math.random() * 10 + 5,
    h:     Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot:   Math.random() * Math.PI * 2,
    rotV:  (Math.random() - 0.5) * 0.12,
    vx:    (Math.random() - 0.5) * 2.5,
    vy:    Math.random() * 3 + 1.8,
    alpha: 1,
  }));

  const DURATION = 4500;
  let start = null;

  function draw(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const fadeStart = DURATION * 0.55;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let allGone = true;

    for (const p of pieces) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rotV;

      if (elapsed > fadeStart) {
        p.alpha = Math.max(0, 1 - (elapsed - fadeStart) / (DURATION - fadeStart));
      }

      if (p.y < canvas.height + 20) allGone = false;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (elapsed < DURATION && !allGone) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(draw);

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }, { once: true });
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initIndexPage();
  initResultPage();
});
