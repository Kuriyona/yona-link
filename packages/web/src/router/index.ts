import { createRouter, createWebHistory } from 'vue-router';
import type { Permission } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import Keys from '@/views/Keys.vue';
import LinkEdit from '@/views/LinkEdit.vue';
import Links from '@/views/Links.vue';
import Login from '@/views/Login.vue';
import Stats from '@/views/Stats.vue';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresPermission?: Permission;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    {
      path: '/',
      name: 'links',
      component: Links,
      meta: { requiresAuth: true, requiresPermission: 'links:read' }
    },
    {
      path: '/links/new',
      name: 'link-new',
      component: LinkEdit,
      meta: { requiresAuth: true, requiresPermission: 'links:create' }
    },
    {
      path: '/links/:code/edit',
      name: 'link-edit',
      component: LinkEdit,
      meta: { requiresAuth: true, requiresPermission: 'links:update' }
    },
    {
      path: '/links/:code/stats',
      name: 'stats',
      component: Stats,
      meta: { requiresAuth: true, requiresPermission: 'links:stats' }
    },
    {
      path: '/keys',
      name: 'keys',
      component: Keys,
      meta: { requiresAuth: true, requiresPermission: 'keys:manage' }
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.key && to.name !== 'login') {
    return { name: 'login' };
  }
  if (auth.key && to.name === 'login') {
    return { name: 'links' };
  }
  if (auth.key && !auth.info) {
    try {
      await auth.refresh();
    } catch {
      auth.logout();
      return { name: 'login' };
    }
  }
  const perm = to.meta.requiresPermission;
  if (perm && !auth.hasPermission(perm)) {
    return { name: 'links' };
  }
});

export default router;
