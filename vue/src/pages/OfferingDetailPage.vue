<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { getToken } from '../api'
import ReviewCard from '../components/ReviewCard.vue'

const route = useRoute()
const router = useRouter()

const detail = ref(null)
const reviews = ref([])
const loading = ref(true)
const errorMessage = ref('')
const actionMessage = ref('')
const actionError = ref('')
let activeRequest = 0

const summary = computed(() => detail.value?.review_summary || {})
const ratingBreakdown = computed(() => [
  { label: 'Teaching quality', value: summary.value.average_teaching_quality },
  { label: 'Grading fairness', value: summary.value.average_grading_fairness },
  { label: 'Workload', value: summary.value.average_workload },
  { label: 'Exam difficulty', value: summary.value.average_exam_difficulty },
  { label: 'Interaction', value: summary.value.average_interaction },
  { label: 'Practical value', value: summary.value.average_practical_value },
])

function formatRating(value) {
  return value == null ? 'Not rated' : Number(value).toFixed(1)
}

async function loadOffering() {
  const offeringId = Number(route.params.id)
  const requestId = ++activeRequest

  detail.value = null
  reviews.value = []
  actionMessage.value = ''
  actionError.value = ''

  if (!Number.isInteger(offeringId) || offeringId <= 0) {
    errorMessage.value = 'Invalid offering ID.'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const [detailResponse, reviewsResponse] = await Promise.all([
      api.get(`/offerings/${offeringId}`),
      api.get(`/offerings/${offeringId}/reviews`),
    ])

    if (requestId === activeRequest) {
      detail.value = detailResponse.data
      reviews.value = Array.isArray(reviewsResponse.data?.items)
        ? reviewsResponse.data.items
        : []
    }
  } catch (error) {
    if (requestId === activeRequest) {
      errorMessage.value = error.response?.data?.message || 'Unable to load offering details.'
    }
  } finally {
    if (requestId === activeRequest) {
      loading.value = false
    }
  }
}

function requireLogin() {
  if (getToken()) return true

  router.push({
    name: 'login',
    query: { redirect: route.fullPath },
  })
  return false
}

async function vote({ reviewId, value }) {
  if (!requireLogin()) return

  actionMessage.value = ''
  actionError.value = ''

  try {
    const response = await api.post(`/reviews/${reviewId}/vote`, { value })
    const review = reviews.value.find((item) => item.id === reviewId)

    if (review) {
      review.upvote_count = response.data.upvote_count
      review.downvote_count = response.data.downvote_count
    }

    actionMessage.value = response.data.message
  } catch (error) {
    actionError.value = error.response?.data?.message || 'Unable to save vote.'
  }
}

async function reportReview(reviewId) {
  if (!requireLogin()) return

  const reason = window.prompt('Why are you reporting this review?')
  if (reason === null) return

  if (!reason.trim()) {
    actionMessage.value = ''
    actionError.value = 'Report reason cannot be empty.'
    return
  }

  actionMessage.value = ''
  actionError.value = ''

  try {
    const response = await api.post(`/reviews/${reviewId}/report`, {
      reason: reason.trim(),
    })
    actionMessage.value = response.data.message
  } catch (error) {
    actionError.value = error.response?.data?.message || 'Unable to submit report.'
  }
}

watch(() => route.params.id, loadOffering, { immediate: true })
</script>

<template>
  <p v-if="loading" class="status-message" role="status">Loading offering details...</p>

  <div v-else-if="errorMessage" class="status-message status-message--error" role="alert">
    <p>{{ errorMessage }}</p>
    <button class="button" type="button" @click="loadOffering">Try again</button>
  </div>

  <div v-else-if="detail" class="offering-detail">
    <section class="offering-detail__hero">
      <div>
        <p class="eyebrow">
          {{ detail.course.course_id }} &middot; {{ detail.offering.semester }}
        </p>
        <h1>{{ detail.course.name_zh || 'Unnamed course' }}</h1>
        <p>
          Professor:
          <strong>{{ detail.professor.name_zh || detail.professor.original_name || 'Not provided' }}</strong>
        </p>
      </div>

      <div class="offering-detail__score">
        <strong>{{ formatRating(summary.average_rating) }}</strong>
        <span>Average rating</span>
        <span>{{ summary.review_count || 0 }} reviews</span>
        <RouterLink class="button" :to="`/offerings/${detail.offering.offering_id}/review`">
          Write a review
        </RouterLink>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="course-information-heading">
      <h2 id="course-information-heading">Course information</h2>
      <dl class="course-information-grid">
        <div>
          <dt>Course ID</dt>
          <dd>{{ detail.course.course_id }}</dd>
        </div>
        <div>
          <dt>Chinese name</dt>
          <dd>{{ detail.course.name_zh || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Credits</dt>
          <dd>{{ detail.course.credits ?? 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Semester</dt>
          <dd>{{ detail.offering.semester }}</dd>
        </div>
        <div>
          <dt>Selection code</dt>
          <dd>{{ detail.class_information.selection_code }}</dd>
        </div>
        <div>
          <dt>Class ID</dt>
          <dd>{{ detail.class_information.class_id }}</dd>
        </div>
        <div>
          <dt>Class name</dt>
          <dd>{{ detail.class_information.class_name || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Department ID</dt>
          <dd>{{ detail.class_information.department_id || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Schedule / location</dt>
          <dd>{{ detail.class_information.schedule || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{{ detail.class_information.capacity ?? 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Professor</dt>
          <dd>{{ detail.professor.name_zh || detail.professor.original_name || 'Not provided' }}</dd>
        </div>
      </dl>
      <p v-if="detail.course.description" class="course-description">
        <strong>Description:</strong> {{ detail.course.description }}
      </p>
    </section>

    <section class="detail-section" aria-labelledby="ratings-heading">
      <h2 id="ratings-heading">Rating summary</h2>
      <div class="rating-summary-grid">
        <div v-for="rating in ratingBreakdown" :key="rating.label" class="rating-summary-item">
          <span>{{ rating.label }}</span>
          <strong>{{ formatRating(rating.value) }}</strong>
        </div>
      </div>
    </section>

    <section class="detail-section" aria-labelledby="tags-heading">
      <h2 id="tags-heading">Popular tags</h2>
      <ul v-if="detail.popular_tags.length" class="tag-list">
        <li v-for="tag in detail.popular_tags" :key="tag.id">
          {{ tag.name_en || tag.name_zh }} ({{ tag.count }})
        </li>
      </ul>
      <p v-else class="muted">No tags yet.</p>
    </section>

    <section class="detail-section" aria-labelledby="reviews-heading">
      <div class="section-heading">
        <h2 id="reviews-heading">Student reviews</h2>
        <span>{{ reviews.length }} shown</span>
      </div>

      <p v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</p>
      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

      <p v-if="!reviews.length" class="status-message">No reviews have been posted yet.</p>

      <div v-else class="review-list">
        <ReviewCard
          v-for="review in reviews"
          :key="review.id"
          :review="review"
          @report="reportReview"
          @vote="vote"
        />
      </div>
    </section>
  </div>
</template>
