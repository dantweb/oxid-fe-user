<script setup lang="ts">
import { loadScriptOnce, type InlinePaymentAttempt } from '@dantweb/oxid-fe-core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mollieLocale, useMollieInline, type MollieKeys } from './index';

const props = defineProps<{ basketId: string; returnUrl: string; cancelUrl: string }>();
const emit = defineEmits<{
  attempt: [InlinePaymentAttempt];
  settled: [];
  failed: [string];
}>();

type ComponentName = 'cardHolder' | 'cardNumber' | 'expiryDate' | 'verificationCode';
interface MollieComponent {
  mount(target: HTMLElement): void;
  unmount(): void;
}
interface MollieInstance {
  createComponent(name: ComponentName): MollieComponent;
  createToken(): Promise<{ token?: string; error?: { message?: string } }>;
}
type MollieFactory = (
  profileId: string,
  options: { locale: string; testmode: boolean },
) => MollieInstance;

const MOLLIE_JS = 'https://js.mollie.com/v1/mollie.js';
const CARD = 'creditcard';
const FIELDS: { name: ComponentName; label: string }[] = [
  { name: 'cardHolder', label: 'cardHolder' },
  { name: 'cardNumber', label: 'cardNumber' },
  { name: 'expiryDate', label: 'expiryDate' },
  { name: 'verificationCode', label: 'verificationCode' },
];

const { t, te, locale } = useI18n();
const { api, config, loadKeys } = useMollieInline();
const selected = ref(config.methods[0] ?? CARD);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const slots = ref<Partial<Record<ComponentName, HTMLElement>>>({});
const isCard = computed(() => selected.value === CARD);
let mounted: MollieComponent[] = [];
let mollie: MollieInstance | null = null;
let disposed = false;

function label(method: string): string {
  const key = `payment-mollie.methods.${method}`;
  return te(key) ? t(key) : method;
}

function mountFields(): void {
  const factory = mollie;
  if (!factory) {
    return;
  }
  for (const { name } of FIELDS) {
    const target = slots.value[name];
    if (target) {
      const component = factory.createComponent(name);
      component.mount(target);
      mounted.push(component);
    }
  }
}

function unmountFields(): void {
  for (const component of mounted) {
    component.unmount();
  }
  mounted = [];
}

async function chooseMethod(method: string): Promise<void> {
  if (busy.value || method === selected.value) {
    return;
  }
  const wasCard = isCard.value;
  selected.value = method;
  error.value = '';
  if (wasCard) {
    unmountFields();
  }
  if (method === CARD) {
    await nextTick();
    mountFields();
  }
}

async function retire(attempt: InlinePaymentAttempt): Promise<void> {
  await api.cancel(attempt.contractId, attempt.contractToken).catch(() => undefined);
}

/** Starts the contract; a redirect (3-D Secure, other methods) leaves the page, otherwise it is paid. */
async function pay(method: string, cardToken?: string): Promise<void> {
  const started = await api.start(props.basketId, {
    returnUrl: props.returnUrl,
    cancelUrl: props.cancelUrl,
    uiMode: cardToken ? 'embedded' : 'hosted',
    providerOptions: { method, ...(cardToken ? { cardToken } : {}) },
  });
  const attempt = {
    contractId: started.contractId,
    contractToken: started.contractToken,
    orderNumber: started.orderNumber,
  };
  emit('attempt', attempt);
  if (started.redirectUrl) {
    window.location.assign(started.redirectUrl);
    return;
  }
  if (!cardToken) {
    await retire(attempt);
    throw new Error('Mollie did not answer a payment page');
  }
  emit('settled');
}

async function submit(): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    if (isCard.value) {
      const minted = await mollie?.createToken();
      if (!minted?.token) {
        error.value = t('payment-mollie.tokenFailed', {
          message: minted?.error?.message ?? '',
        });
        busy.value = false;
        return;
      }
      await pay(CARD, minted.token);
    } else {
      await pay(selected.value);
    }
  } catch (cause) {
    emit('failed', cause instanceof Error ? cause.message : String(cause));
  }
  // success leaves the page (or the component): keep the button locked until then
}

onMounted(async () => {
  let keys: MollieKeys;
  try {
    keys = await loadKeys();
  } catch {
    return; // the plugin has switched to the hosted page; this component is about to go
  }
  try {
    await loadScriptOnce(MOLLIE_JS);
    const factory = (window as unknown as { Mollie?: MollieFactory }).Mollie;
    if (!factory || disposed) {
      return;
    }
    mollie = factory(keys.profileId, {
      locale: mollieLocale(String(locale.value), config.locale),
      testmode: keys.testMode,
    });
    loading.value = false;
    await nextTick();
    if (isCard.value) {
      mountFields();
    }
  } catch (cause) {
    emit('failed', cause instanceof Error ? cause.message : String(cause));
  }
});

onBeforeUnmount(() => {
  disposed = true;
  unmountFields();
});
</script>

<template>
  <div class="mollie-inline" data-testid="mollie-inline">
    <p v-if="loading" class="mollie-inline__loading" data-testid="mollie-inline-loading">
      {{ t('checkout.payment.loadingProvider') }}
    </p>
    <template v-else>
      <fieldset v-if="config.methods.length > 1" class="mollie-inline__methods">
        <legend>{{ t('payment-mollie.method') }}</legend>
        <label v-for="method in config.methods" :key="method">
          <input
            type="radio"
            name="mollie-method"
            :value="method"
            :checked="selected === method"
            :disabled="busy"
            :data-testid="`mollie-method-${method}`"
            @change="chooseMethod(method)"
          />
          {{ label(method) }}
        </label>
      </fieldset>

      <div v-show="isCard" class="mollie-inline__card" data-testid="mollie-card">
        <div v-for="field in FIELDS" :key="field.name" class="mollie-inline__field">
          <span>{{ t(`payment-mollie.${field.label}`) }}</span>
          <div
            :ref="
              (element) => {
                if (element) slots[field.name] = element as HTMLElement;
              }
            "
            class="mollie-inline__input"
            :data-testid="`mollie-${field.name}`"
          />
        </div>
      </div>

      <p v-if="error" class="mollie-inline__error" role="alert" data-testid="mollie-error">
        {{ error }}
      </p>
      <button
        type="button"
        class="btn btn-primary mollie-inline__pay"
        :disabled="busy"
        data-testid="mollie-pay"
        @click="submit"
      >
        {{
          isCard
            ? t('payment-mollie.payWithCard')
            : t('payment-mollie.payWith', { method: label(selected) })
        }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.mollie-inline {
  max-width: 480px;
  min-height: 120px;
}
.mollie-inline__loading {
  color: var(--oxfe-color-text-muted, #555);
}
.mollie-inline__methods {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
  border: 0;
  padding: 0;
}
.mollie-inline__field {
  margin-bottom: 0.75rem;
}
.mollie-inline__field span {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}
.mollie-inline__pay {
  margin-top: 0.5rem;
}
.mollie-inline__input {
  min-height: 2.5rem;
  padding: 0.5rem;
  border: 1px solid var(--oxfe-color-border, #ccc);
  border-radius: var(--oxfe-radius, 4px);
  background: #fff;
}
.mollie-inline__error {
  color: var(--oxfe-color-danger, #b00020);
}
</style>
