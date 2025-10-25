<script setup>
import { RouterLink } from 'vue-router'

</script>

<template>
  <div class="landing min-h-screen">
    <nav class="nav container">
      <div class="logo">JobSeekr</div>
      <div class="nav-actions">
        <RouterLink to="/login" class="link">Log in</RouterLink>
        <RouterLink to="/signup" class="btn">Sign up</RouterLink>
      </div>
    </nav>

    <main class="hero container">
      <h1 class="title">Find Your <span class="selectText">Dream</span> Job</h1>
      <p class="subtitle">
        JobSeekr connects you with top companies. Create a profile, upload your CV and swipe on
        opportunities that match your skills.
      </p>

      <div class="cta">
        <RouterLink to="/signup" class="btn btn-cta">Get Started</RouterLink>
      </div>
    </main>
  </div>
</template>

<style scoped>
.landing {
  background-color: var(--lightBlue);
  color: #0f172a;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.container {
  width: min(1100px, 92%);
  margin: 0 auto;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 0;
}

.logo {
  font-weight: 800;
  font-size: 1.125rem;
}

.nav-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn {
  background: var(--darkBlue);
  color: #fff;
  padding: 0.6rem 1rem;
  border-radius: 0.6rem;
  text-decoration: none;
  font-weight: 700;
  transition: background-color 0.3s ease-in-out;
}

.btn:hover {
  background-color: var(--mediumBlue);
}

.link {
  color: var(--darkBlue);
  text-decoration: none;
  font-weight: 600;
}

.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 0;
}

.title {
  font-size: clamp(1.8rem, 5vw, 3rem);
  margin: 0 0 0.75rem 0;
  font-weight: 800;
}

.subtitle {
  max-width: 720px;
  margin: 0 auto 1.5rem auto;
  color: #475569;
  font-size: 1.05rem;
}

.cta {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.btn-cta {
  background-color: var(--darkBlue);
}

.link.secondary {
  color: #374151;
}

.selectText {
  color: var(--mediumBlue);
}
</style>
