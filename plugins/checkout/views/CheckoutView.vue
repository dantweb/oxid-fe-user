<script setup lang="ts">
import { addressSchema, type AddressInput, type InlinePaymentAttempt } from '@dantweb/oxid-fe-core';
import {
  computed,
  defineAsyncComponent,
  onMounted,
  reactive,
  ref,
  watch,
  type Component,
} from 'vue';
import { useHead } from '@unhead/vue';
import ErrorAlert from '../../../src/errors/ErrorAlert.vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useCartStore } from '../../shop/stores/cart';
import {
  BASKET_ADD_ITEM,
  BASKET_CREATE,
  BASKET_DELIVERY_METHODS,
  BASKET_PAYMENTS,
  BASKET_SET_DELIVERY_METHOD,
  BASKET_SET_PAYMENT,
  INVOICE_ADDRESS_QUERY,
  PLACE_ORDER,
  SET_INVOICE_ADDRESS,
  type DeliveryMethod,
  type InvoiceAddress,
} from '../api/queries';
import { checkoutUrls, mapPayments, type PaymentChoice } from '../lib';
import { useCheckoutContext } from '../index';
import { useCheckoutStore } from '../stores/checkout';

const { t } = useI18n();
useHead({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] });

const { client, registry } = useCheckoutApi();
const router = useRouter();
const cart = useCartStore();
const checkout = useCheckoutStore();

const DEFAULT_COUNTRY_ID = 'a7c40f631fc920687.20179984'; // Germany (demo shop default)

const address = reactive<AddressInput>({
  salutation: 'MR',
  firstName: '',
  lastName: '',
  street: '',
  streetNumber: '',
  zipCode: '',
  city: '',
  countryId: DEFAULT_COUNTRY_ID,
});
const addressSaved = ref(false);
const addressError = ref<unknown>(null);

const basketId = ref<string | null>(null);
const deliveryMethods = ref<DeliveryMethod[]>([]);
/** The shop answered, and offers this cart no delivery method (its shipping rules). */
const noDelivery = ref(false);
const deliveryMethodId = ref<string | null>(null);
const payments = ref<PaymentChoice[]>([]);
const selectedPaymentId = ref<string | null>(null);
const termsConfirmed = ref(false);
const busy = ref(false);
const redirecting = ref(false);
const error = ref<unknown>(null);
/** which sentence wraps the mapped text of `error` (checkout.errors.start | .basket) */
const errorWrap = ref('checkout.errors.start');
const placedOrderNumber = ref<string | null>(null);

// ---- inline (iframe-mode) payment: the provider's own UI inside this page -----------------------
const selectedChoice = computed(() =>
  payments.value.find((entry) => entry.payment.id === selectedPaymentId.value),
);
const inlineComponents = new Map<string, Component>();
/** The selected plugin's inline component, or null (hosted page / classic payment). */
const inlineComponent = computed<Component | null>(() => {
  const plugin = selectedChoice.value?.plugin;
  const loader = plugin?.inlineComponent?.() ?? null;
  if (!plugin || !loader) {
    return null;
  }
  const known = inlineComponents.get(plugin.name);
  if (known) {
    return known;
  }
  const created = defineAsyncComponent(loader);
  inlineComponents.set(plugin.name, created);
  return created;
});
const inlineUrls = computed(() =>
  selectedChoice.value?.plugin
    ? checkoutUrls(window.location.origin, selectedChoice.value.plugin.name)
    : null,
);
/** True while the current basket has its delivery method — only then may a provider start on it. */
const basketReady = ref(false);
/** After a failed start the form is not remounted by itself (that would loop): the shopper retries. */
const blocked = ref(false);
let rebuilding = false;
/** Mounted only once the shopper picked the method, confirmed the terms and the basket is ready. */
const inlineReady = computed(
  () =>
    inlineComponent.value !== null &&
    basketId.value !== null &&
    basketReady.value &&
    termsConfirmed.value &&
    !blocked.value,
);
/** The open attempt of the mounted inline component — retired if the shopper changes their mind. */
const inlineAttempt = ref<InlinePaymentAttempt | null>(null);

function onAttempt(attempt: InlinePaymentAttempt): void {
  const plugin = selectedChoice.value?.plugin;
  if (!plugin) {
    return;
  }
  inlineAttempt.value = attempt;
  checkout.setAttempt({ provider: plugin.name, ...attempt });
}

function onSettled(): void {
  const plugin = selectedChoice.value?.plugin;
  inlineAttempt.value = null; // finished at the provider: nothing to retire
  if (plugin) {
    void router.push(`/checkout/return/${plugin.name}`);
  }
}

/** A cancelled attempt blocks its basket: continue on a fresh one, keeping the shopper's choices. */
async function rebuildBasket(): Promise<void> {
  if (rebuilding) {
    return;
  }
  rebuilding = true;
  const delivery = deliveryMethodId.value;
  const payment = selectedPaymentId.value;
  try {
    basketId.value = null;
    basketReady.value = false;
    checkout.clear();
    await prepareBasket();
    if (delivery && !basketReady.value) {
      await selectDelivery(delivery);
    }
    selectedPaymentId.value = payment;
  } finally {
    rebuilding = false;
  }
}

function retryPayment(): void {
  error.value = null;
  blocked.value = false;
}

async function onInlineFailed(cause: unknown): Promise<void> {
  inlineAttempt.value = null;
  blocked.value = true;
  fail('checkout.errors.start', cause);
  await rebuildBasket();
}

async function onInlineCancelled(): Promise<void> {
  inlineAttempt.value = null;
  error.value = null;
  await rebuildBasket();
}

// leaving the inline state (other method, terms unticked) retires the open attempt
watch(inlineReady, async (ready, wasReady) => {
  const attempt = inlineAttempt.value;
  const plugin = selectedChoice.value?.plugin;
  if (wasReady && !ready && attempt) {
    inlineAttempt.value = null;
    try {
      await plugin?.cancel(attempt.contractId, attempt.contractToken);
    } catch {
      /* already retired — retiring twice changes nothing */
    }
    await rebuildBasket();
  }
});

const readyToPay = computed(
  () =>
    basketId.value !== null &&
    deliveryMethodId.value !== null &&
    selectedPaymentId.value !== null &&
    termsConfirmed.value &&
    !busy.value,
);

function useCheckoutApi() {
  const ctx = useCheckoutContext();
  return { client: ctx.client, registry: ctx.registry };
}

onMounted(async () => {
  try {
    const data = await client.execute<{ customerInvoiceAddress: InvoiceAddress | null }>(
      INVOICE_ADDRESS_QUERY,
    );
    const existing = data.customerInvoiceAddress;
    if (existing?.firstName && existing.street) {
      Object.assign(address, {
        salutation: existing.salutation ?? 'MR',
        firstName: existing.firstName,
        lastName: existing.lastName,
        street: existing.street,
        streetNumber: existing.streetNumber,
        zipCode: existing.zipCode,
        city: existing.city,
        countryId: existing.country?.id ?? DEFAULT_COUNTRY_ID,
      });
      addressSaved.value = true;
      await prepareBasket();
    }
  } catch {
    /* no address yet — the form collects one */
  }
});

async function saveAddress(): Promise<void> {
  addressError.value = null;
  const parsed = addressSchema.safeParse(address);
  if (!parsed.success) {
    addressError.value = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    return;
  }
  busy.value = true;
  try {
    await client.execute(SET_INVOICE_ADDRESS, { address: parsed.data });
    addressSaved.value = true;
    await prepareBasket();
  } catch (cause) {
    addressError.value = cause ?? new Error('unknown');
  } finally {
    busy.value = false;
  }
}

/** Fresh server-side basket per attempt — a cancelled attempt blocks its old basket. */
async function prepareBasket(): Promise<void> {
  basketReady.value = false;
  error.value = null;
  busy.value = true;
  try {
    const created = await client.execute<{ basketCreate: { id: string } }>(BASKET_CREATE, {
      title: `fe-checkout-${Date.now()}`,
    });
    for (const item of cart.items) {
      await client.execute(BASKET_ADD_ITEM, {
        basketId: created.basketCreate.id,
        productId: item.productId,
        amount: item.amount,
      });
    }
    basketId.value = created.basketCreate.id;

    const methods = await client.execute<{ basketDeliveryMethods: DeliveryMethod[] }>(
      BASKET_DELIVERY_METHODS,
      { basketId: basketId.value },
    );
    deliveryMethods.value = methods.basketDeliveryMethods;
    noDelivery.value = methods.basketDeliveryMethods.length === 0;
    if (methods.basketDeliveryMethods.length === 1) {
      await selectDelivery(methods.basketDeliveryMethods[0].id);
    }
  } catch (cause) {
    fail('checkout.errors.basket', cause);
  } finally {
    busy.value = false;
  }
}

async function selectDelivery(methodId: string): Promise<void> {
  if (!basketId.value) {
    return;
  }
  await client.execute(BASKET_SET_DELIVERY_METHOD, {
    basketId: basketId.value,
    deliveryMethodId: methodId,
  });
  deliveryMethodId.value = methodId;

  const offered = await client.execute<{ basketPayments: { id: string; title: string }[] }>(
    BASKET_PAYMENTS,
    { basketId: basketId.value },
  );
  payments.value = mapPayments(offered.basketPayments, (id) => registry.paymentPluginFor(id));
  if (payments.value.length === 1) {
    selectedPaymentId.value = payments.value[0].payment.id;
  }
  basketReady.value = true;
}

async function pay(): Promise<void> {
  const choice = payments.value.find((entry) => entry.payment.id === selectedPaymentId.value);
  if (!choice || !basketId.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    if (choice.plugin) {
      const urls = checkoutUrls(window.location.origin, choice.plugin.name);
      const result = await choice.plugin.start(basketId.value, urls);
      checkout.setAttempt({
        provider: choice.plugin.name,
        contractId: result.contractId,
        contractToken: result.contractToken,
        orderNumber: result.orderNumber,
      });
      if (result.renderMode === 'redirect' && result.redirectUrl) {
        redirecting.value = true;
        window.location.assign(result.redirectUrl);
        return;
      }
      throw new Error(`unsupported renderMode: ${result.renderMode}`);
    }
    // Classic, non-contract payment: basketSetPayment + placeOrder
    await client.execute(BASKET_SET_PAYMENT, {
      basketId: basketId.value,
      paymentId: choice.payment.id,
    });
    const placed = await client.execute<{ placeOrder: { orderNumber: string } }>(PLACE_ORDER, {
      basketId: basketId.value,
    });
    placedOrderNumber.value = String(placed.placeOrder.orderNumber);
    cart.clear();
  } catch (cause) {
    fail('checkout.errors.start', cause);
    basketId.value = null; // attempt consumed the basket — prepare a fresh one
    await prepareBasket();
  } finally {
    busy.value = false;
  }
}

/** The shopper sees the mapped text (src/errors); the raw cause stays for the debug details only. */
function fail(wrapKey: string, cause: unknown): void {
  errorWrap.value = wrapKey;
  error.value = cause ?? new Error('unknown');
}
</script>

<template>
  <section>
    <h1>{{ t('checkout.headline') }}</h1>

    <p v-if="placedOrderNumber" data-testid="order-confirmed">
      {{ t('checkout.return.committed', { orderNumber: placedOrderNumber }) }}
    </p>

    <template v-else>
      <h2>{{ t('checkout.address.headline') }}</h2>
      <form
        v-if="!addressSaved"
        class="address"
        data-testid="address-form"
        @submit.prevent="saveAddress"
      >
        <label
          >{{ t('checkout.address.firstName') }}<input v-model="address.firstName" name="firstName"
        /></label>
        <label
          >{{ t('checkout.address.lastName') }}<input v-model="address.lastName" name="lastName"
        /></label>
        <label
          >{{ t('checkout.address.street') }}<input v-model="address.street" name="street"
        /></label>
        <label
          >{{ t('checkout.address.streetNumber')
          }}<input v-model="address.streetNumber" name="streetNumber"
        /></label>
        <label
          >{{ t('checkout.address.zipCode') }}<input v-model="address.zipCode" name="zipCode"
        /></label>
        <label>{{ t('checkout.address.city') }}<input v-model="address.city" name="city" /></label>
        <ErrorAlert v-if="addressError" :error="addressError" data-testid="address-error" />
        <button class="btn btn-primary" type="submit" :disabled="busy" data-testid="save-address">
          {{ t('checkout.address.save') }}
        </button>
      </form>
      <p v-else data-testid="address-saved">
        {{ t('checkout.address.saved') }}: {{ address.firstName }} {{ address.lastName }},
        {{ address.street }} {{ address.streetNumber }}, {{ address.zipCode }} {{ address.city }}
      </p>

      <template v-if="addressSaved">
        <h2>{{ t('checkout.delivery.headline') }}</h2>
        <p v-if="busy && !deliveryMethods.length">{{ t('checkout.delivery.loading') }}</p>
        <div v-if="noDelivery" class="alert alert-danger" role="alert" data-testid="no-delivery">
          {{ t('checkout.delivery.none') }}
          <router-link to="/shop/cart" data-testid="no-delivery-cart">{{
            t('checkout.delivery.backToCart')
          }}</router-link>
        </div>
        <div v-if="error && !deliveryMethodId" class="alert alert-danger">
          <ErrorAlert :error="error" :wrap="errorWrap" data-testid="checkout-error" />
          <router-link to="/shop/cart" data-testid="checkout-error-cart">{{
            t('checkout.delivery.backToCart')
          }}</router-link>
        </div>
        <label v-for="method in deliveryMethods" :key="method.id" class="choice">
          <input
            type="radio"
            name="delivery"
            :checked="deliveryMethodId === method.id"
            :disabled="inlineAttempt !== null"
            @change="selectDelivery(method.id)"
          />
          {{ method.title }}
        </label>
      </template>

      <template v-if="deliveryMethodId">
        <h2>{{ t('checkout.payment.headline') }}</h2>
        <label v-for="choice in payments" :key="choice.payment.id" class="choice">
          <input
            v-model="selectedPaymentId"
            type="radio"
            name="payment"
            :value="choice.payment.id"
            :data-testid="`payment-${choice.payment.id}`"
          />
          {{ choice.payment.title }}
        </label>
        <label class="choice">
          <input v-model="termsConfirmed" type="checkbox" data-testid="confirm-terms" />
          {{ t('checkout.payment.terms') }}
        </label>
        <ErrorAlert v-if="error" :error="error" :wrap="errorWrap" data-testid="checkout-error" />
        <button
          v-if="blocked"
          class="btn btn-primary"
          type="button"
          data-testid="retry-payment"
          @click="retryPayment"
        >
          {{ t('checkout.payment.retry') }}
        </button>
        <p v-if="redirecting" data-testid="redirecting">{{ t('checkout.payment.redirecting') }}</p>

        <div v-if="inlineComponent" class="inline-payment" data-testid="inline-payment">
          <component
            :is="inlineComponent"
            v-if="inlineReady && inlineUrls"
            :basket-id="basketId"
            :return-url="inlineUrls.returnUrl"
            :cancel-url="inlineUrls.cancelUrl"
            @attempt="onAttempt"
            @settled="onSettled"
            @failed="onInlineFailed"
            @cancelled="onInlineCancelled"
          />
          <p v-else class="inline-payment__hint" data-testid="inline-hint">
            {{ t('checkout.payment.confirmTermsFirst') }}
          </p>
        </div>
        <button
          v-else
          class="btn btn-primary"
          type="button"
          :disabled="!readyToPay"
          data-testid="pay-now"
          @click="pay"
        >
          {{ t('checkout.payment.pay') }}
        </button>
      </template>
    </template>
  </section>
</template>

<style scoped>
.address {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 280px));
  gap: 12px;
}
.address label,
.choice {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.choice {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.inline-payment {
  margin-top: 12px;
  min-height: 56px;
}
.inline-payment__hint {
  color: var(--oxfe-color-text-muted, #555);
  font-style: italic;
}
input[type='text'],
.address input {
  padding: 8px;
  border: 1px solid var(--oxfe-color-input-border, #ccc);
  border-radius: var(--oxfe-radius-sm, 4px);
}
button {
  margin-top: 12px;
}
</style>
