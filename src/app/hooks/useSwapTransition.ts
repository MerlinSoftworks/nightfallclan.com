import { useEffect, useState } from "react";

export type TransitionState<T> = {
  displayedValue: T;
  outgoingValue: T | null;
  isTransitioning: boolean;
  transitionKey: number;
};

/**
 * Tracks a value that swaps with an animation: when `value` changes, the previous one is kept as
 * `outgoingValue` for `durationMs` so it can be animated out while the new one animates in.
 */
export function useSwapTransition<T>(value: T, durationMs: number): TransitionState<T> {
  const [displayedValue, setDisplayedValue] = useState(value);
  const [outgoingValue, setOutgoingValue] = useState<T | null>(null);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    if (Object.is(value, displayedValue)) return;

    setOutgoingValue(displayedValue);
    setDisplayedValue(value);
    setTransitionKey((previousKey) => previousKey + 1);
    const timeoutId = window.setTimeout(() => {
      setOutgoingValue(null);
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, displayedValue, durationMs]);

  return {
    displayedValue,
    outgoingValue,
    isTransitioning: outgoingValue !== null,
    transitionKey,
  };
}
