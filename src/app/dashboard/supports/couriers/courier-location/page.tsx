'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const CourierLocationClient = dynamic(
  () => import('./CourierLocationClient'),
  { ssr: false }
);

export default function CourierLocationPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <CourierLocationClient />
    </Suspense>
  );
}
