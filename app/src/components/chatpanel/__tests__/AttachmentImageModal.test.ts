// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AttachmentImageModal from '../AttachmentImageModal.vue';

describe('AttachmentImageModal', () => {
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
            this.setAttribute('open', '');
        });
        HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
            this.removeAttribute('open');
        });
    });

    it('画像をネイティブダイアログ内で代替テキスト付き表示すること', async () => {
        const wrapper = mount(AttachmentImageModal, {
            props: {
                url: 'data:image/png;base64,',
            },
            attachTo: document.body,
        });

        await wrapper.vm.$nextTick();
        expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe('attachment-image-title');
        expect(wrapper.get('img').attributes('alt')).toBe('添付画像の拡大表示');
        expect(wrapper.get('[aria-label="画像を閉じる"]').element.tagName).toBe('BUTTON');

        wrapper.unmount();
    });

    it('閉じるボタンからcloseイベントを通知すること', async () => {
        const wrapper = mount(AttachmentImageModal, {
            props: {
                url: 'data:image/png;base64,',
            },
        });

        await wrapper.get('[aria-label="画像を閉じる"]').trigger('click');
        expect(wrapper.emitted('close')).toBeTruthy();
    });
});
