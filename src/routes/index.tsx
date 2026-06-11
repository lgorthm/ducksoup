import { createBrowserRouter } from 'react-router';

import { LayoutWrapper } from '@/routes/layout-wrapper';
import { HomePage } from '@/routes/home';

export const router = createBrowserRouter([
  {
    element: <LayoutWrapper />,
    children: [{ path: '/', element: <HomePage /> }],
  },
]);
