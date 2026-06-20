<script setup>
import { onMounted, ref } from 'vue'
import api from '../api'

const reports = ref([])
const loading = ref(true)
const errorMessage = ref('')
const actionMessage = ref('')
const activeAction = ref('')

const ratingFields = [
  'rating_teaching_quality',
  'rating_grading_fairness',
  'rating_workload',
  'rating_exam_difficulty',
  'rating_interaction',
  'rating_practical_value',
]

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function averageRating(review) {
  const ratings = ratingFields
    .map((field) => Number(review[field]))
    .filter(Number.isFinite)

  if (!ratings.length) return 'Not rated'

  return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)
}

async function loadReports() {
  loading.value = true
  errorMessage.value = ''
  actionMessage.value = ''

  try {
    const response = await api.get('/admin/reports')
    reports.value = Array.isArray(response.data?.items) ? response.data.items : []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to load reports.'
  } finally {
    loading.value = false
  }
}

async function hideReview(report) {
  const confirmed = window.confirm('Hide this review from public offering pages?')
  if (!confirmed) return

  activeAction.value = `hide-${report.report_id}`
  errorMessage.value = ''
  actionMessage.value = ''

  try {
    const response = await api.put(`/admin/reviews/${report.review.review_id}/hide`)
    report.review.review_status = 'hidden'
    actionMessage.value = response.data.message
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to hide review.'
  } finally {
    activeAction.value = ''
  }
}

async function resolveReport(report) {
  const confirmed = window.confirm('Mark this report as resolved?')
  if (!confirmed) return

  activeAction.value = `resolve-${report.report_id}`
  errorMessage.value = ''
  actionMessage.value = ''

  try {
    const response = await api.put(`/admin/reports/${report.report_id}/resolve`)
    reports.value = reports.value.filter((item) => item.report_id !== report.report_id)
    actionMessage.value = response.data.message
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to resolve report.'
  } finally {
    activeAction.value = ''
  }
}

onMounted(loadReports)
</script>

<template>
  <section class="admin-reports-page" aria-labelledby="admin-reports-heading">
    <header class="section-heading">
      <div>
        <p class="eyebrow">Moderation</p>
        <h1 id="admin-reports-heading">Pending Reports</h1>
      </div>
      <span v-if="!loading && !errorMessage">{{ reports.length }} pending</span>
    </header>

    <p v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage && !loading" class="form-error" role="alert">{{ errorMessage }}</p>

    <p v-if="loading" class="status-message" role="status">Loading reports...</p>

    <div v-else-if="errorMessage && !reports.length" class="status-message status-message--error">
      <button class="button" type="button" @click="loadReports">Try again</button>
    </div>

    <div v-else-if="!reports.length" class="status-message">
      <p>There are no pending reports.</p>
    </div>

    <div v-else class="admin-report-list">
      <article v-for="report in reports" :key="report.report_id" class="card admin-report-card">
        <header class="admin-report-card__header">
          <div>
            <p class="eyebrow">Report #{{ report.report_id }}</p>
            <h2>{{ report.course?.name_zh || report.course?.name_en || 'Unknown course' }}</h2>
            <p>
              {{ report.course?.course_code || 'No course code' }}
              <template v-if="report.offering?.semester">
                &middot; {{ report.offering.semester }}
              </template>
            </p>
          </div>
          <div class="admin-report-card__meta">
            <span class="status-pill">{{ report.report_status }}</span>
            <span class="muted">{{ formatDate(report.report_created_at) }}</span>
          </div>
        </header>

        <dl class="report-details">
          <div>
            <dt>Reason</dt>
            <dd>{{ report.reason }}</dd>
          </div>
          <div>
            <dt>Reporter</dt>
            <dd>{{ report.reporter.email }}</dd>
          </div>
          <div>
            <dt>Review author</dt>
            <dd>
              {{ report.review.is_anonymous ? 'Anonymous' : report.review_author.email || 'Unknown' }}
            </dd>
          </div>
          <div>
            <dt>Professor</dt>
            <dd>{{ report.professor?.name_zh || report.professor?.name_en || 'Not provided' }}</dd>
          </div>
        </dl>

        <section class="reported-review" aria-label="Reported review">
          <div class="reported-review__heading">
            <strong>Review #{{ report.review.review_id }}</strong>
            <span class="rating-badge">{{ averageRating(report.review) }} / 5</span>
          </div>
          <p>{{ report.review.comment }}</p>
          <p v-if="report.review.advice"><strong>Advice:</strong> {{ report.review.advice }}</p>
          <p class="muted">Current status: {{ report.review.review_status }}</p>
        </section>

        <footer class="admin-report-card__actions">
          <RouterLink
            v-if="report.offering"
            class="button button--secondary"
            :to="`/offerings/${report.offering.offering_id}`"
          >
            View offering
          </RouterLink>
          <button
            class="button button--danger"
            :disabled="report.review.review_status === 'hidden' || Boolean(activeAction)"
            type="button"
            @click="hideReview(report)"
          >
            {{ report.review.review_status === 'hidden' ? 'Review hidden' : 'Hide review' }}
          </button>
          <button
            class="button"
            :disabled="Boolean(activeAction)"
            type="button"
            @click="resolveReport(report)"
          >
            {{ activeAction === `resolve-${report.report_id}` ? 'Resolving...' : 'Resolve report' }}
          </button>
        </footer>
      </article>
    </div>
  </section>
</template>
