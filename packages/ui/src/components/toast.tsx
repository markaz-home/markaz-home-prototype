'use client';
import { Toaster as SonnerToaster, toast } from 'sonner';

/** App-wide feedback/toast surface. Mount once near the root. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        classNames: {
          toast: 'rounded-md border bg-background text-foreground shadow-md',
        },
      }}
    />
  );
}

export { toast };
