import { createBrowserRouter, Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout';
import { HomePage } from '@/routes/home';

export const router = createBrowserRouter([
  {
    element: (
      <MainLayout>
        <Outlet />
      </MainLayout>
    ),
    children: [
      { path: '/', element: <HomePage /> },
    ],
  },
]);
