<script setup>
import { onMounted, ref } from 'vue'
import api from '../api'

const reviews = ref([])
const loading = ref(true)
const errorMessage = ref('')
const actionMessage = ref('')
const deletingReviewId = ref(null)

function formatRating(value) {
  return value == null ? 'Not rated' : Number(value).toFixed(1)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : ''
}

async function loadReviews() {
  loading.value = true
  errorMessage.value = ''
  actionMessage.value = ''

  try {
    const response = await api.get('/me/reviews')
    const items = Array.isArray(response.data?.reviews) ? response.data.reviews : []
    reviews.value = items.filter((review) => review.status !== 'deleted')
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to load your reviews.'
  } finally {
    loading.value = false
  }
}

async function deleteReview(review) {
  const confirmed = window.confirm(
    `Delete your review for ${review.course_name_zh || review.course_name_en || review.course_code}?`,
  )

  if (!confirmed) return

  deletingReviewId.value = review.id
  errorMessage.value = ''
  actionMessage.value = ''

  try {
    const response = await api.delete(`/reviews/${review.id}`)
    reviews.value = reviews.value.filter((item) => item.id !== review.id)
    actionMessage.value = response.data.message
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to delete review.'
  } finally {
    deletingReviewId.value = null
  }
}

onMounted(loadReviews)
</script>

<template>
  <section class="my-reviews-page" aria-labelledby="my-reviews-heading">
    <header class="section-heading">
      <div>
        <p class="eyebrow">Your contributions</p>
        <h1 id="my-reviews-heading">My Reviews</h1>
      </div>
      <span v-if="!loading && !errorMessage">{{ reviews.length }} reviews</span>
    </header>

    <p v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</p>

    <p v-if="loading" class="status-message" role="status">Loading your reviews...</p>

    <div v-else-if="errorMessage" class="status-message status-message--error" role="alert">
      <p>{{ errorMessage }}</p>
      <button class="button" type="button" @click="loadReviews">Try again</button>
    </div>

    <div v-else-if="!reviews.length" class="status-message">
      <p>You have not posted any reviews yet.</p>
      <RouterLink class="button" to="/search">Find an offering</RouterLink>
    </div>

    <div v-else class="my-review-list">
      <article v-for="review in reviews" :key="review.id" class="card my-review-card">
        <header class="my-review-card__header">
          <div>
            <p class="eyebrow">{{ review.course_code }} &middot; {{ review.semester }}</p>
            <h2>{{ review.course_name_zh || review.course_name_en || review.course_code }}</h2>
            <p>
              Professor: {{ review.professor_name_zh || review.professor_name_en || 'Not provided' }}
            </p>
          </div>
          <div class="my-review-card__meta">
            <span class="rating-badge">{{ formatRating(review.overall_rating) }} / 5</span>
            <span v-if="review.status !== 'visible'" class="status-pill">
              {{ review.status }}
            </span>
            <span class="muted">Updated {{ formatDate(review.updated_at) }}</span>
          </div>
        </header>

        <p>{{ review.comment }}</p>
        <p v-if="review.advice"><strong>Advice:</strong> {{ review.advice }}</p>

        <ul v-if="review.tags?.length" class="tag-list" aria-label="Review tags">
          <li v-for="tag in review.tags" :key="tag.id">{{ tag.name_en || tag.name_zh }}</li>
        </ul>

        <footer class="my-review-card__actions">
          <RouterLink
            v-if="review.offering_id"
            class="button button--secondary"
            :to="`/offerings/${review.offering_id}`"
          >
            View offering
          </RouterLink>
          <RouterLink class="button button--secondary" :to="`/reviews/${review.id}/edit`">
            Edit
          </RouterLink>
          <button
            class="button button--danger"
            :disabled="deletingReviewId === review.id"
            type="button"
            @click="deleteReview(review)"
          >
            {{ deletingReviewId === review.id ? 'Deleting...' : 'Delete' }}
          </button>
        </footer>
      </article>
    </div>
  </section>
</template>
