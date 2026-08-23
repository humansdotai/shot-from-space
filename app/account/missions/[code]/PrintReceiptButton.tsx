'use client';

import { Button } from '@/components/fui';

/**
 * Hands the receipt to the browser's print pipeline. The print stylesheet on
 * the page strips the interface and lays the document out for paper, so this
 * is the whole control.
 */
export function PrintReceiptButton({ className }: { className?: string }) {
  return (
    <Button type="button" variant="secondary" size="lg" onClick={() => window.print()} className={className}>
      Print receipt
    </Button>
  );
}
