<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import RatingInput from '../components/RatingInput.vue'
import TagSelector from '../components/TagSelector.vue'

const route = useRoute()
const router = useRouter()

const review = ref(null)
const tagCategories = ref([])
const loadingReview = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const comment = ref('')
const advice = ref('')
const isAnonymous = ref(false)
const selectedTagIds = ref([])
const ratings = reactive({
  rating_teaching_quality: 0,
  rating_grading_fairness: 0,
  rating_workload: 0,
  rating_exam_difficulty: 0,
  rating_interaction: 0,
  rating_practical_value: 0,
})

const ratingInputs = [
  { field: 'rating_teaching_quality', label: 'Teaching quality' },
  { field: 'rating_grading_fairness', label: 'Grading fairness' },
  { field: 'rating_workload', label: 'Workload' },
  { field: 'rating_exam_difficulty', label: 'Exam difficulty' },
  { field: 'rating_interaction', label: 'Interaction' },
  { field: 'rating_practical_value', label: 'Practical value' },
]

const canEdit = computed(() => review.value?.status !== 'deleted')
const returnRoute = computed(() => {
  if (review.value?.offering_id) {
    return {
      name: 'offering-detail',
      params: { id: review.value.offering_id },
    }
  }

  return { name: 'my-reviews' }
})

function populateForm(existingReview) {
  for (const { field } of ratingInputs) {
    ratings[field] = Number(existingReview[field])
  }

  comment.value = existingReview.comment || ''
  advice.value = existingReview.advice || ''
  isAnonymous.value = Boolean(existingReview.is_anonymous)
  selectedTagIds.value = (existingReview.tags || []).map((tag) => tag.id)
}

async function loadReview() {
  const reviewId = Number(route.params.id)
  review.value = null
  errorMessage.value = ''

  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    errorMessage.value = 'Invalid review ID.'
    loadingReview.value = false
    return
  }

  loadingReview.value = true

  try {
    const [reviewsResponse, tagsResponse] = await Promise.all([
      api.get('/me/reviews'),
      api.get('/tags'),
    ])
    const existingReview = (reviewsResponse.data?.reviews || []).find((item) => item.id === reviewId)

    if (!existingReview) {
      errorMessage.value = 'Review not found in your reviews.'
      return
    }

    review.value = existingReview
    populateForm(existingReview)
    tagCategories.value = Array.isArray(tagsResponse.data?.categories)
      ? tagsResponse.data.categories
      : []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to load review.'
  } finally {
    loadingReview.value = false
  }
}

async function updateReview() {
  errorMessage.value = ''

  if (!canEdit.value) {
    errorMessage.value = 'Deleted reviews cannot be edited.'
    return
  }

  if (Object.values(ratings).some((rating) => rating < 1 || rating > 5)) {
    errorMessage.value = 'Select a rating from 1 to 5 for every category.'
    return
  }

  if (!comment.value.trim()) {
    errorMessage.value = 'Comment cannot be empty.'
    return
  }

  submitting.value = true

  try {
    const response = await api.put(`/reviews/${route.params.id}`, {
      ...ratings,
      comment: comment.value.trim(),
      advice: advice.value.trim() || null,
      is_anonymous: isAnonymous.value,
      tag_ids: selectedTagIds.value,
    })

    review.value = response.data.review
    await router.push(returnRoute.value)
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to update review.'
  } finally {
    submitting.value = false
  }
}

watch(() => route.params.id, loadReview, { immediate: true })
</script>

<template>
  <p v-if="loadingReview" class="status-message" role="status">Loading review...</p>

  <div v-else-if="!review" class="status-message status-message--error" role="alert">
    <p>{{ errorMessage }}</p>
    <button class="button" type="button" @click="loadReview">Try again</button>
  </div>

  <section v-else class="review-form-page" aria-labelledby="edit-review-heading">
    <header class="review-form-page__header">
      <p class="eyebrow">
        {{ review.course_code }} &middot; {{ review.semester }}
      </p>
      <h1 id="edit-review-heading">
        Edit review for {{ review.course_name_zh || review.course_name_en || review.course_code }}
      </h1>
      <p>
        Professor: {{ review.professor_name_zh || review.professor_name_en || 'Not provided' }}
      </p>
    </header>

    <p v-if="!canEdit" class="status-message status-message--error" role="alert">
      Deleted reviews cannot be edited.
    </p>

    <form class="review-form" :aria-busy="submitting" @submit.prevent="updateReview">
      <section aria-labelledby="edit-rating-fields-heading">
        <h2 id="edit-rating-fields-heading">Update your ratings</h2>
        <p class="muted">Choose a score from 1 to 5 for every category.</p>
        <div class="rating-input-grid">
          <RatingInput
            v-for="input in ratingInputs"
            :key="input.field"
            v-model="ratings[input.field]"
            :label="input.label"
            :name="input.field"
          />
        </div>
      </section>

      <div class="form-field">
        <label for="edit-review-comment">Comment</label>
        <textarea
          id="edit-review-comment"
          v-model="comment"
          name="comment"
          required
          rows="6"
        />
      </div>

      <div class="form-field">
        <label for="edit-review-advice">Advice <span class="muted">(optional)</span></label>
        <textarea
          id="edit-review-advice"
          v-model="advice"
          name="advice"
          rows="3"
        />
      </div>

      <label class="checkbox-field">
        <input v-model="isAnonymous" type="checkbox">
        <span>Post this review anonymously</span>
      </label>

      <TagSelector v-model="selectedTagIds" :categories="tagCategories" />

      <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>

      <div class="form-actions">
        <RouterLink class="button button--secondary" :to="returnRoute">Cancel</RouterLink>
        <button class="button" :disabled="submitting || !canEdit" type="submit">
          {{ submitting ? 'Saving...' : 'Save changes' }}
        </button>
      </div>
    </form>
  </section>
</template>
