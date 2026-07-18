import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

/**
 * 暴露给外部组件的虚拟列表控制器，用于滚动导航栏联动。
 */
export interface ChatListController {
  /** 滚动容器元素，供外部监听 scroll 事件 */
  readonly scrollContainer: HTMLDivElement | null;
  /** 滚动到指定虚拟索引 */
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  /** 获取当前可见虚拟项的索引范围 [startIndex, endIndex] */
  getVisibleRange: () => [number, number] | null;
}

interface UseChatListControllerOptions {
  /** 滚动容器 ref */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** 虚拟列表实例 */
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  /** 外部传入的 ref，组件挂载后会填充控制器实例 */
  controllerRef?: RefObject<ChatListController | null>;
}

/**
 * 虚拟列表控制器填充：
 * - 将 virtualizer 的能力以 ChatListController 接口形式回填到外部传入的 controllerRef，
 *   供兄弟组件（如滚动导航栏）通过 ref 访问，避免兄弟组件间的直接依赖。
 *
 * 复用场景：分栏导航、小地图、目录联动等需要把虚拟列表控制能力暴露给外部组件的场景。
 */
export function useChatListController({
  scrollContainerRef,
  virtualizer,
  controllerRef,
}: UseChatListControllerOptions) {
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      scrollContainer: scrollContainerRef.current,
      scrollToIndex: (index, align = 'center') => {
        virtualizer.scrollToIndex(index, { align });
      },
      getVisibleRange: () => {
        const indexes = virtualizer.getVirtualIndexes();
        if (indexes.length === 0) return null;
        return [indexes[0], indexes[indexes.length - 1]] as [number, number];
      },
    };
  }, [virtualizer, controllerRef, scrollContainerRef]);
}
