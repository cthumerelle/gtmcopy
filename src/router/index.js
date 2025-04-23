import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';

// Route components
const Login = () => import('../views/Login.vue');
const Dashboard = () => import('../views/Dashboard.vue');
const CopyPage = () => import('../views/CopyPage.vue');
const History = () => import('../views/History.vue');
const NotFound = () => import('../views/NotFound.vue');
const AuthCallback = () => import('../views/AuthCallback.vue');

// Routes configuration
const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/copy',
    name: 'copy',
    component: CopyPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: History,
    meta: { requiresAuth: true }
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallback,
    meta: { requiresAuth: false }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFound
  }
];

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // Always scroll to top
    return { top: 0 };
  }
});

// Navigation guard to check authentication
router.beforeEach(async (to, from, next) => {
  // Check if the route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const authStore = useAuthStore();
  
  // If route requires auth and user is not authenticated, redirect to login
  if (requiresAuth && !authStore.isAuthenticated) {
    // Store intended destination to redirect after login
    authStore.setRedirectPath(to.fullPath);
    next('/login');
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // If user is already authenticated and tries to access login page,
    // redirect to dashboard
    next('/dashboard');
  } else {
    // Otherwise proceed normally
    next();
  }
});

export default router;
