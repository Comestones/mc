import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  // 1. jsdom 下补齐 innerText 读写（jsdom 默认未实现 innerText）
  if (window.HTMLElement) {
    Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
      get() {
        return this.textContent ?? '';
      },
      set(value: string) {
        this.textContent = value;
      },
      configurable: true,
    });
  }

  // 2. jsdom 下补齐 Range 矩形方法
  if (!window.Range.prototype.getClientRects) {
    window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
  if (!window.Range.prototype.getBoundingClientRect) {
    window.Range.prototype.getBoundingClientRect = () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  }
}
