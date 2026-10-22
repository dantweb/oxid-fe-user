import { createAuthGuard, type AuthService, type PluginRegistry } from '@dantweb/oxid-fe-core';
import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteLocationRaw,
  type Router,
} from 'vue-router';
import type { InstanceConfig } from './config/schema';

/**
 * The checkout routes carry no `requiresAuth` of their own: they are open to guests
 * (`meta.guestCheckout`, sprint 140c). An instance that sets `checkout.guest: false` gets the old
 * behaviour back here — a shopper without a customer session is sent to the login.
 */
export function guestCheckoutGuard(
  auth: Pick<AuthService, 'isAuthenticated'>,
  guestAllowed: boolean,
  loginPath = '/login',
): (to: RouteLocationNormalized) => true | RouteLocationRaw {
  return (to: RouteLocationNormalized) => {
    const opensToGuests = to.matched.some((record) => record.meta.guestCheckout === true);
    if (guestAllowed || !opensToGuests || auth.isAuthenticated()) {
      return true;
    }
    return { path: loginPath, query: { redirect: to.fullPath } };
  };
}

export function createAppRouter(
  registry: PluginRegistry,
  auth: AuthService,
  config: Pick<InstanceConfig, 'checkout'>,
): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        // a layout plugin (e.g. peroxid) may take over the front page
        component: registry.overrideFor('home') ?? (() => import('./views/HomeView.vue')),
      },
      { path: '/login', component: () => import('./views/LoginView.vue') },
      { path: '/forgot-password', component: () => import('./views/ForgotPasswordView.vue') },
      { path: '/reset-password', component: () => import('./views/ResetPasswordView.vue') },
      ...registry.routes,
      { path: '/:pathMatch(.*)*', component: () => import('./views/NotFoundView.vue') },
    ],
  });

  router.beforeEach(() => {
    auth.checkExpiry();
    return true;
  });
  router.beforeEach(createAuthGuard(auth));
  router.beforeEach(guestCheckoutGuard(auth, config.checkout.guest));

  return router;
}
