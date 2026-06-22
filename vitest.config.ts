import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/mocks/**',
          'src/tests/**',
          'src/main.tsx',
          'src/**/*.d.ts',
          // shadcn UI 组件（第三方 vendored，不纳入业务覆盖率）
          'src/shared/components/ui/**',
          // 类型定义文件（无可执行逻辑）
          'src/features/chat/types/**',
          'src/shared/types/**',
          // prism 语法高亮（第三方库封装）
          'src/shared/lib/prism*.ts',
          // markdown 渲染器（重度依赖 lazy loading，E2E 覆盖）
          'src/shared/components/markdown-renderer.tsx',
          // 路由配置（纯声明式）
          'src/routes/**',
        ],
        thresholds: {
          statements: 75,
          branches: 65,
          functions: 70,
          lines: 75,
        },
      },
      server: {
        deps: {
          inline: ['fake-indexeddb'],
        },
      },
    },
  }),
);
