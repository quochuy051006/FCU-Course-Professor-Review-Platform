const express = require('express')
const db = require('../db')
const { authenticateToken } = require('../middleware/auth')

const reviewsRouter = express.Router()
const myReviewsRouter = express.Router()

const ratingFields = [
  'rating_teaching_quality',
  'rating_grading_fairness',
  'rating_workload',
  'rating_exam_difficulty',
  'rating_interaction',
  'rating_practical_value',
]

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error)
        return
      }

      resolve(rows)
    })
  })

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error)
        return
      }

      resolve(row)
    })
  })

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onResult(error) {
      if (error) {
        reject(error)
        return
      }

      resolve({ id: this.lastID, changes: this.changes })
    })
  })

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function normalizeTagIds(value) {
  if (!Array.isArray(value)) {
    return { error: 'tag_ids must be an array' }
  }

  const tagIds = [...new Set(value.map(Number))]

  if (tagIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { error: 'tag_ids must contain positive integers' }
  }

  return { tagIds }
}

async function validateTagIds(tagIds) {
  if (tagIds.length === 0) {
    return true
  }

  const placeholders = tagIds.map(() => '?').join(', ')
  const row = await get(
    `SELECT COUNT(*) AS count
     FROM tags
     WHERE id IN (${placeholders})`,
    tagIds,
  )

  return row.count === tagIds.length
}

async function attachTags(reviews) {
  if (reviews.length === 0) {
    return reviews
  }

  const reviewIds = reviews.map((review) => review.id)
  const placeholders = reviewIds.map(() => '?').join(', ')
  const rows = await all(
    `SELECT
       review_tags.review_id,
       tags.id,
       tags.name_zh,
       tags.name_en
     FROM review_tags
     JOIN tags ON tags.id = review_tags.tag_id
     WHERE review_tags.review_id IN (${placeholders})
     ORDER BY tags.id`,
    reviewIds,
  )
  const tagsByReview = new Map()

  for (const row of rows) {
    const tags = tagsByReview.get(row.review_id) || []
    tags.push({
      id: row.id,
      name_zh: row.name_zh,
      name_en: row.name_en,
    })
    tagsByReview.set(row.review_id, tags)
  }

  for (const review of reviews) {
    review.tags = tagsByReview.get(review.id) || []
  }

  return reviews
}

async function getReviewResponse(reviewId) {
  const reviews = await all(
    `SELECT
       reviews.id,
       reviews.offering_id,
       reviews.is_anonymous,
       reviews.rating_teaching_quality,
       reviews.rating_grading_fairness,
       reviews.rating_workload,
       reviews.rating_exam_difficulty,
       reviews.rating_interaction,
       reviews.rating_practical_value,
       ROUND(
         (
           reviews.rating_teaching_quality +
           reviews.rating_grading_fairness +
           reviews.rating_workload +
           reviews.rating_exam_difficulty +
           reviews.rating_interaction +
           reviews.rating_practical_value
         ) / 6.0,
         2
       ) AS overall_rating,
       reviews.comment,
       reviews.advice,
       reviews.status,
       reviews.created_at,
       reviews.updated_at,
       courses.code AS course_code,
       courses.name_en AS course_name_en,
       courses.name_zh AS course_name_zh,
       professors.name_en AS professor_name_en,
       professors.name_zh AS professor_name_zh,
       offerings.semester
     FROM reviews
     JOIN offerings ON offerings.id = reviews.offering_id
     JOIN courses ON courses.id = offerings.course_id
     JOIN professors ON professors.id = offerings.professor_id
     WHERE reviews.id = ?`,
    [reviewId],
  )

  await attachTags(reviews)
  return reviews[0] || null
}

reviewsRouter.put('/:id', authenticateToken, async (req, res) => {
  const reviewId = parseId(req.params.id)

  if (!reviewId) {
    return res.status(400).json({
      message: 'Invalid review id',
    })
  }

  try {
    const existingReview = await get('SELECT * FROM reviews WHERE id = ?', [
      reviewId,
    ])

    if (!existingReview) {
      return res.status(404).json({
        message: 'Review not found',
      })
    }

    if (existingReview.user_id !== req.user.id) {
      return res.status(403).json({
        message: 'You can only edit your own review',
      })
    }

    if (existingReview.status === 'deleted') {
      return res.status(409).json({
        message: 'Deleted reviews cannot be edited',
      })
    }

    const body = req.body || {}
    const editableFields = [
      ...ratingFields,
      'is_anonymous',
      'comment',
      'advice',
      'tag_ids',
    ]

    if (!editableFields.some((field) => body[field] !== undefined)) {
      return res.status(400).json({
        message: 'No editable review fields were provided',
      })
    }

    const updatedReview = { ...existingReview }

    for (const field of ratingFields) {
      if (body[field] !== undefined) {
        const value = Number(body[field])

        if (!Number.isInteger(value) || value < 1 || value > 5) {
          return res.status(400).json({
            message: `${field} must be an integer from 1 to 5`,
          })
        }

        updatedReview[field] = value
      }
    }

    if (body.is_anonymous !== undefined) {
      if (body.is_anonymous === true || body.is_anonymous === 1) {
        updatedReview.is_anonymous = 1
      } else if (body.is_anonymous === false || body.is_anonymous === 0) {
        updatedReview.is_anonymous = 0
      } else {
        return res.status(400).json({
          message: 'is_anonymous must be true, false, 1, or 0',
        })
      }
    }

    if (body.comment !== undefined) {
      const comment =
        typeof body.comment === 'string' ? body.comment.trim() : ''

      if (!comment) {
        return res.status(400).json({
          message: 'Comment cannot be empty',
        })
      }

      updatedReview.comment = comment
    }

    if (body.advice !== undefined) {
      updatedReview.advice =
        body.advice === null ? null : String(body.advice).trim()
    }

    let tagIds = null

    if (body.tag_ids !== undefined) {
      const tagResult = normalizeTagIds(body.tag_ids)

      if (tagResult.error) {
        return res.status(400).json({ message: tagResult.error })
      }

      tagIds = tagResult.tagIds

      if (!(await validateTagIds(tagIds))) {
        return res.status(400).json({
          message: 'One or more tag_ids do not exist',
        })
      }
    }

    await run('BEGIN IMMEDIATE TRANSACTION')

    try {
      await run(
        `UPDATE reviews
         SET
           is_anonymous = ?,
           rating_teaching_quality = ?,
           rating_grading_fairness = ?,
           rating_workload = ?,
           rating_exam_difficulty = ?,
           rating_interaction = ?,
           rating_practical_value = ?,
           comment = ?,
           advice = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          updatedReview.is_anonymous,
          updatedReview.rating_teaching_quality,
          updatedReview.rating_grading_fairness,
          updatedReview.rating_workload,
          updatedReview.rating_exam_difficulty,
          updatedReview.rating_interaction,
          updatedReview.rating_practical_value,
          updatedReview.comment,
          updatedReview.advice,
          reviewId,
        ],
      )

      if (tagIds !== null) {
        await run('DELETE FROM review_tags WHERE review_id = ?', [reviewId])

        for (const tagId of tagIds) {
          await run(
            `INSERT INTO review_tags (review_id, tag_id)
             VALUES (?, ?)`,
            [reviewId, tagId],
          )
        }
      }

      await run('COMMIT')
    } catch (error) {
      await run('ROLLBACK')
      throw error
    }

    const review = await getReviewResponse(reviewId)

    return res.json({
      message: 'Review updated successfully',
      review,
    })
  } catch (error) {
    console.error('Failed to update review:', error.message)
    return res.status(500).json({
      message: 'Unable to update review',
    })
  }
})

reviewsRouter.delete('/:id', authenticateToken, async (req, res) => {
  const reviewId = parseId(req.params.id)

  if (!reviewId) {
    return res.status(400).json({
      message: 'Invalid review id',
    })
  }

  try {
    const review = await get(
      'SELECT id, user_id, status FROM reviews WHERE id = ?',
      [reviewId],
    )

    if (!review) {
      return res.status(404).json({
        message: 'Review not found',
      })
    }

    if (review.user_id !== req.user.id) {
      return res.status(403).json({
        message: 'You can only delete your own review',
      })
    }

    if (review.status === 'deleted') {
      return res.status(409).json({
        message: 'Review is already deleted',
      })
    }

    await run(
      `UPDATE reviews
       SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reviewId],
    )

    return res.json({
      message: 'Review deleted successfully',
    })
  } catch (error) {
    console.error('Failed to delete review:', error.message)
    return res.status(500).json({
      message: 'Unable to delete review',
    })
  }
})

myReviewsRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const reviews = await all(
      `SELECT
         reviews.id,
         reviews.offering_id,
         reviews.is_anonymous,
         reviews.rating_teaching_quality,
         reviews.rating_grading_fairness,
         reviews.rating_workload,
         reviews.rating_exam_difficulty,
         reviews.rating_interaction,
         reviews.rating_practical_value,
         ROUND(
           (
             reviews.rating_teaching_quality +
             reviews.rating_grading_fairness +
             reviews.rating_workload +
             reviews.rating_exam_difficulty +
             reviews.rating_interaction +
             reviews.rating_practical_value
           ) / 6.0,
           2
         ) AS overall_rating,
         reviews.comment,
         reviews.advice,
         reviews.status,
         reviews.created_at,
         reviews.updated_at,
         courses.code AS course_code,
         courses.name_en AS course_name_en,
         courses.name_zh AS course_name_zh,
         professors.name_en AS professor_name_en,
         professors.name_zh AS professor_name_zh,
         offerings.semester
       FROM reviews
       JOIN offerings ON offerings.id = reviews.offering_id
       JOIN courses ON courses.id = offerings.course_id
       JOIN professors ON professors.id = offerings.professor_id
       WHERE reviews.user_id = ?
       ORDER BY reviews.updated_at DESC, reviews.id DESC`,
      [req.user.id],
    )

    await attachTags(reviews)
    return res.json({ reviews })
  } catch (error) {
    console.error('Failed to get user reviews:', error.message)
    return res.status(500).json({
      message: 'Unable to get user reviews',
    })
  }
})

module.exports = {
  reviewsRouter,
  myReviewsRouter,
}
