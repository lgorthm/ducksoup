import { createBrowserRouter } from 'react-router';

import { ChatLayout } from '@/features/chat/layouts/chat-layout';
import { ChatPage } from '@/features/chat/components/chat-page';

export const router = createBrowserRouter([
  {
    element: <ChatLayout />,
    children: [{ path: '/', element: <ChatPage /> }],
  },
]);
