<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GuestAddressForm } from '../guest';

export interface CountryOption {
  id: string;
  title: string;
}

/**
 * One address of the guest form. `path` is `invoice` or `delivery`: it prefixes the field paths of
 * `errors` (`invoice.city`) and the input names (`city` / `deliveryCity`), so both blocks can sit
 * on one page.
 */
const props = defineProps<{
  path: 'invoice' | 'delivery';
  errors: Record<string, string>;
  countries: CountryOption[];
}>();

/** edited in place: the form owns the object, the inputs write into it */
const address = defineModel<GuestAddressForm>({ required: true });

const { t } = useI18n();

const FIELDS = ['firstName', 'lastName', 'street', 'streetNumber', 'zipCode', 'city'] as const;

function nameOf(field: string): string {
  return props.path === 'invoice'
    ? field
    : `delivery${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}
const errorOf = (field: string): string | undefined => props.errors[`${props.path}.${field}`];
</script>

<template>
  <div class="address-fields">
    <label>
      {{ t('checkout.guest.salutation.label') }}
      <select v-model="address.salutation" :name="nameOf('salutation')" class="form-control">
        <option value="MR">{{ t('checkout.guest.salutation.MR') }}</option>
        <option value="MRS">{{ t('checkout.guest.salutation.MRS') }}</option>
      </select>
    </label>
    <label v-for="field in FIELDS" :key="field">
      {{ t(`checkout.address.${field}`) }}
      <input
        v-model="address[field]"
        :name="nameOf(field)"
        class="form-control"
        :aria-invalid="errorOf(field) ? 'true' : undefined"
        :data-testid="`guest-${nameOf(field)}`"
      />
      <span v-if="errorOf(field)" class="field-error" role="alert">{{ t(errorOf(field)!) }}</span>
    </label>
    <label>
      {{ t('checkout.address.country') }}
      <select v-model="address.countryId" :name="nameOf('countryId')" class="form-control">
        <option v-for="country in countries" :key="country.id" :value="country.id">
          {{ country.title }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.address-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
