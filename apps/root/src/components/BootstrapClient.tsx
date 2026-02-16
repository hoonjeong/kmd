'use client';

import { useEffect } from 'react';

export function BootstrapClient() {
  useEffect(() => {
    // Load Bootstrap JS on the client side
    import('bootstrap/dist/js/bootstrap.bundle.min.js' as any);
  }, []);
  return null;
}
