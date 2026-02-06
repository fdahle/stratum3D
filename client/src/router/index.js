import { createRouter, createWebHistory } from 'vue-router'

// 1. Fix casing: 3DView -> 3dView (matches your actual filename)
import ThreeDView from '../views/3DView.vue' 
import MapView from '../views/MapView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'map',
      component: MapView
    },
    {
      // 2. Lowercase URLs are generally preferred
      path: '/3d', 
      name: '3d',
      component: ThreeDView
    }
  ]
})

export default router