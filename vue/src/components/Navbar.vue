<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AUTH_CHANGED_EVENT,
  clearSession,
  getStoredUser,
  getToken,
} from '../api'

const router = useRouter()
const token = ref(null)
const user = ref(null)

const isLoggedIn = computed(() => Boolean(token.value))
const isAdmin = computed(() => user.value?.role === 'admin')

function refreshAuth() {
  token.value = getToken()
  user.value = getStoredUser()
}

function logout() {
  clearSession()
  router.push({ name: 'home' })
}

onMounted(() => {
  refreshAuth()
  window.addEventListener('storage', refreshAuth)
  window.addEventListener(AUTH_CHANGED_EVENT, refreshAuth)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', refreshAuth)
  window.removeEventListener(AUTH_CHANGED_EVENT, refreshAuth)
})
</script>

<template>
  <header class="navbar">
    <nav class="navbar__inner" aria-label="Main navigation">
      <RouterLink class="navbar__brand" to="/">FCU Reviews</RouterLink>

      <div class="navbar__links">
        <RouterLink to="/search">Search</RouterLink>

        <template v-if="isLoggedIn">
          <RouterLink to="/me/reviews">My Reviews</RouterLink>
          <RouterLink v-if="isAdmin" to="/admin/reports">Admin Reports</RouterLink>
          <button class="button button--text" type="button" @click="logout">Logout</button>
        </template>

        <template v-else>
          <RouterLink to="/login">Login</RouterLink>
          <RouterLink class="button" to="/register">Register</RouterLink>
        </template>
      </div>
    </nav>
  </header>
</template>
