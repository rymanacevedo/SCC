import { type EffectCallback, useEffect } from 'react';

export default function useEffectOnce(cb: EffectCallback) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs the callback once on mount by design
  useEffect(cb, []);
}
