// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppModalShell from '../AppModalShell.vue';

describe('AppModalShell.vue', () => {
    beforeEach(() => {
        // HTMLDialogElement の showModal と close をモック化（未実装環境対策）
        if (!HTMLDialogElement.prototype.showModal) {
            HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
                this.setAttribute('open', '');
            });
        } else {
            vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
                this.setAttribute('open', '');
            });
        }

        if (!HTMLDialogElement.prototype.close) {
            HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
                this.removeAttribute('open');
            });
        } else {
            vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
                this.removeAttribute('open');
            });
        }
    });

    it('visibleがtrueのときにshowModalが呼び出されること', async () => {
        const wrapper = mount(AppModalShell, {
            props: {
                visible: true
            }
        });

        await wrapper.vm.$nextTick();
        const dialog = wrapper.find('dialog').element as HTMLDialogElement;
        expect(dialog.showModal).toHaveBeenCalled();
    });

    it('visibleがfalseに変化したときにcloseが呼び出されフォーカスが復帰すること', async () => {
        // フォーカス対象のダミーボタンを DOM に作成
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        expect(document.activeElement).toBe(button);

        const wrapper = mount(AppModalShell, {
            props: {
                visible: true
            },
            attachTo: document.body
        });

        await wrapper.vm.$nextTick();

        // visible を false に変更
        await wrapper.setProps({ visible: false });
        await wrapper.vm.$nextTick();

        const dialog = wrapper.find('dialog').element as HTMLDialogElement;
        expect(dialog.close).toHaveBeenCalled();
        expect(document.activeElement).toBe(button);

        wrapper.unmount();
        document.body.removeChild(button);
    });

    it('cancelイベントが発生したときにcancelおよびcloseがemitされること', async () => {
        const wrapper = mount(AppModalShell, {
            props: {
                visible: true
            }
        });

        await wrapper.vm.$nextTick();

        const dialog = wrapper.find('dialog');
        await dialog.trigger('cancel');

        expect(wrapper.emitted('cancel')).toBeTruthy();
        expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('closeDisabledがtrueのときにcancelイベントが発生してもemitされないこと', async () => {
        const wrapper = mount(AppModalShell, {
            props: {
                visible: true,
                closeDisabled: true
            }
        });

        await wrapper.vm.$nextTick();

        const dialog = wrapper.find('dialog');
        await dialog.trigger('cancel');

        expect(wrapper.emitted('cancel')).toBeFalsy();
        expect(wrapper.emitted('close')).toBeFalsy();
    });

    it('backdropプロパティに応じて適切なクラスが付与されること', () => {
        const wrapperLight = mount(AppModalShell, {
            props: {
                backdrop: 'light'
            }
        });
        expect(wrapperLight.find('dialog').classes()).toContain('backdrop-light');

        const wrapperDark = mount(AppModalShell, {
            props: {
                backdrop: 'dark'
            }
        });
        expect(wrapperDark.find('dialog').classes()).toContain('backdrop-dark');
    });

    it('寸法プロパティ（width, height, maxWidth, maxHeight）がstyleに反映されること', () => {
        const wrapper = mount(AppModalShell, {
            props: {
                width: '600px',
                height: '400px',
                maxWidth: '80%',
                maxHeight: '70vh'
            }
        });

        const dialog = wrapper.find('dialog');
        const style = dialog.attributes('style') || '';
        expect(style).toContain('width: 600px');
        expect(style).toContain('height: 400px');
        expect(style).toContain('max-width: 80%');
        expect(style).toContain('max-height: 70vh');
    });

    it('titleIdが指定された場合にaria-labelledbyが正しく設定されること', () => {
        const wrapperWithTitle = mount(AppModalShell, {
            props: {
                titleId: 'test-modal-title'
            }
        });
        expect(wrapperWithTitle.find('dialog').attributes('aria-labelledby')).toBe('test-modal-title');

        const wrapperWithoutTitle = mount(AppModalShell);
        expect(wrapperWithoutTitle.find('dialog').attributes('aria-labelledby')).toBeUndefined();
    });

    it('visibleがfalseの場合にopen属性を持たず閉じた状態であること', async () => {
        const wrapper = mount(AppModalShell, {
            props: {
                visible: false
            }
        });
        await wrapper.vm.$nextTick();
        const dialog = wrapper.find('dialog').element as HTMLDialogElement;
        expect(dialog.hasAttribute('open')).toBe(false);
        expect(wrapper.find('dialog').attributes('open')).toBeUndefined();
    });

    it('mobilePaddingプロパティが指定された場合に--mobile-paddingがstyleに反映されること', () => {
        const wrapper = mount(AppModalShell, {
            props: {
                mobilePadding: '8px 12px 24px'
            }
        });

        const dialog = wrapper.find('dialog');
        const style = dialog.attributes('style') || '';
        expect(style).toContain('--mobile-padding: 8px 12px 24px');
    });

    it('mobileFullscreenプロパティに応じてクラスが付与され閉状態を壊さないこと', async () => {
        const wrapper = mount(AppModalShell, {
            props: {
                visible: false,
                mobileFullscreen: true
            }
        });
        await wrapper.vm.$nextTick();
        const dialog = wrapper.find('dialog');
        expect(dialog.classes()).toContain('mobile-fullscreen');
        expect((dialog.element as HTMLDialogElement).hasAttribute('open')).toBe(false);
    });
});
