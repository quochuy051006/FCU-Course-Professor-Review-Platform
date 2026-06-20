<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import OfferingCard from '../components/OfferingCard.vue'
import PaginationControls from '../components/PaginationControls.vue'

const PAGE_SIZE = 15
const FILTER_KEYS = [
  'q',
  'selcode',
  'course_name',
  'professor',
  'department',
  'semester',
  'credits',
]

const filterFields = [
  { key: 'q', label: 'Keyword', placeholder: 'Any course information' },
  { key: 'selcode', label: 'Selection code', placeholder: 'Example: 3553' },
  { key: 'course_name', label: 'Course name or ID', placeholder: 'Chinese name or course ID' },
  { key: 'professor', label: 'Professor', placeholder: 'Chinese professor name' },
  { key: 'department', label: 'Department or class', placeholder: 'Type or choose a department' },
  { key: 'semester', label: 'Semester', placeholder: 'Example: 114-1' },
  { key: 'credits', label: 'Credits', placeholder: 'Example: 3', type: 'number' },
]

const route = useRoute()
const router = useRouter()
const filters = reactive(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))
const appliedFilters = ref({})
const results = ref([])
const currentPage = ref(1)
const totalResults = ref(0)
const departmentOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')
let activeRequest = 0

const totalPages = computed(() => Math.max(1, Math.ceil(totalResults.value / PAGE_SIZE)))
const hasAppliedFilters = computed(() => Object.keys(appliedFilters.value).length > 0)
const activeFilterLabels = computed(() => filterFields
  .filter((field) => appliedFilters.value[field.key])
  .map((field) => `${field.label}: ${appliedFilters.value[field.key]}`))

function normalizeValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePage(value) {
  const page = Number.parseInt(value, 10)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function compactFilters(source) {
  return Object.fromEntries(
    FILTER_KEYS
      .map((key) => [key, normalizeValue(source[key])])
      .filter(([, value]) => value),
  )
}

function syncForm(nextFilters) {
  for (const key of FILTER_KEYS) {
    filters[key] = nextFilters[key] || ''
  }
}

async function loadDepartmentOptions() {
  try {
    const response = await api.get('/offerings/departments')
    departmentOptions.value = Array.isArray(response.data?.items) ? response.data.items : []
  } catch {
    departmentOptions.value = []
  }
}

async function loadResults(filterValues, page = currentPage.value) {
  const requestId = ++activeRequest
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/offerings/search', {
      params: {
        ...filterValues,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      },
    })

    if (requestId !== activeRequest) return

    results.value = Array.isArray(response.data?.items) ? response.data.items : []
    totalResults.value = Number(response.data?.total) || results.value.length

    const lastPage = Math.max(1, Math.ceil(totalResults.value / PAGE_SIZE))
    if (page > lastPage) {
      await goToPage(lastPage, true)
    }
  } catch (error) {
    if (requestId === activeRequest) {
      results.value = []
      totalResults.value = 0
      errorMessage.value = error.response?.data?.message || 'Unable to search offerings.'
    }
  } finally {
    if (requestId === activeRequest) {
      loading.value = false
    }
  }
}

async function submitFilters() {
  const query = compactFilters(filters)
  await router.push({ name: 'search', query })
}

async function clearFilters() {
  syncForm({})
  await router.push({ name: 'search' })
}

async function goToPage(page, replace = false) {
  const target = Math.min(Math.max(page, 1), totalPages.value)
  const query = { ...appliedFilters.value }

  if (target > 1) {
    query.page = String(target)
  }

  await router[replace ? 'replace' : 'push']({ name: 'search', query })
}

watch(
  () => [...FILTER_KEYS.map((key) => route.query[key]), route.query.page],
  (values) => {
    const nextFilters = Object.fromEntries(
      FILTER_KEYS
        .map((key, index) => [key, normalizeValue(values[index])])
        .filter(([, value]) => value),
    )
    const page = normalizePage(values[FILTER_KEYS.length])

    syncForm(nextFilters)
    appliedFilters.value = nextFilters
    currentPage.value = page

    if (Object.keys(nextFilters).length) {
      loadResults(nextFilters, page)
      return
    }

    activeRequest += 1
    results.value = []
    totalResults.value = 0
    errorMessage.value = ''
    loading.value = false
  },
  { immediate: true },
)

onMounted(loadDepartmentOptions)
</script>

<template>
  <section class="search-page" aria-labelledby="search-heading">
    <header class="search-page__header">
      <p class="eyebrow">Find your next class</p>
      <h1 id="search-heading">Search offerings</h1>
      <p>Combine one or more filters to narrow the course offerings.</p>

      <form class="filter-form" @submit.prevent="submitFilters">
        <div class="filter-form__grid">
          <div v-for="field in filterFields" :key="field.key" class="form-field">
            <label :for="`filter-${field.key}`">{{ field.label }}</label>
            <input
              :id="`filter-${field.key}`"
              v-model="filters[field.key]"
              :list="field.key === 'department' ? 'department-options' : undefined"
              :min="field.type === 'number' ? 0 : undefined"
              :placeholder="field.placeholder"
              :type="field.type || 'text'"
            >
          </div>
          <datalist id="department-options">
            <option
              v-for="department in departmentOptions"
              :key="department.dept_id"
              :label="`${department.dept_id} - ${department.offering_count} offerings`"
              :value="department.dept_name"
            />
          </datalist>
        </div>

        <div class="filter-form__actions">
          <button class="button button--secondary" type="button" @click="clearFilters">
            Clear
          </button>
          <button class="button" type="submit">Search</button>
        </div>
      </form>
    </header>

    <p v-if="!hasAppliedFilters" class="status-message">
      Select at least one filter to search course offerings.
    </p>

    <p v-else-if="loading" class="status-message" role="status">Searching offerings...</p>

    <div v-else-if="errorMessage" class="status-message status-message--error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="button" type="button" @click="loadResults(appliedFilters, currentPage)">
        Try again
      </button>
    </div>

    <section v-else aria-labelledby="results-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Search results</p>
          <h2 id="results-heading">Filtered offerings</h2>
        </div>
        <span>{{ totalResults }} found</span>
      </div>

      <ul class="active-filters" aria-label="Applied filters">
        <li v-for="label in activeFilterLabels" :key="label">{{ label }}</li>
      </ul>

      <p v-if="!results.length" class="status-message">No offerings matched these filters.</p>

      <div v-else class="offering-list">
        <OfferingCard
          v-for="offering in results"
          :key="offering.offering_id"
          :offering="offering"
        />
      </div>

      <PaginationControls
        v-if="results.length && totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @change="goToPage"
      />
    </section>
  </section>
</template>
