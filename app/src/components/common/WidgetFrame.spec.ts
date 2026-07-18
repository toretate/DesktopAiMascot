// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import WidgetFrame from './WidgetFrame.vue';

describe('WidgetFrame', () => {
    it('デフォルトのスロット内容をレンダリングすること', () => {
        const wrapper = mount(WidgetFrame, {
            slots: {
                default: '<div class="test-content">Test</div>'
            }
        });
        expect(wrapper.find('.test-content').exists()).toBe(true);
    });

    it('showHandlesがtrueの場合、リサイズハンドルを表示すること', () => {
        const wrapper = mount(WidgetFrame, {
            props: {
                showHandles: true
            }
        });
        expect(wrapper.find('.resize-handle.right').exists()).toBe(true);
        expect(wrapper.find('.resize-handle.bottom').exists()).toBe(true);
        expect(wrapper.find('.resize-handle.corner').exists()).toBe(true);
    });

    it('リサイズハンドルをクリックしたとき、init-resizeイベントを発火すること', async () => {
        const wrapper = mount(WidgetFrame, {
            props: {
                showHandles: true
            }
        });

        await wrapper.find('.resize-handle.right').trigger('mousedown');
        expect(wrapper.emitted('init-resize')).toBeTruthy();
        expect(wrapper.emitted('init-resize')?.[0][1]).toBe('right');
    });

    it('tagプロパティで指定された要素でレンダリングすること', () => {
        const wrapper = mount(WidgetFrame, {
            props: {
                tag: 'section'
            }
        });
        expect(wrapper.element.tagName).toBe('SECTION');
    });

    it('class、style、およびDOM属性がルート要素に継承されること', () => {
        const wrapper = mount(WidgetFrame, {
            attrs: {
                class: 'custom-class-name',
                style: 'display: flex; opacity: 0.8;',
                id: 'my-widget-frame',
                'data-testid': 'widget-frame-test',
                'aria-label': 'Widget Frame'
            }
        });
        const element = wrapper.element as HTMLElement;
        expect(element.classList.contains('custom-class-name')).toBe(true);
        expect(element.style.display).toBe('flex');
        expect(element.style.opacity).toBe('0.8');
        expect(element.getAttribute('id')).toBe('my-widget-frame');
        expect(element.getAttribute('data-testid')).toBe('widget-frame-test');
        expect(element.getAttribute('aria-label')).toBe('Widget Frame');
    });
});
