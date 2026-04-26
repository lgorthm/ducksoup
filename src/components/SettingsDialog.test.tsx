import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SettingsDialog } from './SettingsDialog'

const STORAGE_KEY = 'ducksoup-deepseek-apikey'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SettingsDialog', () => {
  describe('trigger 按钮', () => {
    it('应渲染 Settings 按钮', () => {
      render(<SettingsDialog />)
      expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
    })
  })

  describe('打开对话框', () => {
    it('点击 Settings 按钮应打开对话框', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(
        screen.getByText('Configure your DeepSeek API key to enable AI-powered features.'),
      ).toBeTruthy()
    })

    it('打开对话框时应显示当前 API Key', () => {
      localStorage.setItem(STORAGE_KEY, 'sk-test-key-123')
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input.value).toBe('sk-test-key-123')
    })

    it('API Key 为空时输入框应为空', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('输入框行为', () => {
    it('默认应显示为密码类型', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input.type).toBe('password')
    })

    it('应能修改输入框的值', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'sk-typed-key' } })
      expect(input.value).toBe('sk-typed-key')
    })
  })

  describe('显示/隐藏 API Key', () => {
    it('点击眼睛图标应切换输入框类型', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input.type).toBe('password')

      fireEvent.click(screen.getByRole('button', { name: 'Show API key' }))
      expect(input.type).toBe('text')

      fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }))
      expect(input.type).toBe('password')
    })
  })

  describe('保存功能', () => {
    it('点击 Save 应保存 API Key 并关闭对话框', () => {
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'sk-saved-key' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(localStorage.getItem(STORAGE_KEY)).toBe('sk-saved-key')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('保存空值应清除 localStorage 中的 API Key', () => {
      localStorage.setItem(STORAGE_KEY, 'sk-old-key')
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(localStorage.getItem(STORAGE_KEY)).toBe('')
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  describe('关闭对话框', () => {
    it('点击关闭按钮应关闭对话框但不保存', () => {
      localStorage.setItem(STORAGE_KEY, 'sk-original')
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'sk-changed-no-save' } })

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      expect(localStorage.getItem(STORAGE_KEY)).toBe('sk-original')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('再次打开对话框应重置为保存的值', () => {
      render(<SettingsDialog />)

      // 第一次打开，输入值但不保存，然后关闭
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const input1 = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input1, { target: { value: 'sk-discarded' } })
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))

      // 再次打开，应显示为空（未保存）
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const input2 = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input2.value).toBe('')
    })

    it('保存后再次打开应显示已保存的值', () => {
      render(<SettingsDialog />)

      // 打开 → 输入 → 保存 → 关闭
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const input1 = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input1, { target: { value: 'sk-persisted' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      // 再次打开，应显示刚保存的值
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const input2 = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input2.value).toBe('sk-persisted')
    })
  })

  describe('异常处理', () => {
    it('localStorage.getItem 抛出异常时不崩溃', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('localStorage.setItem 抛出异常时仍能更新状态且不崩溃', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error')
      })

      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      const input = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'sk-error-key' } })

      expect(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      }).not.toThrow()

      // 对话框应关闭，即使持久化失败
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
