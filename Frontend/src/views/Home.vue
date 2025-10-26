<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="landing">
    <!-- Decorative background layers -->
    <div class="bg-gradient" aria-hidden="true"></div>
    <div class="bg-grid" aria-hidden="true"></div>
    <div class="bg-blob one" aria-hidden="true"></div>
    <div class="bg-blob two" aria-hidden="true"></div>

    <nav class="nav container">
      <div class="logo">
        JobSeekr
      </div>
      <div class="nav-actions">
        <RouterLink to="/login" class="link">Log in</RouterLink>
        <RouterLink to="/signup" class="btn">Sign up</RouterLink>
      </div>
    </nav>

    <main class="hero container">
      <div class="badge">Simple · Fast · Free</div>

      <h1 class="title">
        Find Your <span class="selectText">Dream</span> Job
      </h1>

      <p class="subtitle glass">
        JobSeekr connects you with top companies. Create a profile, upload your CV and swipe on
        opportunities that match your skills.
      </p>

      <div class="cta">
        <RouterLink to="/signup" class="btn btn-cta">Get Started</RouterLink>
        <RouterLink to="/login" class="link secondary underline-anim">I already have an account</RouterLink>
      </div>
    </main>

    <footer class="footer container">
      <span class="footnote">© {{ new Date().getFullYear() }} JobSeekr</span>
      <span class="sep">•</span>
      <span class="footnote">Built for smarter job matching</span>
    </footer>
  </div>
</template>

<style scoped>
/* — Layout — */
.landing {
  position: relative;
  height: 100svh;           /* exact viewport height incl. mobile UI */
  min-height: 100svh;
  overflow: hidden;         /* keep page non-scrollable */
  color: #0f172a;
  display: grid;
  grid-template-rows: auto 1fr auto; /* nav / hero / footer */
  background: var(--lightBlue);
  isolation: isolate;       /* ensure bg layers stay behind content */
}

.container {
  width: min(1100px, 92%);
  margin: 0 auto;
}

/* — Nav — */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 0;
  backdrop-filter: saturate(1.1);
}

.logo {
  position: relative;
  font-weight: 900;
  letter-spacing: 0.2px;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #fff, var(--mediumBlue));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--mediumBlue) 22%, transparent);
  display: inline-block;
}

.nav-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

/* — Buttons & Links — */
.btn {
  background: var(--darkBlue);
  color: #fff;
  padding: 0.62rem 1.05rem;
  border-radius: 0.7rem;
  text-decoration: none;
  font-weight: 750;
  transition: transform 160ms ease, box-shadow 160ms ease, background-color 200ms ease;
  box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--darkBlue) 45%, transparent);
  will-change: transform;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -10px color-mix(in oklab, var(--darkBlue) 55%, transparent);
  background-color: var(--mediumBlue);
}

.btn:active { transform: translateY(0); }

.btn:focus-visible,
.link:focus-visible {
  outline: 3px solid color-mix(in oklab, var(--mediumBlue) 45%, #fff);
  outline-offset: 3px;
  border-radius: 0.7rem;
}

.link {
  color: var(--darkBlue);
  text-decoration: none;
  font-weight: 650;
  opacity: 0.95;
}

.link.secondary { color: #374151; }

/* underline micro-animation */
.underline-anim {
  position: relative;
}
.underline-anim::after {
  content: "";
  position: absolute;
  left: 0; bottom: -2px;
  height: 2px;
  width: 0%;
  background: currentColor;
  transition: width 180ms ease;
}
.underline-anim:hover::after { width: 100%; }

/* — Hero — */
.hero {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 1rem;
  padding-block: 1.2rem;   /* smaller to avoid scroll */
}

.badge {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -12px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.75);
  user-select: none;
}

.title {
  font-size: clamp(1.9rem, 5vw, 3.1rem);
  margin: 0;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.selectText { color: var(--mediumBlue); }

/* subtle animated text highlight */
.highlight {
  position: relative;
  padding: 0 0.15em;
  background: linear-gradient(120deg, color-mix(in oklab, var(--mediumBlue) 30%, transparent), transparent 55%) no-repeat;
  background-size: 0% 55%;
  transition: background-size 300ms ease;
}
.title:hover .highlight { background-size: 100% 55%; }

.subtitle {
  max-width: 720px;
  margin: 0 auto;
  color: #475569;
  font-size: 1.05rem;
}

/* glass card vibe for subtitle */
.glass {
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: linear-gradient(to bottom right, rgba(255,255,255,0.68), rgba(255,255,255,0.45));
  border: 1px solid rgba(255,255,255,0.8);
  box-shadow: 0 12px 30px -20px rgba(15, 23, 42, 0.35);
}

.cta {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.btn-cta { background-color: var(--darkBlue); }

/* — Footer — */
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.75rem 0 1rem;
  color: #556070;
  font-size: 0.85rem;
  user-select: none;
}
.sep { opacity: 0.5; }
.footnote { opacity: 0.9; }

/* — Background treatments — */
.bg-gradient,
.bg-grid,
.bg-blob {
  position: absolute;
  inset: 0;
  z-index: -3;
}

.bg-gradient {
  background:
    radial-gradient(1200px 600px at 80% -10%, color-mix(in oklab, var(--mediumBlue) 25%, transparent), transparent 60%),
    radial-gradient(900px 500px at -10% 100%, color-mix(in oklab, var(--darkBlue) 18%, transparent), transparent 60%),
    var(--lightBlue);
  animation: floatBg 16s ease-in-out infinite alternate;
}

@keyframes floatBg {
  0%   { transform: translateY(0px); }
  100% { transform: translateY(6px); }
}

/* subtle grid pattern */
.bg-grid {
  --line: color-mix(in oklab, #0f172a 8%, transparent);
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(60% 60% at 50% 50%, black 60%, transparent 100%);
  opacity: 0.35;
  z-index: -2;
}

/* soft blobs */
.bg-blob {
  filter: blur(30px);
  opacity: 0.35;
  z-index: -1;
}
.bg-blob.one {
  background: radial-gradient(200px 140px at 15% 25%, color-mix(in oklab, var(--mediumBlue) 45%, transparent), transparent 70%);
}
.bg-blob.two {
  background: radial-gradient(260px 180px at 85% 75%, color-mix(in oklab, var(--darkBlue) 35%, transparent), transparent 70%);
}

/* — Reduced motion — */
@media (prefers-reduced-motion: reduce) {
  .btn,
  .title .highlight,
  .bg-gradient { transition: none; animation: none; }
}

/* — Tiny screens: keep it non-scrollable by tightening spacing — */
@media (max-width: 360px) {
  .subtitle.glass { padding: 0.7rem 0.8rem; }
  .cta { gap: 0.7rem; }
  .footer { padding: 0.5rem 0 0.75rem; }
}
</style>
