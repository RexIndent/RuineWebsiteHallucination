(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fine = matchMedia('(pointer:fine)').matches;
  if (fine) document.documentElement.classList.add('fine');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------- audio (all synthesized with Web Audio) ---------- */
  const A = {
    ctx: null,
    master: null,
    nb: null,
    muted: false,
    vol: .6,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        const c = this.ctx = new C();
        this.master = c.createGain();
        this.master.connect(c.destination);
        const n = c.sampleRate * 2;
        const b = c.createBuffer(1, n, c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.nb = b;
        this.apply();
      } catch (e) {
        this.ctx = null;
      }
    },

    apply() {
      if (this.master) this.master.gain.value = this.muted ? 0 : this.vol;
    },

    noise() {
      const s = this.ctx.createBufferSource();
      s.buffer = this.nb;
      s.loop = true;
      return s;
    },

    thump(t, v) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(75, t);
      o.frequency.exponentialRampToValueAtTime(34, t + .15);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(v, t + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + .25);
    },

    // six double-beats spread over 5 seconds
    heart() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + .02;
      for (let k = 0; k < 6; k++) {
        this.thump(t + k * 5 / 6, 1);
        this.thump(t + k * 5 / 6 + .25, .6);
      }
    },

    creak() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(), l = c.createOscillator();
      const lg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      o.frequency.linearRampToValueAtTime(140, t + 1.2);
      o.frequency.linearRampToValueAtTime(55, t + 2);
      l.frequency.value = 19;
      lg.gain.value = 14;
      l.connect(lg);
      lg.connect(o.frequency);
      f.type = 'bandpass';
      f.frequency.value = 500;
      f.Q.value = 6;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.35, t + .3);
      g.gain.linearRampToValueAtTime(0, t + 2);
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start(t);
      l.start(t);
      o.stop(t + 2.1);
      l.stop(t + 2.1);
      this.thump(t + 1.9, .9);
    },

    // loud crackling static burst
    glitch() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, s = this.noise(), g = c.createGain();
      for (let k = 0; k < 12; k++) g.gain.setValueAtTime(Math.random() < .3 ? .1 : .9, t + k * .05);
      g.gain.setValueAtTime(0, t + .6);
      s.connect(g);
      g.connect(this.master);
      s.start(t);
      s.stop(t + .65);
    },

    // constant TV-static hiss; louder while text is distorted
    stat: {
      g: null,
      start() {
        if (!A.ctx || this.g) return;
        const c = A.ctx, s = A.noise(), hp = c.createBiquadFilter(), g = c.createGain();
        hp.type = 'highpass';
        hp.frequency.value = 300;
        g.gain.value = 0;
        s.connect(hp);
        hp.connect(g);
        g.connect(A.master);
        s.start();
        this.g = g;
      },
      set(v) {
        if (this.g) this.g.gain.setTargetAtTime(v, A.ctx.currentTime, .05);
      }
    },

    // 10-second whisper
    whisper() {
      if (!this.ctx) return;
      const c = this.ctx, t0 = c.currentTime, s = this.noise();
      const bp = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain();
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      bp.type = 'bandpass';
      bp.Q.value = 3;
      hp.type = 'highpass';
      hp.frequency.value = 900;
      g.gain.value = 0;
      s.connect(bp);
      bp.connect(hp);
      hp.connect(g);
      if (pan) {
        g.connect(pan);
        pan.connect(this.master);
      } else {
        g.connect(this.master);
      }
      for (let t = 0; t < 9.6; t += .25 + Math.random() * .35) {
        const d = .18 + Math.random() * .3;
        bp.frequency.setValueAtTime(1200 + Math.random() * 2800, t0 + t);
        if (pan) pan.pan.setValueAtTime(Math.random() * 2 - 1, t0 + t);
        g.gain.setValueAtTime(0, t0 + t);
        g.gain.linearRampToValueAtTime(.18 + Math.random() * .3, t0 + t + d * .4);
        g.gain.linearRampToValueAtTime(0, t0 + t + d);
      }
      s.start(t0);
      s.stop(t0 + 10);
    },

    // heavy breathing near the shadow figure
    breath: {
      on: false, src: null, env: null, lvl: null, f: null, iv: null,

      start() {
        if (!A.ctx || this.on) return;
        const c = A.ctx;
        this.on = true;
        const s = A.noise(), f = c.createBiquadFilter(), e = c.createGain(), l = c.createGain();
        f.type = 'bandpass';
        f.frequency.value = 700;
        f.Q.value = .8;
        e.gain.value = 0;
        l.gain.value = 1;
        s.connect(f);
        f.connect(e);
        e.connect(l);
        l.connect(A.master);
        s.start();
        Object.assign(this, { src: s, env: e, lvl: l, f });
        this.cycle();
        this.iv = setInterval(() => this.cycle(), 3000);
      },

      cycle() {
        if (!this.env) return;
        const t = A.ctx.currentTime, p = this.env.gain;
        p.cancelScheduledValues(t);
        p.setValueAtTime(.0001, t);
        p.linearRampToValueAtTime(.9, t + 1.1);
        p.linearRampToValueAtTime(.15, t + 1.4);
        p.linearRampToValueAtTime(.7, t + 2);
        p.linearRampToValueAtTime(.0001, t + 2.8);
        this.f.frequency.setValueAtTime(500, t);
        this.f.frequency.linearRampToValueAtTime(1200, t + 1.1);
        this.f.frequency.linearRampToValueAtTime(400, t + 2.6);
      },

      level(v) {
        if (this.on && this.lvl) this.lvl.gain.value = clamp(v, 0, 1);
      },

      stop() {
        if (!this.on) return;
        this.on = false;
        clearInterval(this.iv);
        const t = A.ctx.currentTime;
        this.lvl.gain.cancelScheduledValues(t);
        this.lvl.gain.linearRampToValueAtTime(0, t + .4);
        try { this.src.stop(t + .5); } catch (e) {}
      }
    }
  };

  // audio can only start after a user gesture
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => A.init(), { passive: true }));

  $('#mute').addEventListener('click', e => {
    A.init();
    A.muted = !A.muted;
    A.apply();
    e.target.textContent = A.muted
      ? 'Hallucinations suppressed (they remain)'
      : 'Suppress auditory hallucinations';
  });

  $('#vol').addEventListener('input', e => {
    A.vol = e.target.value / 100;
    A.apply();
  });

  /* ---------- noise texture + warp filters ---------- */
  const nc = document.createElement('canvas');
  nc.width = nc.height = 128;
  {
    const x = nc.getContext('2d'), im = x.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }
  document.documentElement.style.setProperty('--nz', `url(${nc.toDataURL()})`);

  const NS = 'http://www.w3.org/2000/svg';
  const defs = $('#defs');
  const warps = [];

  // every .warp element gets its own SVG displacement filter
  $$('.warp').forEach((el, n) => {
    const f = document.createElementNS(NS, 'filter');
    const t = document.createElementNS(NS, 'feTurbulence');
    const d = document.createElementNS(NS, 'feDisplacementMap');
    f.id = 'w' + n;
    f.setAttribute('x', '-10%');
    f.setAttribute('y', '-10%');
    f.setAttribute('width', '120%');
    f.setAttribute('height', '120%');
    t.setAttribute('type', 'fractalNoise');
    t.setAttribute('baseFrequency', '0.02 0.35');
    t.setAttribute('numOctaves', '2');
    t.setAttribute('seed', n);
    t.setAttribute('result', 'n');
    d.setAttribute('in', 'SourceGraphic');
    d.setAttribute('in2', 'n');
    d.setAttribute('scale', '0');
    d.setAttribute('xChannelSelector', 'R');
    d.setAttribute('yChannelSelector', 'G');
    f.append(t, d);
    defs.appendChild(f);
    const w = { el, t, d, id: f.id, i: 0, p: -1, h: false };
    warps.push(w);
    el.addEventListener('pointerenter', () => { w.h = true; });
    el.addEventListener('pointerleave', () => { w.h = false; });
  });

  /* scrambling skill stats */
  $$('.st').forEach(s => {
    let iv = 0;
    const cell = s.parentElement, v = s.dataset.v;
    cell.addEventListener('pointerenter', () => {
      clearInterval(iv);
      iv = setInterval(() => {
        s.textContent = Array.from(v, () => '0123456789#?%'[Math.random() * 13 | 0]).join('');
      }, 70);
    });
    cell.addEventListener('pointerleave', () => {
      clearInterval(iv);
      s.textContent = v;
    });
  });

  /* ---------- eye cursor ---------- */
  const ec = $('#eye'), ex = ec.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ec.width = 96 * dpr;
  ec.height = 60 * dpr;
  ex.scale(dpr, dpr);

  let mx = -300, my = -300, px = mx, py = my, ox = 0, oy = 0;
  let seen = false, nextBlink = performance.now() + rnd(3000, 7000), bs = 0, dil = 0, panic = false;
  const veins = Array.from({ length: 10 }, () => ({ a: rnd(0, 6.28), l: rnd(8, 22), s: rnd(-1, 1) }));

  const track = e => {
    mx = e.clientX;
    my = e.clientY;
    if (!seen) {
      seen = true;
      px = mx;
      py = my;
      ec.style.opacity = 1;
    }
  };
  addEventListener('pointermove', track, { passive: true });
  addEventListener('pointerdown', track, { passive: true });

  function drawEye(now) {
    const o = bs ? 1 - Math.sin(Math.PI * clamp((now - bs) / 240, 0, 1)) : 1;
    if (bs && now - bs > 240) bs = 0;
    const oo = Math.max(o, .04), g = ex;
    g.clearRect(0, 0, 96, 60);

    const path = () => {
      g.beginPath();
      g.moveTo(4, 30);
      g.quadraticCurveTo(48, 30 - 34 * oo, 92, 30);
      g.quadraticCurveTo(48, 30 + 26 * oo, 4, 30);
      g.closePath();
    };

    g.save();
    path();
    g.clip();

    // sclera
    const sc = g.createRadialGradient(48, 30, 4, 48, 30, 48);
    sc.addColorStop(0, '#D1D1D1');
    sc.addColorStop(1, '#7a5f64');
    g.fillStyle = sc;
    g.fillRect(0, 0, 96, 60);

    // veins
    g.strokeStyle = 'rgba(74,14,14,.55)';
    g.lineWidth = .7;
    veins.forEach(v => {
      g.beginPath();
      g.moveTo(48 + Math.cos(v.a) * 46, 30 + Math.sin(v.a) * 22);
      g.lineTo(48 + Math.cos(v.a) * (46 - v.l), 30 + Math.sin(v.a) * (22 - v.l * .5) + v.s * 3);
      g.stroke();
    });

    // iris + pupil (with micro-jitter)
    const ix = 48 + ox + rnd(-.5, .5), iy = 30 + oy + rnd(-.5, .5);
    const ir = g.createRadialGradient(ix, iy, 2, ix, iy, 13);
    ir.addColorStop(0, '#4A0E0E');
    ir.addColorStop(.6, '#1A1528');
    ir.addColorStop(1, '#050505');
    g.fillStyle = ir;
    g.beginPath();
    g.arc(ix, iy, 13, 0, 6.283);
    g.fill();

    g.fillStyle = '#000';
    g.beginPath();
    g.arc(ix, iy, 5 + dil, 0, 6.283);
    g.fill();

    g.fillStyle = 'rgba(209,209,209,.85)';
    g.beginPath();
    g.arc(ix - 4, iy - 4, 1.6, 0, 6.283);
    g.fill();
    g.restore();

    // lid outline
    path();
    g.strokeStyle = '#4A0E0E';
    g.lineWidth = 2;
    g.stroke();
    g.beginPath();
    g.moveTo(4, 30);
    g.quadraticCurveTo(48, 30 - 34 * oo, 92, 30);
    g.strokeStyle = '#050505';
    g.lineWidth = 3;
    g.stroke();
  }

  /* ---------- shadow entity ---------- */
  const SVG = '<svg viewBox="0 0 100 230"><g fill="#020202"><ellipse cx="50" cy="26" rx="15" ry="20"/><path d="M50 44C28 46 22 70 20 110L8 205l8 2 14-70 4 93h12l4-93 4 93h12l4-93 14 70 8-2-12-95C78 70 72 46 50 44Z"/></g><g class="ey" fill="#D1D1D1"><ellipse cx="44" cy="25" rx="2.4" ry="1.2"/><ellipse cx="56" cy="25" rx="2.4" ry="1.2"/></g></svg>';
  let sh = null, spawnT = 0, entered = false;

  function scheduleSpawn() {
    clearTimeout(spawnT);
    spawnT = setTimeout(spawn, rnd(15000, 30000));
  }

  function spawn() {
    if (sh) {
      scheduleSpawn();
      return;
    }
    const el = document.createElement('div');
    el.className = 'shade';
    el.innerHTML = SVG;
    const left = Math.random() < .5;
    el.style[left ? 'left' : 'right'] = rnd(1, 10) + 'vw';
    el.style.top = rnd(15, 40) + 'vh';
    document.body.appendChild(el);
    sh = { el, t0: performance.now(), dead: false };
    el.addEventListener('pointerdown', dispel);
  }

  async function dispel(e) {
    if (!sh || sh.dead) return;
    e.stopPropagation();
    const s = sh;
    s.dead = true;
    A.breath.stop();
    A.heart();
    panic = true;
    s.el.classList.add('shake');
    await sleep(5000);   // heartbeat plays for 5 seconds
    flash();
    A.glitch();
    s.el.remove();
    if (sh === s) sh = null;
    panic = false;
    scheduleSpawn();
  }

  function flash() {
    const f = $('#flash');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    document.body.classList.add('gl');
    setTimeout(() => document.body.classList.remove('gl'), 700);
  }

  /* ---------- corridor intro ---------- */
  const cor = $('#cor'), cg = cor.getContext('2d'), T0 = performance.now();
  let z0 = 0, introOn = true;

  const sizeCor = () => {
    cor.width = innerWidth;
    cor.height = innerHeight;
  };
  sizeCor();
  addEventListener('resize', sizeCor);

  function drawCor(now, dt) {
    const w = cor.width, h = cor.height, t = (now - T0) / 1000, g = cg;
    z0 += Math.max(.12, 1.5 - t * .2) * dt / 1000;   // slows as you arrive
    g.fillStyle = '#050505';
    g.fillRect(0, 0, w, h);

    const N = 14, fr = z0 % 1, cx = w / 2, cy = h * .48;
    for (let i = 0; i < N; i++) {
      const d = (i + fr) / N, s = d * d * 2.4 + .012, hw = w * s / 2, hh = h * s * .55;
      g.strokeStyle = `rgba(209,209,209,${(d * .22).toFixed(3)})`;
      g.lineWidth = 1 + d * 3;
      g.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    }

    g.strokeStyle = 'rgba(74,14,14,.35)';
    g.lineWidth = 1;
    g.beginPath();
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(p => {
      g.moveTo(cx, cy);
      g.lineTo(p[0], p[1]);
    });
    g.stroke();

    // flickering far-end light
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * .3);
    const fl = Math.random() < .08 ? .2 : .7 + Math.random() * .3;
    gr.addColorStop(0, `rgba(40,30,70,${.6 * fl})`);
    gr.addColorStop(1, 'rgba(26,21,40,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);

    // drifting fog
    for (let k = 0; k < 4; k++) {
      const bx = w * (.5 + .4 * Math.sin(t * .2 + k * 1.7));
      const by = h * (.55 + .15 * Math.cos(t * .27 + k));
      const r = Math.max(w, h) * .35;
      gr = g.createRadialGradient(bx, by, 0, bx, by, r);
      gr.addColorStop(0, 'rgba(70,64,90,.11)');
      gr.addColorStop(1, 'rgba(70,64,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }

    // vignette
    gr = g.createRadialGradient(cx, cy, Math.min(w, h) * .2, cx, cy, Math.max(w, h) * .75);
    gr.addColorStop(0, 'rgba(5,5,5,0)');
    gr.addColorStop(1, 'rgba(5,5,5,.95)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }

  const door = $('#door'), intro = $('#intro');
  setTimeout(() => door.classList.add('show'), 5500);

  async function enter() {
    if (entered || !door.classList.contains('show')) return;
    entered = true;
    A.init();
    A.creak();
    door.classList.add('open');
    await sleep(1100);
    door.classList.add('dive');
    await sleep(900);
    intro.classList.add('out');
    A.stat.start();
    $('#main').classList.add('on');
    document.body.classList.remove('lock');
    await sleep(1500);
    introOn = false;
    intro.style.display = 'none';
    setTimeout(() => {
      A.whisper();
      setInterval(() => A.whisper(), 20000);   // 10s whisper every 20s
    }, 3000);
    scheduleSpawn();
  }
  door.addEventListener('click', enter);

  /* ---------- blink navigation ---------- */
  let busy = false;

  async function blinkTo(id) {
    if (busy) return;
    busy = true;
    const L = $('#lids'), cl = v => L.classList.toggle('c', v);
    cl(true);  await sleep(140);
    cl(false); await sleep(160);
    cl(true);  await sleep(140);
    cl(false);
    const t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    await sleep(250);
    busy = false;
  }

  $$('nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (entered) blinkTo(a.dataset.t);
  }));

  /* ---------- image zoom + descent ---------- */
  const zoom = $('#zoom'), zimg = $('#zimg'), zbox = $('#zbox'), zred = $('#zred'), zcap = $('#zcap'), zfx = $('#zfx');
  let zo = null, zp = 0, zT = null, zD = null, zLabel = '';
  let nextBeat = 0, nextWord = 0, nextEye = 0, nextInv = 0;
  const ZSEC = 45;   // seconds until the image is fully lost
  const WORDS = ['it blinked', "that isn't yours", 'look closer', 'you have been here before', 'it can see you looking', 'stay', "don't look away", 'the eyes are wrong'];
  const EYE = '<svg viewBox="0 0 60 30"><path d="M2 15Q30-8 58 15Q30 38 2 15Z" fill="#D1D1D1"/><circle cx="30" cy="15" r="9" fill="#4A0E0E"/><circle cx="30" cy="15" r="4" fill="#050505"/></svg>';

  // displacement filter used on the zoomed image
  {
    const f = document.createElementNS(NS, 'filter');
    zT = document.createElementNS(NS, 'feTurbulence');
    zD = document.createElementNS(NS, 'feDisplacementMap');
    f.id = 'zf';
    f.setAttribute('x', '-15%'); f.setAttribute('y', '-15%'); f.setAttribute('width', '130%'); f.setAttribute('height', '130%');
    zT.setAttribute('type', 'fractalNoise'); zT.setAttribute('baseFrequency', '0.01 0.02'); zT.setAttribute('numOctaves', '2'); zT.setAttribute('result', 'n');
    zD.setAttribute('in', 'SourceGraphic'); zD.setAttribute('in2', 'n'); zD.setAttribute('scale', '0');
    zD.setAttribute('xChannelSelector', 'R'); zD.setAttribute('yChannelSelector', 'G');
    f.append(zT, zD);
    defs.appendChild(f);
  }

  function openZoom(src) {
    if (zo || !entered) return;
    A.init();
    zimg.innerHTML = '';
    ['', 'g1', 'g2'].forEach(k => {
      const l = document.createElement('div');
      const c = src.cloneNode(true);
      c.setAttribute('tabindex', '-1');
      c.setAttribute('aria-hidden', 'true');
      c.removeAttribute('role');
      l.className = 'zl ' + k;
      l.appendChild(c);
      zimg.appendChild(l);
    });
    zfx.innerHTML = '';
    zLabel = src.getAttribute('aria-label') || '';
    zcap.textContent = zLabel;
    zo = { t0: performance.now(), whispered: false };
    zp = 0;
    nextBeat = nextWord = nextEye = nextInv = 0;
    zoom.classList.add('on');
    document.body.classList.add('lock');
  }

  function closeZoom() {
    if (!zo) return;
    const deep = zp;
    zo = null;
    zp = 0;
    zoom.classList.remove('on');
    document.body.classList.remove('lock');
    zred.style.setProperty('--a', 0);
    if (deep > .6) { flash(); A.glitch(); }   // surfacing from deep in the image hurts
    setTimeout(() => { if (!zo) { zimg.innerHTML = ''; zfx.innerHTML = ''; zimg.style.filter = ''; } }, 500);
  }

  $$('.ic svg, .portrait svg').forEach(s => {
    s.tabIndex = 0;
    s.setAttribute('role', 'button');
    s.addEventListener('click', () => openZoom(s));
    s.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(s); }
    });
  });
  zoom.addEventListener('click', closeZoom);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeZoom(); });

  function spawnFx(el, life) {
    if (zfx.children.length > 40) zfx.firstChild.remove();
    zfx.appendChild(el);
    setTimeout(() => el.remove(), life);
  }

  function zoomTick(now) {
    if (!zo) return;
    const t = (now - zo.t0) / 1000;
    const p = zp = clamp(t / ZSEC, 0, reduce ? .3 : 1);   // 0 -> 1 the longer you stay
    const q = p * p;

    // red hue from the screen edges, pulsing faster over time
    const pulse = .5 + .5 * Math.sin(now / 1000 * (2 + p * 5));
    zred.style.setProperty('--a', ((.08 + .85 * p) * (.7 + .3 * pulse)).toFixed(3));

    // the image distorts more and more
    zD.setAttribute('scale', (1 + q * 70).toFixed(1));
    zT.setAttribute('baseFrequency', `${(.01 + p * .03).toFixed(3)} ${(.02 + p * .25).toFixed(3)}`);
    if (gf % 3 === 0) zT.setAttribute('seed', gf % 200);
    zimg.style.filter = `url(#zf) blur(${(q * 2.5).toFixed(2)}px) hue-rotate(${(Math.sin(now / 700) * p * 40).toFixed(0)}deg) contrast(${(1 + p * .8).toFixed(2)}) saturate(${(1 + p * 2).toFixed(2)})`;
    zimg.style.setProperty('--g', (Math.random() < .85 ? p * .55 : 0).toFixed(2));
    zimg.style.setProperty('--dx', (p * 14 + rnd(-3, 3) * p).toFixed(1) + 'px');

    // box: opens, then shakes and sways
    const op = 1 - Math.pow(1 - Math.min(t / .5, 1), 3);
    zbox.style.transform = `translate(${(rnd(-1, 1) * q * 8).toFixed(1)}px,${(rnd(-1, 1) * q * 8).toFixed(1)}px) scale(${((.6 + .4 * op) * (1 + Math.sin(now / 400) * p * .03)).toFixed(3)}) rotate(${(Math.sin(now / 1300) * p * 1.5).toFixed(2)}deg)`;

    // caption corrupts
    if (p > .3 && gf % 4 === 0) {
      zcap.textContent = Array.from(zLabel, ch => Math.random() < p * .4 ? '█▓▒░#?%'[Math.random() * 7 | 0] : ch).join('');
    }

    // hallucinated words
    if (p > .25 && now > nextWord) {
      const w = document.createElement('div');
      w.className = 'zw';
      w.textContent = WORDS[Math.random() * WORDS.length | 0];
      w.style.left = rnd(4, 70) + '%';
      w.style.top = rnd(8, 88) + '%';
      w.style.fontSize = rnd(16, 38) + 'px';
      spawnFx(w, 2300);
      nextWord = now + rnd(2500, 6000) * (1.2 - p);
    }

    // eyes opening across the screen
    if (p > .45 && now > nextEye) {
      for (let k = 0; k < (p > .85 ? 2 : 1); k++) {
        const e = document.createElement('div');
        e.className = 'zeye';
        e.innerHTML = EYE;
        e.style.width = rnd(24, 70) + 'px';
        e.style.left = rnd(2, 92) + '%';
        e.style.top = rnd(4, 92) + '%';
        spawnFx(e, 2700);
      }
      nextEye = now + rnd(700, 2000) * (1.1 - p);
    }

    // flashes of the inverted image
    if (p > .6 && now > nextInv) {
      zimg.classList.add('inv');
      setTimeout(() => zimg.classList.remove('inv'), 70 + rnd(0, 80));
      nextInv = now + rnd(1500, 4500) * (1.1 - p);
    }

    // heartbeat that speeds up and gets louder, plus one whisper
    if (A.ctx && p > .15 && now > nextBeat) {
      const c = A.ctx.currentTime;
      A.thump(c, .25 + .6 * p);
      A.thump(c + .22, .15 + .4 * p);
      nextBeat = now + 1250 - 700 * p;
    }
    if (A.ctx && p > .5 && !zo.whispered) { zo.whispered = true; A.whisper(); }
  }

  /* ---------- main loop ---------- */
  const gx = $('#grain').getContext('2d');
  let last = performance.now(), gf = 0;

  function loop(now) {
    const dt = Math.min(now - last, 50);
    last = now;
    gf++;

    if (introOn) drawCor(now, dt);

    // animated grain overlay
    if (gf % 4 === 0) {
      const im = gx.createImageData(160, 90);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
      gx.putImageData(im, 0, 0);
    }

    // eye cursor physics
    if (seen) {
      const k = 1 - Math.exp(-dt / 45);
      px += (mx - px) * k;
      py += (my - py) * k;
      const dx = mx - px, dy = my - py, d = Math.hypot(dx, dy), m = Math.min(d * .6, 11);
      ox += ((d ? dx / d * m : Math.sin(now / 900) * 2) - ox) * .25;
      oy += ((d ? dy / d * m : Math.cos(now / 1100) * 1.5) - oy) * .25;
      const near = sh && !sh.dead;
      const td = (panic ? 4 : 0) + (near ? 1.5 : 0) + Math.min(d * .05, 2);
      dil += (td - dil) * .15;
      if (now > nextBlink && !bs) {
        bs = now;
        nextBlink = now + rnd(3000, 7000);
      }
      drawEye(now);
      ec.style.transform = `translate(${(px - 48 + rnd(-1.2, 1.2)).toFixed(1)}px,${(py - 30 + rnd(-1.2, 1.2)).toFixed(1)}px)`;
    }

    // hover distortion
    for (const w of warps) {
      const ni = clamp(w.i + (w.h ? dt * .0008 : -dt * .002), 0, 1);
      if (ni > 0 && gf % 4 === 0) w.t.setAttribute('seed', gf % 97);
      if (ni !== w.p) {
        w.i = ni;
        w.p = ni;
        w.d.setAttribute('scale', (ni * ni * 90).toFixed(1));
        w.el.style.setProperty('--i', ni.toFixed(3));
        w.el.style.filter = ni > .002 ? `url(#${w.id}) blur(${(ni * ni * 3.5).toFixed(2)}px)` : '';
      }
    }

    // static hiss follows distortion; ducked during the heartbeat; swells while zoomed
    if (gf % 3 === 0) {
      let mi = 0;
      for (const w of warps) if (w.i > mi) mi = w.i;
      A.stat.set(panic ? .008 : .025 + mi * .35 + zp * .2);
    }

    // shadow figure: grow, proximity breathing, despawn
    if (sh && !sh.dead) {
      const p = clamp((now - sh.t0) / 26000, 0, 1);
      sh.el.style.opacity = (.04 + p * .8).toFixed(3);
      sh.el.style.transform = `scale(${(.55 + p * 1.1).toFixed(3)})`;
      sh.el.style.setProperty('--e', p > .55 ? (p - .55) / .45 : 0);
      const r = sh.el.getBoundingClientRect();
      const dx = Math.max(r.left - mx, 0, mx - r.right);
      const dy = Math.max(r.top - my, 0, my - r.bottom);
      const dist = Math.hypot(dx, dy);
      if (seen && dist < 150) {
        A.breath.start();
        A.breath.level(1 - dist / 150 * .6);
      } else {
        A.breath.stop();
      }
      if (now - sh.t0 > 75000) {
        A.breath.stop();
        sh.el.remove();
        sh = null;
        scheduleSpawn();
      }
    } else if (!sh) {
      A.breath.stop();
    }

    zoomTick(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();