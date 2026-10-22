<script setup lang="ts">
import { isPaymentPlugin, errorCodeOf, type PaymentPlugin } from '@dantweb/oxid-fe-core';
import { useHead } from '@unhead/vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { useCartStore } from '../../shop/stores/cart';
import { BASKET_ADD_ITEM, BASKET_CREATE, COUNTRIES_QUERY } from '../api/queries';
import GuestDetailsForm from '../components/GuestDetailsForm.vue';
import type { CountryOption } from '../components/GuestAddressFields.vue';
import { useCheckoutContext } from '../index';
import { checkoutUrls } from '../lib';
import { useCheckoutStore } from '../stores/checkout';

/**
 * Checkout without an account (sprint 140c). The shopper has an anonymous token; it cannot list
 * payment or delivery methods (`basketPayments`, `basketSetDeliveryMethod` are `@Logged`), so the
 * choice is among the payment plugins this instance runs, the basket is built anonymously and
 * `<provider>CheckoutStart` carries the guest details — the shop makes the guest its user there.
 * The hosted payment page is used: the inline components start the payment themselves.
 */
const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client, registry, auth } = useCheckoutContext();
const cart = useCartStore();
const checkout = useCheckoutStore();

const DEFAULT_COUNTRY_ID = 'a7c40f631fc920687.20179984'; // Germany (demo shop default)

const countries = ref<CountryOption[]>([]);
const countriesLoaded = ref(false);
const form = ref<InstanceType<typeof GuestDetailsForm> | null>(null);
const selectedPlugin = ref<string | null>(null);
const termsConfirmed = ref(false);
const busy = ref(false);
const redirecting = ref(false);
const error = ref<unknown>(null);

const plugins = computed<PaymentPlugin[]>(() => registry.all().filter(isPaymentPlugin));
const accountExists = computed(() => errorCodeOf(error.value) === 'account_exists');
const readyToPay = computed(
  () => selectedPlugin.value !== null && termsConfirmed.value && !busy.value && !cart.isEmpty,
);
const defaultCountryId = computed(
  () =>
    countries.value.find((country) => country.id === DEFAULT_COUNTRY_ID)?.id ??
    countries.value[0]?.id ??
    DEFAULT_COUNTRY_ID,
);

onMounted(async () => {
  try {
    const data = await client.execute<{ countries: CountryOption[] }>(COUNTRIES_QUERY);
    countries.value = data.countries;
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
  } finally {
    countriesLoaded.value = true;
  }
  if (plugins.value.length === 1) {
    selectedPlugin.value = plugins.value[0].name;
  }
});

/** A fresh anonymous basket per attempt — a cancelled attempt blocks its old one. */
async function createBasket(): Promise<string> {
  await auth.ensureSession();
  const created = await client.execute<{ basketCreate: { id: string } }>(BASKET_CREATE, {
    title: `fe-guest-checkout-${Date.now()}`,
  });
  for (const item of cart.items) {
    await client.execute(BASKET_ADD_ITEM, {
      basketId: created.basketCreate.id,
      productId: item.productId,
      amount: item.amount,
    });
  }
  return created.basketCreate.id;
}

async function pay(): Promise<void> {
  const plugin = plugins.value.find((entry) => entry.name === selectedPlugin.value);
  const details = form.value?.collect() ?? null;
  if (!plugin || !details) {
    return;
  }
  busy.value = true;
  error.value = null;
  checkout.setGuest(details);
  try {
    const basketId = await createBasket();
    const result = await plugin.start(basketId, {
      ...checkoutUrls(window.location.origin, plugin.name),
      guest: details,
    });
    checkout.setAttempt({
      provider: plugin.name,
      contractId: result.contractId,
      contractToken: result.contractToken,
      orderNumber: result.orderNumber,
    });
    if (!result.redirectUrl) {
      throw new Error(`unsupported renderMode: ${result.renderMode}`);
    }
    redirecting.value = true;
    window.location.assign(result.redirectUrl);
  } catch (cause) {
    error.value = cause ?? new Error('unknown');
  } finally {
    busy.value = false;
  }
}

const providerLabel = (plugin: PaymentPlugin): string =>
  t(`checkout.guest.providers.${plugin.name}`, plugin.name);
</script>

<template>
  <section class="guest-checkout">
    <h1>{{ t('checkout.headline') }}</h1>

    <p v-if="cart.isEmpty" data-testid="guest-cart-empty">
      {{ t('checkout.guest.emptyCart') }}
      <router-link to="/shop">{{ t('checkout.return.toShop') }}</router-link>
    </p>

    <template v-else>
      <p class="hint" data-testid="guest-intro">
        {{ t('checkout.guest.intro') }}
        <router-link to="/login?redirect=/checkout" data-testid="guest-login-hint">{{
          t('checkout.guest.haveAccount')
        }}</router-link>
      </p>

      <h2>{{ t('checkout.guest.detailsHeadline') }}</h2>
      <GuestDetailsForm
        v-if="countriesLoaded"
        ref="form"
        :countries="countries"
        :default-country-id="defaultCountryId"
        :initial="checkout.guest"
      />

      <h2>{{ t('checkout.guest.paymentHeadline') }}</h2>
      <p v-if="plugins.length === 0" role="alert" data-testid="guest-no-payment">
        {{ t('checkout.guest.noPayment') }}
      </p>
      <label v-for="plugin in plugins" :key="plugin.name" class="choice">
        <input
          v-model="selectedPlugin"
          type="radio"
          name="payment"
          :value="plugin.name"
          :data-testid="`payment-${plugin.paymentId}`"
        />
        {{ providerLabel(plugin) }}
      </label>

      <label class="choice">
        <input v-model="termsConfirmed" type="checkbox" data-testid="confirm-terms" />
        {{ t('checkout.payment.terms') }}
      </label>

      <ErrorAlert
        v-if="error"
        :error="error"
        wrap="checkout.errors.start"
        data-testid="checkout-error"
      />
      <p v-if="accountExists" data-testid="guest-account-exists">
        <router-link to="/login?redirect=/checkout" data-testid="guest-login-link">{{
          t('checkout.guest.logInInstead')
        }}</router-link>
      </p>

      <p v-if="redirecting" data-testid="redirecting">{{ t('checkout.payment.redirecting') }}</p>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="!readyToPay"
        data-testid="pay-now"
        @click="pay"
      >
        {{ t('checkout.payment.pay') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.choice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  min-height: 44px;
}
.hint {
  color: var(--oxfe-color-text-muted, #555);
}
button {
  margin-top: 12px;
  min-height: 44px;
}
</style>
