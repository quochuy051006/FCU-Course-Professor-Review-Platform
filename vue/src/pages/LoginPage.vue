<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { saveSession } from '../api'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

function getRedirectTarget() {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }

  return { name: 'home' }
}

async function login() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.post('/auth/login', {
      email: email.value.trim(),
      password: password.value,
    })

    saveSession(response.data.token, response.data.user)
    await router.push(getRedirectTarget())
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to log in. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-page" aria-labelledby="login-heading">
    <div class="auth-card">
      <div class="auth-card__heading">
        <p class="eyebrow">Welcome back</p>
        <h1 id="login-heading">Login to FCU Reviews</h1>
        <p>Use your FCU account to write, vote on, and manage reviews.</p>
      </div>

      <form class="form-stack" :aria-busy="loading" @submit.prevent="login">
        <div class="form-field">
          <label for="login-email">FCU email</label>
          <input
            id="login-email"
            v-model="email"
            autocomplete="email"
            inputmode="email"
            name="email"
            placeholder="student@fcu.edu.tw"
            required
            type="email"
          >
        </div>

        <div class="form-field">
          <label for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            autocomplete="current-password"
            name="password"
            required
            type="password"
          >
        </div>

        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

        <button class="button form-submit" :disabled="loading" type="submit">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <p class="auth-card__footer">
        Do not have an account?
        <RouterLink to="/register">Register with your FCU email</RouterLink>
      </p>
    </div>
  </section>
</template>
