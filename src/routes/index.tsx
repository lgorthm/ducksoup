import { createBrowserRouter } from 'react-router';

import App from '@/App';
import { MainLayout } from '@/shared/components/layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <MainLayout>
        <App />
      </MainLayout>
    ),
  },
]);
