import { defineCustomElement } from 'vue';
import ChatWidget from './Components/ChatWidget.ce.vue';

const ChatWidgetElement = defineCustomElement(ChatWidget);

let isInitialized = false;

export const initWidget = () => {
    if (isInitialized) return;
    isInitialized = true;

    if (typeof customElements !== 'undefined' && !customElements.get('acmeai-widget')) {
        customElements.define('acmeai-widget', ChatWidgetElement);
    }

    if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', initWidget);
        window.removeEventListener('mousemove', initWidget);
        window.removeEventListener('touchstart', initWidget);
        window.removeEventListener('keydown', initWidget);
    }
};

if (typeof window !== 'undefined') {
    const isDirectWidgetRoute = window.location.pathname.startsWith('/demo/')
        || window.location.pathname.startsWith('/chat/');

    if (isDirectWidgetRoute) {
        initWidget();
    } else {
        window.addEventListener('scroll', initWidget, { once: true, passive: true });
        window.addEventListener('mousemove', initWidget, { once: true, passive: true });
        window.addEventListener('touchstart', initWidget, { once: true, passive: true });
        window.addEventListener('keydown', initWidget, { once: true, passive: true });
        setTimeout(initWidget, 1500);
    }
}
