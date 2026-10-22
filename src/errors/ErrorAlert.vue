<script setup lang="ts">
import { errorCodeOf, providerCodeOf, GraphqlError } from '@dantweb/oxid-fe-core';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { instanceKey } from '../core';
import { useErrorMessage } from './useErrorMessage';

/**
 * One failure, shown the same way everywhere. A STRING is a message the view already translated
 * (client-side validation); anything else is a thrown cause and is mapped by its error code. The
 * raw message only appears in the collapsible details block of an instance with `debug.errors`.
 */
const props = defineProps<{
  error: unknown;
  /** the view's own i18n key for "something else went wrong" (default: the generic text) */
  fallback?: string;
  /** i18n key of a sentence with `{message}` that wraps the mapped text (`checkout.errors.start`) */
  wrap?: string;
}>();

const { t } = useI18n();
const messageOf = useErrorMessage();
const debug = inject(instanceKey, null)?.debug.errors === true;

const text = computed(() => {
  if (typeof props.error === 'string') {
    return props.error;
  }
  const mapped = messageOf(props.error, props.fallback);
  return props.wrap ? t(props.wrap, { message: mapped }) : mapped;
});

const details = computed(() => {
  if (!debug || typeof props.error === 'string') {
    return null;
  }
  const raw = props.error instanceof Error ? props.error.message : String(props.error);
  const code = errorCodeOf(props.error) ?? (props.error instanceof GraphqlError ? 'unknown' : '-');
  return { code, providerCode: providerCodeOf(props.error), raw };
});
</script>

<template>
  <div role="alert">
    <span>{{ text }}</span>
    <details v-if="details" class="error-details" data-testid="error-details">
      <summary>{{ t('errors.details') }}</summary>
      <p>
        code: {{ details.code
        }}<template v-if="details.providerCode"> / {{ details.providerCode }}</template>
      </p>
      <pre>{{ details.raw }}</pre>
    </details>
  </div>
</template>
