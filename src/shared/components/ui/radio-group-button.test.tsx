import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroupButton } from './radio-group-button';

const OPTIONS = [
  { label: '选项A', value: 'a' },
  { label: '选项B', value: 'b' },
  { label: '选项C', value: 'c' },
];

describe('RadioGroupButton', () => {
  it('渲染所有选项', () => {
    render(<RadioGroupButton options={OPTIONS} />);
    expect(screen.getByText('选项A')).toBeInTheDocument();
    expect(screen.getByText('选项B')).toBeInTheDocument();
    expect(screen.getByText('选项C')).toBeInTheDocument();
  });

  it('点击选项调用 onValueChange', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupButton options={OPTIONS} onValueChange={onValueChange} />,
    );
    fireEvent.click(screen.getByText('选项B'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('受控模式使用 value prop', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupButton
        options={OPTIONS}
        value="c"
        onValueChange={onValueChange}
      />,
    );
    // 点击其他选项仍调用 onValueChange
    fireEvent.click(screen.getByText('选项A'));
    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('非受控模式使用内部状态', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupButton options={OPTIONS} onValueChange={onValueChange} />,
    );
    // 初始无选中，点击后触发回调
    fireEvent.click(screen.getByText('选项C'));
    expect(onValueChange).toHaveBeenCalledWith('c');
  });

  it('defaultValue 设置初始选中', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupButton
        options={OPTIONS}
        defaultValue="b"
        onValueChange={onValueChange}
      />,
    );
    // 点击另一个选项
    fireEvent.click(screen.getByText('选项A'));
    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('无 defaultValue 时默认选第一个', () => {
    render(<RadioGroupButton options={OPTIONS} />);
    // ring 元素应该可见（opacity: 1）
    const ring = document.querySelector('.border-amber-400');
    expect(ring).toBeInTheDocument();
    expect(ring).toHaveStyle({ opacity: '1' });
  });

  it('切换选项时 ring 移动', () => {
    const { rerender } = render(
      <RadioGroupButton options={OPTIONS} value="a" />,
    );
    const ring = document.querySelector('.border-amber-400');
    expect(ring).toHaveStyle({ opacity: '1' });

    // 切换到 b
    rerender(<RadioGroupButton options={OPTIONS} value="b" />);
    expect(ring).toHaveStyle({ opacity: '1' });
  });

  it('选项 button 有 data-value 属性', () => {
    render(<RadioGroupButton options={OPTIONS} value="a" />);
    const btnA = screen.getByText('选项A').closest('button');
    expect(btnA).toHaveAttribute('data-value', 'a');
    const btnB = screen.getByText('选项B').closest('button');
    expect(btnB).toHaveAttribute('data-value', 'b');
  });

  it('空选项列表不崩溃', () => {
    render(<RadioGroupButton options={[]} />);
    // 不应崩溃，ring 不可见
    const ring = document.querySelector('.border-amber-400');
    expect(ring).toHaveStyle({ opacity: '0' });
  });

  it('单个选项正常渲染', () => {
    render(
      <RadioGroupButton
        options={[{ label: '唯一', value: 'only' }]}
        value="only"
      />,
    );
    expect(screen.getByText('唯一')).toBeInTheDocument();
  });
});
