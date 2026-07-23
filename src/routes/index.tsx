import { createBrowserRouter } from 'react-router';
import * as Sentry from '@sentry/react';

import { ChatLayout } from '@/features/chat/layouts/chat-layout';
import { ChatPage } from '@/features/chat/components/chat-page';

const sentryCreateBrowserRouter =
  Sentry.wrapCreateBrowserRouterV7(createBrowserRouter);

export const router = sentryCreateBrowserRouter([
  {
    element: <ChatLayout />,
    children: [{ path: '/', element: <ChatPage /> }],
  },
]);
