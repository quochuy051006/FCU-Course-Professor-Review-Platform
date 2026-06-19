import { h } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { getStoredUser, getToken } from './api'

const RoutePlaceholder = {
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () => h('section', { class: 'route-placeholder' }, [h('h1', props.title)])
  },
}

const routes = [
  {
    path: '/',
    name: 'home',
    component: RoutePlaceholder,
    props: { title: 'Home' },
    meta: { title: 'Home' },
  },
  {
    path: '/login',
    name: 'login',
    component: RoutePlaceholder,
    props: { title: 'Login' },
    meta: { title: 'Login', guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: RoutePlaceholder,
    props: { title: 'Register' },
    meta: { title: 'Register', guestOnly: true },
  },
  {
    path: '/search',
    name: 'search',
    component: RoutePlaceholder,
    props: { title: 'Search' },
    meta: { title: 'Search' },
  },
  {
    path: '/offerings/:id',
    name: 'offering-detail',
    component: RoutePlaceholder,
    props: { title: 'Offering details' },
    meta: { title: 'Offering details' },
  },
  {
    path: '/offerings/:id/review',
    name: 'create-review',
    component: RoutePlaceholder,
    props: { title: 'Write a review' },
    meta: { title: 'Write a review', requiresAuth: true },
  },
  {
    path: '/reviews/:id/edit',
    name: 'edit-review',
    component: RoutePlaceholder,
    props: { title: 'Edit review' },
    meta: { title: 'Edit review', requiresAuth: true },
  },
  {
    path: '/me/reviews',
    name: 'my-reviews',
    component: RoutePlaceholder,
    props: { title: 'My reviews' },
    meta: { title: 'My reviews', requiresAuth: true },
  },
  {
    path: '/admin/reports',
    name: 'admin-reports',
    component: RoutePlaceholder,
    props: { title: 'Admin reports' },
    meta: { title: 'Admin reports', requiresAuth: true, requiresAdmin: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const token = getToken()
  const user = getStoredUser()

  if (to.meta.requiresAuth && !token) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresAdmin && user?.role !== 'admin') {
    return { name: 'home' }
  }

  if (to.meta.guestOnly && token) {
    return { name: 'home' }
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} | FCU Reviews`
    : 'FCU Reviews'
})

export default router
