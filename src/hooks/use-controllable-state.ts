// packages/ai-ui/src/hooks/use-controllable-state.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseControllableStateOptions<T> {
  value: T | undefined;
  defaultValue: T;
  onChange?: ((value: T) => void) | undefined;
}

/** State that is controlled when `value` is defined. The setter stays stable across renders. */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>): [T, (next: T) => void, boolean] {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const setValue = useCallback(
    (next: T) => {
      if (!controlled) setInternal(next);
      onChangeRef.current?.(next);
    },
    [controlled],
  );

  return [controlled ? value : internal, setValue, controlled];
}
