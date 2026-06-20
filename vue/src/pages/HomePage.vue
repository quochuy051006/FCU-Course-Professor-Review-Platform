<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import OfferingCard from '../components/OfferingCard.vue'
import PaginationControls from '../components/PaginationControls.vue'
import SearchBar from '../components/SearchBar.vue'

const PAGE_SIZE = 15
const route = useRoute()
const router = useRouter()
const searchQuery = ref('')
const offerings = ref([])
const currentPage = ref(1)
const totalOfferings = ref(0)
const loading = ref(true)
const errorMessage = ref('')
let activeRequest = 0

const totalPages = computed(() => Math.max(1, Math.ceil(totalOfferings.value / PAGE_SIZE)))

function normalizePage(value) {
  const page = Number.parseInt(value, 10)
  return Number.isInteger(page) && page > 0 ? page : 1
}

async function loadOfferings(page = currentPage.value) {
  const requestId = ++activeRequest
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/offerings', {
      params: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      },
    })

    if (requestId !== activeRequest) return

    offerings.value = Array.isArray(response.data?.items) ? response.data.items : []
    totalOfferings.value = Number(response.data?.total) || offerings.value.length

    const lastPage = Math.max(1, Math.ceil(totalOfferings.value / PAGE_SIZE))
    if (page > lastPage) {
      await goToPage(lastPage, true)
    }
  } catch (error) {
    if (requestId === activeRequest) {
      offerings.value = []
      errorMessage.value = error.response?.data?.message || 'Unable to load offerings.'
    }
  } finally {
    if (requestId === activeRequest) {
      loading.value = false
    }
  }
}

async function goToPage(page, replace = false) {
  const target = Math.min(Math.max(page, 1), totalPages.value)
  const query = { ...route.query }

  if (target === 1) {
    delete query.page
  } else {
    query.page = String(target)
  }

  await router[replace ? 'replace' : 'push']({ name: 'home', query })
}

watch(
  () => route.query.page,
  (value) => {
    currentPage.value = normalizePage(value)
    loadOfferings(currentPage.value)
  },
  { immediate: true },
)
</script>

<template>
  <section class="home-hero">
    <p class="eyebrow">Feng Chia University</p>
    <h1>FCU Course Reviews</h1>
    <p class="home-hero__description">
      Find courses, professors, and student reviews before choosing your next class.
    </p>
    <SearchBar v-model="searchQuery" />
  </section>

  <section class="home-offerings" aria-labelledby="offerings-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Course offerings</p>
        <h2 id="offerings-heading">Explore classes</h2>
      </div>
      <span v-if="!loading && !errorMessage">{{ totalOfferings }} available</span>
    </div>

    <p v-if="loading" class="status-message" role="status">Loading offerings...</p>

    <div v-else-if="errorMessage" class="status-message status-message--error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="button" type="button" @click="loadOfferings">Try again</button>
    </div>

    <p v-else-if="!offerings.length" class="status-message">
      No offerings are available yet.
    </p>

    <div v-else class="offering-list">
      <OfferingCard
        v-for="offering in offerings"
        :key="offering.id || offering.offering_id"
        :offering="offering"
      />
    </div>

    <PaginationControls
      v-if="!loading && !errorMessage && totalPages > 1"
      :current-page="currentPage"
      :total-pages="totalPages"
      @change="goToPage"
    />
  </section>
</template>
