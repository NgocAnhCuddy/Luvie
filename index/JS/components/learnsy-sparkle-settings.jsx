import React from 'react';

/* ══════════════════════════════════════════════════════════════════
   LEARNSY-SPARKLE-SETTINGS.JSX  ·  Hạt lấp lánh "Plavsky" 🌙✨
   Particle engine (PixiJS v8) nâng cấp chất lượng hạt: texture glow
   mềm mại, hiệu ứng lấp lánh (twinkle), sprite pooling giảm rác,
   chuyển động mượt hơn. ~7.5kB

   YÊU CẦU: PixiJS v8 phải là global TRƯỚC khi bật toggle.
   Trong main.jsx (Vite entry):
     import * as PIXI from 'pixi.js'
     window.PIXI = PIXI

   CÁCH THÊM VÀO main.js:
     import './components/learnsy-sparkle-settings.jsx'

   API công khai (window):
     window._startPlavsky()        — bật hiệu ứng ngay
     window._stopPlavsky()         — tắt hiệu ứng (fade rồi dọn hạt)
     window._setPlayskyLevel(lv)   — 'low' | 'med' | 'high' | 'ultra'
     window._getPlayskyLevel()     — mức hiện tại
     window.bbApplySparkle(dark)   — dashboard.jsx gọi mỗi khi state dark đổi
     window.SparkleSettingsCard    — <Card/> nhét vào TabSettings
══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const {useState}=React;

// ═══════════════════════════════════════════════════════════════
//  PLAVSKY PARTICLE ENGINE — PixiJS v8 (nâng cấp chất lượng)
// ═══════════════════════════════════════════════════════════════
function _hasPixi() { return typeof PIXI !== 'undefined' && typeof window.PIXI !== 'undefined'; }
// ★ Perf: PIXI không còn được eager-import trong main.jsx — nó được
// import động ngay trong startPlavsky() phía dưới, chỉ khi người dùng
// thật sự bật sparkle. Bỏ cảnh báo "PIXI chưa có sau 2s" vì giờ đây
// việc PIXI vắng mặt lúc khởi động trang là bình thường, không phải lỗi.

const LEVEL_CFG = {
  low:   { max:500,  spawnEvery:2, burstEvery:14, prepop:220,  hues:[175,182,188,195,202] },
  med:   { max:900,  spawnEvery:1, burstEvery:8,  prepop:400,  hues:[170,176,182,188,194,200,208] },
  high:  { max:1600, spawnEvery:1, burstEvery:4,  prepop:650,  hues:[168,174,178,182,186,190,196,202,208,214] },
  ultra: { max:3000, spawnEvery:1, burstEvery:2,  prepop:1200, hues:[165,170,174,178,182,186,190,194,198,202,206,210,215,220] },
};
const LAYER = {
  bg:     { sizeMin:2,  sizeMax:5,  speedMin:0.10, speedMax:0.55, alphaMax:0.32, wobble:10 },
  mid:    { sizeMin:4,  sizeMax:9,  speedMin:0.30, speedMax:1.20, alphaMax:0.65, wobble:18 },
  accent: { sizeMin:6,  sizeMax:13, speedMin:0.55, speedMax:2.20, alphaMax:0.95, wobble:26 },
};

let _app, _container, _glowTex;
let _particles = [];
let _spritePool = [];              // Pool sprite để tái sử dụng
let _running = false, _initing = false, _pendingStop = false, _frame = 0;
let _stopTimer = null;
let _level = localStorage.getItem('bb-sparkleLevel') || 'high';

// ── Parallax scroll ──────────────────────────────────────────
let _scrollY = 0, _lastScrollY = 0, _scrollDelta = 0;
window.addEventListener('scroll', function() {
  _scrollDelta = window.scrollY - _lastScrollY;
  _lastScrollY = window.scrollY;
  _scrollY     = window.scrollY;
}, { passive: true });

// ── Chaos mode ───────────────────────────────────────────────
let _chaosActive  = false;
let _chaosDur     = 0;
let _nextChaos    = _randChaosInterval();
let _chaosWindX   = 0;
let _chaosWindY   = 0;
let _chaosGravity = 0;
function _randChaosInterval() { return 1600 + Math.floor(Math.random() * 2200); }
function _randChaosDur()      { return 180  + Math.floor(Math.random() * 240);  }
function _enterChaos() {
  _chaosActive  = true;
  _chaosDur     = _randChaosDur();
  const type = Math.floor(Math.random() * 4);
  if (type === 0) {
    _chaosWindX = (Math.random() < 0.5 ? 1 : -1) * (2.5 + Math.random() * 4);
    _chaosWindY = 0; _chaosGravity = 0;
  } else if (type === 1) {
    _chaosWindX = (Math.random() - 0.5) * 2;
    _chaosWindY = 0; _chaosGravity = 1.8 + Math.random() * 2.5;
  } else if (type === 2) {
    _chaosWindX = (Math.random() - 0.5) * 6;
    _chaosWindY = (Math.random() - 0.5) * 3;
    _chaosGravity = (Math.random() - 0.5) * 2;
  } else {
    _chaosWindX = (Math.random() - 0.5) * 8;
    _chaosWindY = (Math.random() - 0.5) * 5;
    _chaosGravity = (Math.random() - 0.5) * 3;
  }
}
function _exitChaos() {
  _chaosActive = false; _chaosWindX = 0; _chaosWindY = 0; _chaosGravity = 0;
  _nextChaos = _randChaosInterval();
}

function cfg() { return LEVEL_CFG[_level] || LEVEL_CFG.high; }

// HSL -> integer RGB
function hslToNum(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return ((f(0) & 0xff) << 16) | ((f(8) & 0xff) << 8) | (f(4) & 0xff);
}

function getW() { return _app ? _app.renderer.width  : window.innerWidth;  }
function getH() { return _app ? _app.renderer.height : window.innerHeight; }

// Tạo texture glow mềm mại bằng canvas radial gradient
function createGlowTexture(app) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0,   'rgba(255,255,255,1)');
  gradient.addColorStop(0.12,'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.3, 'rgba(255,255,220,0.6)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

// Lấy sprite từ pool hoặc tạo mới
function getSprite() {
  if (_spritePool.length > 0) {
    const sp = _spritePool.pop();
    sp.visible = true;
    sp.alpha = 0;
    return sp;
  }
  const sp = new PIXI.Sprite(_glowTex);
  sp.anchor.set(0.5);
  sp.blendMode = 'add';
  return sp;
}

// Trả sprite về pool (ẩn đi, removeChild)
function recycleSprite(sp) {
  if (!sp) return;
  sp.visible = false;
  _container.removeChild(sp);
  _spritePool.push(sp);
}

// ── Tạo particle với thuộc tính twinkle ────────────────────────
function _mkParticle() {
  const W = getW(), H = getH(), c = cfg();
  const r = Math.random();
  const layerKey = r < 0.68 ? 'bg' : r < 0.88 ? 'mid' : 'accent';
  const lyr = LAYER[layerKey];
  const x    = Math.random() * W;
  const size = lyr.sizeMin + Math.random() * (lyr.sizeMax - lyr.sizeMin);
  const hue  = c.hues[Math.floor(Math.random() * c.hues.length)] + (Math.random() - 0.5) * 10;

  const vx = (Math.random() - 0.5) * (lyr.speedMin + Math.random() * lyr.speedMax) * 1.8;
  const baseSpeed = lyr.speedMin + Math.random() * (lyr.speedMax - lyr.speedMin);
  const vy = -(baseSpeed * (0.5 + Math.random() * 0.8));

  return {
    x, y: H + size + Math.random() * H * 0.3,
    vx, vy,
    hue,
    wobble:    Math.random() * Math.PI * 2,
    wobbleSpd: 0.018 + Math.random() * 0.040,
    wobbleAmp: lyr.wobble * (0.5 + Math.random()),
    ax: (Math.random() - 0.5) * 0.04,
    ay: (Math.random() - 0.5) * 0.02,
    axDecay: 0.985 + Math.random() * 0.012,
    size, layerKey,
    alpha: 0, fadeIn: 0.005 + Math.random() * 0.008,
    alphaMax: lyr.alphaMax,
    breathPhase: Math.random() * Math.PI * 2,
    breathSpeed: 0.010 + Math.random() * 0.030,
    breathAmp:   layerKey === 'bg' ? 0.05 : layerKey === 'mid' ? 0.14 : 0.26,
    // Twinkle
    twinkleTimer: Math.random() * 200,   // frames đến lần lấp lánh tiếp theo
    twinkleActive: false,
    twinkleProgress: 0,
    dead: false, sprite: null,
  };
}

// ── Tạo burst particle (twinkle giống thường) ──────────────────
function _mkBurst() {
  const p = _mkParticle();
  const W = getW(), H = getH();
  p.x  = Math.random() * W;
  p.y  = H * (0.3 + Math.random() * 0.7);
  const ang = Math.random() * Math.PI * 2;
  const spd = 1.8 + Math.random() * 4.5;
  p.vx = Math.cos(ang) * spd;
  p.vy = Math.sin(ang) * spd - 2;
  return p;
}

// ── Cập nhật từng frame ──────────────────────────────────────
function _tick() {
  if (!_running || !_app) return;
  _frame++;
  const W = getW(), H = getH(), c = cfg();
  const frameDelta = _scrollDelta;
  _scrollDelta = 0;

  if (_chaosActive) {
    _chaosDur--;
    if (_chaosDur <= 0) _exitChaos();
  } else {
    _nextChaos--;
    if (_nextChaos <= 0) _enterChaos();
  }

  const spawnRate = _chaosActive ? 1 : c.spawnEvery;
  const burstRate = _chaosActive ? Math.max(1, Math.floor(c.burstEvery * 0.35)) : c.burstEvery;
  if (_frame % spawnRate === 0 && _particles.length < c.max) _particles.push(_mkParticle());
  if (_frame % burstRate === 0 && _particles.length < c.max) _particles.push(_mkBurst());

  let i = _particles.length;
  while (i--) {
    const p = _particles[i];

    p.ax *= p.axDecay;
    p.vx += p.ax;
    p.vy += p.ay;

    if (_chaosActive) {
      const t = 1 - _chaosDur / _randChaosDur();
      const blend = Math.min(1, t * 3);
      p.vx += _chaosWindX * 0.06 * blend;
      p.vy += (_chaosWindY + _chaosGravity) * 0.06 * blend;
      if (Math.random() < 0.003) {
        p.vx += (Math.random() - 0.5) * 3.5;
        p.vy += (Math.random() - 0.5) * 3.5;
      }
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 9) { p.vx = p.vx / spd * 9; p.vy = p.vy / spd * 9; }
    }

    p.wobble += p.wobbleSpd;
    p.x += p.vx + Math.sin(p.wobble) * p.wobbleAmp * 0.08;
    const parallaxFactor = p.layerKey === 'bg' ? 0.008 : p.layerKey === 'mid' ? 0.018 : 0.032;
    p.y += p.vy + frameDelta * parallaxFactor;

    // ── Breathing + Twinkle ──────────────────────────────────
    p.breathPhase += p.breathSpeed;
    const breathOffset = Math.sin(p.breathPhase) * p.breathAmp;
    const prog = 1 - p.y / H;
    let baseAlpha;
    if      (prog < 0.10) baseAlpha = Math.min(p.alpha + p.fadeIn, prog / 0.10 * p.alphaMax);
    else if (prog > 0.85) baseAlpha = Math.max(0, p.alpha - p.fadeIn * 0.8);
    else                  baseAlpha = Math.min(p.alpha + p.fadeIn, p.alphaMax);
    p.alpha = baseAlpha;

    // Xử lý twinkle
    if (!p.twinkleActive) {
      p.twinkleTimer--;
      if (p.twinkleTimer <= 0) {
        p.twinkleActive = true;
        p.twinkleProgress = 0;
        p.twinkleTimer = 120 + Math.random() * 250; // lần sau
      }
    } else {
      p.twinkleProgress += 0.08; // tốc độ twinkle
      if (p.twinkleProgress >= 1) {
        p.twinkleActive = false;
        p.twinkleProgress = 0;
      }
      // alpha tăng đột biến rồi giảm nhanh theo hàm sin
      const twinkleBoost = Math.sin(p.twinkleProgress * Math.PI) * 0.7;
      p.alpha = Math.min(p.alpha + twinkleBoost, p.alphaMax * 1.5);
    }

    // Cập nhật sprite
    if (!p.sprite) {
      p.sprite = getSprite();
      _container.addChild(p.sprite);
    }
    p.sprite.scale.set(p.size / 32);
    p.sprite.position.set(p.x, p.y);
    p.sprite.alpha = p.alpha;
    // Tint: sử dụng HSL → số nguyên, tăng nhẹ độ sáng khi twinkle
    const lum = (p.twinkleActive && p.twinkleProgress < 0.5) ? 95 : (_chaosActive ? 90 : 80);
    p.sprite.tint = hslToNum(p.hue, 100, lum);

    // Xóa nếu ra ngoài
    if (p.y < -50 || p.y > H + 80 || p.x < -120 || p.x > W + 120) {
      recycleSprite(p.sprite);
      p.sprite = null;
      _particles.splice(i, 1);
    }
  }
}

// ── Prepopulate particles ────────────────────────────────────
function _prepop() {
  const H = getH(), c = cfg();
  for (let i = 0; i < c.prepop; i++) {
    const p = _mkParticle();
    p.y     = H * (0.05 + Math.random() * 0.93);
    p.alpha = Math.random() * p.alphaMax;
    _particles.push(p);
  }
}

// ── Khởi động engine ─────────────────────────────────────────
async function startPlavsky() {
  if (_running || _initing) return;
  _initing = true;

  try {
    // ★ Perf: PixiJS (~500KB+) chỉ thật sự cần khi người dùng bật sparkle.
    // Tải động ở đây thay vì eager-import trong main.jsx — giảm tải/parse
    // JS ban đầu cho tất cả người dùng (kể cả người không bao giờ bật hiệu
    // ứng này), đặc biệt quan trọng trên máy yếu/mạng chậm.
    if (!_hasPixi()) {
      const mod = await import('pixi.js');
      window.PIXI = mod;
    }
    if (!_hasPixi()) { _initing = false; return; }

    if (!_app) {
      _app = new PIXI.Application();
      await _app.init({
        width:           window.innerWidth,
        height:          window.innerHeight,
        backgroundAlpha: 0,
        antialias:       false,
        autoDensity:     true,
        resolution:      1,
      });
      _app.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;'
        + 'width:100%;height:100%;opacity:0;transition:opacity 1.2s ease;';
      document.body.appendChild(_app.canvas);

      _glowTex = createGlowTexture(_app);
      _container = new PIXI.Container();
      _app.stage.addChild(_container);

      window.addEventListener('resize', () => {
        if (_app) _app.renderer.resize(window.innerWidth, window.innerHeight);
      });
      _app.ticker.add(_tick);
    }

    _running = true; _initing = false; _frame = 0;
    _chaosActive = false; _nextChaos = _randChaosInterval();
    if (_pendingStop) { _pendingStop = false; stopPlavsky(); return; }
    if (_stopTimer) { clearTimeout(_stopTimer); _stopTimer = null; }
    _prepop();
    _app.canvas.style.opacity = '1';
    if (!_app.ticker.started) _app.ticker.start();
  } catch (err) {
    _initing = false;
    console.error('[Plavsky] ❌ Lỗi khởi tạo PixiJS:', err);
  }
}

// ── Dừng engine ──────────────────────────────────────────────
function stopPlavsky() {
  if (!_hasPixi()) return;
  if (_initing) { _pendingStop = true; return; }
  _running = false;
  _exitChaos();
  if (_app) _app.canvas.style.opacity = '0';
  _stopTimer = setTimeout(() => {
    _stopTimer = null;
    // Thu hồi toàn bộ sprite về pool
    for (let p of _particles) {
      if (p.sprite) recycleSprite(p.sprite);
      p.sprite = null;
    }
    _particles = [];
  }, 1200);
}

// ── Đổi mức ─────────────────────────────────────────────────
function setLevel(lv) {
  _level = lv;
  localStorage.setItem('bb-sparkleLevel', lv);
  if (_running && _container) {
    for (let p of _particles) {
      if (p.sprite) recycleSprite(p.sprite);
      p.sprite = null;
    }
    _particles = [];
    _container.removeChildren();
    _frame = 0;
    _prepop();
  }
}

window._startPlavsky    = () => { startPlavsky(); };
window._stopPlavsky     = stopPlavsky;
window._setPlayskyLevel = setLevel;
window._getPlayskyLevel = () => _level;
window._playskyApp      = () => (_running ? _app : null);

// ═══════════════════════════════════════════════════════════════
//  Cầu nối dark-mode ↔ engine
// ═══════════════════════════════════════════════════════════════
let _sparkleOn = localStorage.getItem('bb-sparkleOn') === '1'; // mặc định TẮT (kể cả darkmode)

function applySparkle(isDark) {
  if (isDark && _sparkleOn) window._startPlavsky();
  else window._stopPlavsky();
}
window.bbApplySparkle = applySparkle;

function setSparkleOn(val, isDark) {
  _sparkleOn = val;
  localStorage.setItem('bb-sparkleOn', val ? '1' : '0');
  applySparkle(isDark);
}
window.bbSetSparkleOn = setSparkleOn;
window.bbGetSparkleOn = () => _sparkleOn;

// ═══════════════════════════════════════════════════════════════
//  SparkleSettingsCard — card React (giữ nguyên, không đổi giao diện)
// ═══════════════════════════════════════════════════════════════
const LEVELS = [
  { key:'low',   label:'Thấp'     },
  { key:'med',   label:'Vừa'      },
  { key:'high',  label:'Cao'      },
  { key:'ultra', label:'Siêu cao' },
];

function SparkleSettingsCard({ dark }) {
  const C    = dark ? window._bbCD : window._bbCL;
  const Icon = window.bbIcon;
  const [on,setOn]     = useState(_sparkleOn);
  const [level,setLvl] = useState(window._getPlayskyLevel());

  if (!dark || !C) return null;

  function toggle(){
    const next=!on;
    setOn(next);
    setSparkleOn(next, true);
  }
  function pickLevel(lv){
    setLvl(lv);
    window._setPlayskyLevel(lv);
  }

  return (
    <div style={{
      background:C.card, borderRadius:24, padding:'16px 18px',
      border:`1.5px solid ${on?'rgba(168,85,247,0.4)':'rgba(244,114,182,0.15)'}`,
      boxShadow:on?'0 4px 20px rgba(168,85,247,0.15)':'none',
      animation:'bb-fadeUp .38s ease both',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span style={{display:'inline-flex',flexShrink:0,color:on?C.accent2:C.sub,
          animation:'bb-float 4s ease-in-out infinite',transition:'color .2s'}}>
          {Icon
            ? <Icon name="sparkle" size={20} color={on?C.accent2:C.sub}/>
            : <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0L14.59 9.41 24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59z"/></svg>}
        </span>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.fg,fontFamily:"'Baloo 2',cursive"}}>Hạt lấp lánh</div>
          <div style={{fontSize:11,color:C.sub}}>Hiệu ứng hạt sáng đêm (chất lượng cao)</div>
        </div>
        <div className="bb-toggle-track" onClick={toggle}
          style={{background:on?'linear-gradient(135deg,#f472b6,#a855f7)':'rgba(128,128,128,0.2)',
            boxShadow:on?'0 2px 12px rgba(244,114,182,0.5)':'none'}}>
          <div className="bb-toggle-thumb" style={{left:on?26:4}}>
            {on?(<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>):''}
          </div>
        </div>
      </div>

      {on && (
        <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)'}`}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:'.03em',color:C.sub,marginBottom:8}}>MỨC ĐỘ</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {LEVELS.map(l=>{
              const active  = level===l.key;
              const isUltra = l.key==='ultra';
              return (
                <button key={l.key} className="bb-btn-tap" onClick={()=>pickLevel(l.key)}
                  style={{
                    padding:'6px 13px',borderRadius:999,cursor:'pointer',fontSize:12,fontWeight:800,
                    fontFamily:'Nunito,sans-serif',display:'inline-flex',alignItems:'center',gap:4,
                    border:`1.5px solid ${active?'rgba(168,85,247,0.6)':(isUltra?'rgba(255,100,200,0.3)':'rgba(244,114,182,0.2)')}`,
                    background:active
                      ?(isUltra?'linear-gradient(135deg,rgba(255,80,200,0.42),rgba(100,60,255,0.42))':'linear-gradient(135deg,rgba(168,85,247,0.28),rgba(244,114,182,0.22))')
                      :(isUltra?'linear-gradient(135deg,rgba(255,80,180,0.1),rgba(100,60,255,0.1))':'transparent'),
                    color:active?'#fff':C.sub,
                    boxShadow:active&&isUltra?'0 2px 14px rgba(220,60,255,0.38)':'none',
                    transition:'all .15s',
                  }}>
                  {isUltra&&<svg width="11" height="11" viewBox="0 0 24 24" fill={active?'#fff':'#fbbf24'}><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>}
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

window.SparkleSettingsCard = SparkleSettingsCard;
})();

/* ══ END OF LEARNSY-SPARKLE-SETTINGS.JSX (NÂNG CẤP CHẤT LƯỢNG) ══ */
