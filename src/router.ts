import { createAuthGuard, type AuthService, type PluginRegistry } from '@dantweb/oxid-fe-core';
import { createRouter, createWebHistory, type Router } from 'vue-router';

export function createAppRouter(registry: PluginRegistry, auth: AuthService): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: () => import('./views/HomeView.vue') },
      { path: '/login', component: () => import('./views/LoginView.vue') },
      ...registry.routes,
      { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
    ],
  });

  router.beforeEach(() => {
    auth.checkExpiry();
    return true;
  });
  router.beforeEach(createAuthGuard(auth));

  return router;
}
