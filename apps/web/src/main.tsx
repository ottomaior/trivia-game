import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
// Fonts are bundled (latin + latin-ext for ő and ű), so the TV needs no third-party requests.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-ext-400.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-ext-600.css';
import '@fontsource/archivo/latin-800.css';
import '@fontsource/archivo/latin-ext-800.css';
import '@fontsource/shrikhand/latin-400.css';
import '@fontsource/shrikhand/latin-ext-400.css';
import './ui/tokens.css';

// Separate chunks: phones never download the TV screens and vice versa.
const TvApp = lazy(() => import('./tv/TvApp.tsx').then((m) => ({ default: m.TvApp })));
const PhoneApp = lazy(() => import('./phone/PhoneApp.tsx').then((m) => ({ default: m.PhoneApp })));

const router = createBrowserRouter([
  { path: '/tv', element: <TvApp /> },
  { path: '/:code?', element: <PhoneApp /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
);
