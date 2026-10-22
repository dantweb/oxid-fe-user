<script setup lang="ts">
import type { GuestDetails } from '@dantweb/oxid-fe-core';
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { emptyGuestForm, validateGuestForm, type GuestForm } from '../guest';
import GuestAddressFields, { type CountryOption } from './GuestAddressFields.vue';

/**
 * E-mail, invoice address and an optional second address for a shopper without an account.
 * The page asks `collect()` when the shopper pays: it returns the validated details, or null after
 * marking every missing field. Nothing is stored here — the checkout keeps the details in memory.
 */
const props = defineProps<{
  countries: CountryOption[];
  defaultCountryId: string;
  initial?: GuestDetails | null;
}>();

const { t } = useI18n();
const form = reactive<GuestForm>(emptyGuestForm(props.defaultCountryId));
const errors = ref<Record<string, string>>({});

// a shopper who comes back to this page (e.g. from the login page) finds the form as they left it
if (props.initial) {
  form.email = props.initial.email;
  Object.assign(form.invoice, { salutation: '', ...props.initial.invoiceAddress });
  if (props.initial.deliveryAddress) {
    form.deliverElsewhere = true;
    Object.assign(form.delivery, { salutation: '', ...props.initial.deliveryAddress });
  }
}

function collect(): GuestDetails | null {
  const result = validateGuestForm(form);
  errors.value = result.errors;
  return result.details;
}

defineExpose({ collect });
</script>

<template>
  <form class="guest-form" data-testid="guest-form" novalidate @submit.prevent>
    <label>
      {{ t('checkout.guest.email') }}
      <input
        v-model="form.email"
        name="email"
        type="email"
        autocomplete="email"
        class="form-control"
        :aria-invalid="errors.email ? 'true' : undefined"
        data-testid="guest-email"
      />
      <span v-if="errors.email" class="field-error" role="alert">{{ t(errors.email) }}</span>
    </label>

    <h3>{{ t('checkout.guest.invoiceAddress') }}</h3>
    <GuestAddressFields
      v-model="form.invoice"
      path="invoice"
      :errors="errors"
      :countries="countries"
    />

    <label class="toggle">
      <input
        v-model="form.deliverElsewhere"
        type="checkbox"
        data-testid="guest-deliver-elsewhere"
      />
      {{ t('checkout.guest.deliverElsewhere') }}
    </label>
    <template v-if="form.deliverElsewhere">
      <h3>{{ t('checkout.guest.deliveryAddress') }}</h3>
      <GuestAddressFields
        v-model="form.delivery"
        path="delivery"
        :errors="errors"
        :countries="countries"
        data-testid="guest-delivery-fields"
      />
    </template>
  </form>
</template>

<style scoped>
.guest-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.toggle {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.form-control {
  min-height: 44px;
  padding: 8px;
  box-sizing: border-box;
  width: 100%;
}
.field-error {
  color: var(--oxfe-color-danger, #b00020);
  font-size: 0.85em;
}
</style>
