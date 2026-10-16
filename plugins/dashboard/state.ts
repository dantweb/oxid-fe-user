import type { GraphqlClient } from '@dantweb/oxid-fe-core';
import { ref } from 'vue';
import { loadAccountSummary, type AccountSummary } from './api/summary';

/** The signed-in customer's account summary, shared by the menu and the dashboard cards. */
export const summary = ref<AccountSummary | null>(null);

export async function refreshSummary(client: GraphqlClient): Promise<void> {
  summary.value = await loadAccountSummary(client);
}

/** Called on sign-in / sign-out: one customer's numbers must never show for the next one. */
export function clearSummary(): void {
  summary.value = null;
}
