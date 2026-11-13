import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Dashboard from '../src/Pages/Dashboard.vue';
import ChatWidget from '../src/Components/ChatWidget.ce.vue';

describe('Dashboard and ChatWidget integration', () => {
  it('renders Dashboard.vue with StatCard metrics and switches scopes offline', async () => {
    const wrapper = mount(Dashboard);
    await flushPromises();

    expect(wrapper.text()).toContain('Centro de Mando Global');
    expect(wrapper.text()).toContain('Tráfico & Visitas');

    const demosBtn = wrapper.findAll('button').find(b => b.text().includes('Demos (/demo)'));
    await demosBtn.trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="apexcharts-mock"]').exists()).toBe(true);
  });

  it('mounts ChatWidget.ce.vue, opens chat, triggers Fast-Pass URL flow, and records local telemetry', async () => {
    const wrapper = mount(ChatWidget, {
      props: {
        prospect: { slug: 'acmeai', name: 'AcmeAI', brand_color: '#10B981', whatsapp_number: '5550199' },
        displayMode: 'floating'
      }
    });
    await flushPromises();

    const openBtn = wrapper.findAll('button').find(b => b.text().includes('Preguntar a la IA'));
    await openBtn.trigger('click');
    expect(localStorage.getItem('acme_uuid')).toBeTruthy();

    const textarea = wrapper.find('textarea');
    await textarea.setValue('mi-restaurante.example.com');
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: false });
    await flushPromises();

    expect(wrapper.text()).toContain('Modo Demo');
    expect(wrapper.text()).toContain('3 preguntas disponibles');
  });
});
