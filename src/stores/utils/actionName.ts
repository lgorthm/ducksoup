/**
 * Action 名称辅助工具
 *
 * 用于自动生成 Redux DevTools 中显示的 action 名称
 * 格式：`{domain}/{action}/{status}`
 */
export function createActionName(
  domain: string,
  fn: (...args: never[]) => unknown,
) {
  return (suffix?: string) => {
    const base = `${domain}/${fn.name}`;
    return suffix ? `${base}/${suffix}` : base;
  };
}
