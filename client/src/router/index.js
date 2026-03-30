import { createRouter, createWebHistory } from 'vue-router'

import ThreeDView from '../views/3DView.vue' 
import MapView from '../views/MapView.vue'
import AdminView from '../views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'map',
      component: MapView,
      meta: { title: 'Map' }
    },
    {
      path: '/viewer',
      name: '3d-viewer',
      component: ThreeDView,
      meta: { title: '3D Viewer' }
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { title: 'Admin' }
    }
  ]
})

router.afterEach((to) => {
  const base = document.title.split(' — ')[0] || document.title
  const pageTitle = to.meta?.title
    ? (to.query?.n || to.meta.title)
    : null
  document.title = pageTitle ? `${base} — ${pageTitle}` : base
})

export default router