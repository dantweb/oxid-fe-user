import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** Below this width the header collapses: menu and search move behind buttons. */
const COMPACT_QUERY = '(max-width: 899px)';

export function useCompact(): Ref<boolean> {
  const compact = ref(typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches);
  let query: MediaQueryList | null = null;
  const update = (): void => {
    compact.value = query?.matches ?? false;
  };

  onMounted(() => {
    query = window.matchMedia(COMPACT_QUERY);
    update();
    query.addEventListener('change', update);
  });
  onBeforeUnmount(() => query?.removeEventListener('change', update));
  return compact;
}
