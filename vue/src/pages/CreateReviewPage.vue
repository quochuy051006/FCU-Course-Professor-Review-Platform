<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { getStoredUser } from '../api'
import RatingInput from '../components/RatingInput.vue'
import TagSelector from '../components/TagSelector.vue'

const route = useRoute()
const router = useRouter()

const offering = ref(null)
const tagCategories = ref([])
const loadingOffering = ref(true)
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

const user = getStoredUser()
const isVerified = computed(() => user?.is_verified === true || Number(user?.is_verified) === 1)

const ratingInputs = [
  { field: 'rating_teaching_quality', label: 'Teaching quality' },
  { field: 'rating_grading_fairness', label: 'Grading fairness' },
  { field: 'rating_workload', label: 'Workload' },
  { field: 'rating_exam_difficulty', label: 'Exam difficulty' },
  { field: 'rating_interaction', label: 'Interaction' },
  { field: 'rating_practical_value', label: 'Practical value' },
]

async function loadOffering() {
  const offeringId = Number(route.params.id)
  errorMessage.value = ''

  if (!Number.isInteger(offeringId) || offeringId <= 0) {
    errorMessage.value = 'Invalid offering ID.'
    loadingOffering.value = false
    return
  }

  loadingOffering.value = true

  try {
    const [offeringResponse, tagsResponse] = await Promise.all([
      api.get(`/offerings/${offeringId}`),
      api.get('/tags'),
    ])
    offering.value = offeringResponse.data
    tagCategories.value = Array.isArray(tagsResponse.data?.categories)
      ? tagsResponse.data.categories
      : []
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to load offering details.'
  } finally {
    loadingOffering.value = false
  }
}

async function submitReview() {
  errorMessage.value = ''

  if (!isVerified.value) {
    errorMessage.value = 'Verify your FCU email before submitting a review.'
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
    await api.post(`/offerings/${route.params.id}/reviews`, {
      ...ratings,
      comment: comment.value.trim(),
      advice: advice.value.trim() || null,
      is_anonymous: isAnonymous.value,
      tag_ids: selectedTagIds.value,
    })

    await router.push({ name: 'offering-detail', params: { id: route.params.id } })
  } catch (error) {
    errorMessage.value = error.response?.data?.message || 'Unable to create review.'
  } finally {
    submitting.value = false
  }
}

watch(() => route.params.id, loadOffering, { immediate: true })
</script>

<template>
  <p v-if="loadingOffering" class="status-message" role="status">Loading review form...</p>

  <div v-else-if="!offering" class="status-message status-message--error" role="alert">
    <p>{{ errorMessage }}</p>
    <button class="button" type="button" @click="loadOffering">Try again</button>
  </div>

  <section v-else class="review-form-page" aria-labelledby="create-review-heading">
    <header class="review-form-page__header">
      <p class="eyebrow">
        {{ offering.course.course_code }} &middot; {{ offering.offering.semester }}
      </p>
      <h1 id="create-review-heading">Review {{ offering.course.name_zh || offering.course.name_en }}</h1>
      <p>
        Professor: {{ offering.professor.name_zh || offering.professor.original_name || offering.professor.name_en || 'Not provided' }}
      </p>
    </header>

    <p v-if="!isVerified" class="status-message status-message--error" role="alert">
      Verify your FCU email before submitting a review.
    </p>

    <form class="review-form" :aria-busy="submitting" @submit.prevent="submitReview">
      <section aria-labelledby="rating-fields-heading">
        <h2 id="rating-fields-heading">Rate this class</h2>
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
        <label for="review-comment">Comment</label>
        <textarea
          id="review-comment"
          v-model="comment"
          name="comment"
          placeholder="Describe your experience in this class."
          required
          rows="6"
        />
      </div>

      <div class="form-field">
        <label for="review-advice">Advice <span class="muted">(optional)</span></label>
        <textarea
          id="review-advice"
          v-model="advice"
          name="advice"
          placeholder="What should future students know?"
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
        <RouterLink class="button button--secondary" :to="`/offerings/${route.params.id}`">
          Cancel
        </RouterLink>
        <button class="button" :disabled="submitting || !isVerified" type="submit">
          {{ submitting ? 'Submitting...' : 'Submit review' }}
        </button>
      </div>
    </form>
  </section>
</template>
