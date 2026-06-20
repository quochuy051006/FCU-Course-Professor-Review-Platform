<script setup>
import { ref } from 'vue'
import api from '../api'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const verificationLink = ref('')

async function register() {
  errorMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true

  try {
    const response = await api.post('/auth/register', {
      email: email.value.trim(),
      password: password.value,
    })

    successMessage.value = response.data.message
    verificationLink.value = response.data.verification_link
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to register. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-page" aria-labelledby="register-heading">
    <div class="auth-card">
      <div v-if="verificationLink" class="verification-panel" role="status">
        <p class="eyebrow">Registration complete</p>
        <h1 id="register-heading">Verify your FCU email</h1>
        <p>{{ successMessage }}</p>
        <p>This project uses a demo verification link instead of sending email.</p>
        <a
          class="button verification-link"
          :href="verificationLink"
          rel="noopener noreferrer"
          target="_blank"
        >
          Verify email
        </a>
        <RouterLink class="auth-secondary-link" to="/login">Continue to login</RouterLink>
      </div>

      <template v-else>
        <div class="auth-card__heading">
          <p class="eyebrow">Join the community</p>
          <h1 id="register-heading">Create your account</h1>
          <p>Registration is available to students with an FCU email address.</p>
        </div>

        <form class="form-stack" :aria-busy="loading" @submit.prevent="register">
          <div class="form-field">
            <label for="register-email">FCU email</label>
            <input
              id="register-email"
              v-model="email"
              autocomplete="email"
              inputmode="email"
              name="email"
              pattern=".+@fcu\.edu\.tw"
              placeholder="student@fcu.edu.tw"
              required
              title="Use an @fcu.edu.tw email address"
              type="email"
            >
          </div>

          <div class="form-field">
            <label for="register-password">Password</label>
            <input
              id="register-password"
              v-model="password"
              autocomplete="new-password"
              minlength="6"
              name="password"
              required
              type="password"
            >
            <small>Use at least 6 characters.</small>
          </div>

          <div class="form-field">
            <label for="register-confirm-password">Confirm password</label>
            <input
              id="register-confirm-password"
              v-model="confirmPassword"
              autocomplete="new-password"
              minlength="6"
              name="confirmPassword"
              required
              type="password"
            >
          </div>

          <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

          <button class="button form-submit" :disabled="loading" type="submit">
            {{ loading ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p class="auth-card__footer">
          Already have an account?
          <RouterLink to="/login">Login</RouterLink>
        </p>
      </template>
    </div>
  </section>
</template>
