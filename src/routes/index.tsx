import { createBrowserRouter, Outlet } from 'react-router';

import { MainLayout } from '@/shared/components/layout';
import { ConversationList } from '@/features/chat/components/conversation-list';
import { HomePage } from '@/routes/home';

export const router = createBrowserRouter([
  {
    element: (
      <MainLayout sidebarContent={<ConversationList />}>
        <Outlet />
      </MainLayout>
    ),
    children: [
      { path: '/', element: <HomePage /> },
    ],
  },
]);
