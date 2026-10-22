<script setup lang="ts">
import { CoreEvents } from '@dantweb/oxid-fe-core';
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue';
import { useCheckoutContext } from '../index';

/**
 * The /checkout route. A shopper with a customer session gets the checkout as before; anyone else
 * (an anonymous guest token) gets the guest checkout — the route guard has already refused the
 * latter on instances that set `checkout.guest: false`.
 */
const CustomerCheckout = defineAsyncComponent(() => import('./CheckoutView.vue'));
const GuestCheckout = defineAsyncComponent(() => import('./GuestCheckoutView.vue'));

const { auth, events } = useCheckoutContext();
const signedIn = ref(auth.isAuthenticated());
const refresh = (): void => {
  signedIn.value = auth.isAuthenticated();
};
const unsubscribe = [CoreEvents.AuthLogin, CoreEvents.AuthLogout].map((event) =>
  events.on(event, refresh),
);
onBeforeUnmount(() => unsubscribe.forEach((off) => off()));
</script>

<template>
  <CustomerCheckout v-if="signedIn" />
  <GuestCheckout v-else />
</template>
