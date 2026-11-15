// packages/ai-ui/src/lib/types.ts
export type WithClassName<P> = Omit<P, "className"> & { className?: string };
