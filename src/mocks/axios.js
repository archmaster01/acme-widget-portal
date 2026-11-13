const recentEventsStore = [
    { id: 'ev-1', domain: 'bistro-central.example.com', event_type: 'widget_opened', time_ago: 'hace 1m' },
    { id: 'ev-2', domain: 'clinica-dental.example.com', event_type: 'demo_completed', time_ago: 'hace 4m' },
    { id: 'ev-3', domain: 'example.com', event_type: 'fast_pass_initiated', time_ago: 'hace 9m' }
];

export const recordLocalTelemetry = (event) => {
    recentEventsStore.unshift({
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        domain: event.domain || 'example.com',
        event_type: event.event_type,
        details: event.details || {},
        time_ago: 'ahora mismo'
    });
};

const buildSystemUsagePayload = (days = '7', scope = 'native') => {
    const multiplier = days === '7' ? 1 : days === '30' ? 3 : 6;
    const scopeBoost = scope === 'all' ? 2 : 1;
    const f = multiplier * scopeBoost;

    return {
        scope,
        days,
        cards: [
            {
                key: 'overview',
                title: 'Tráfico & Visitas',
                badge: `${days}D`,
                theme: 'emerald',
                primary: { value: 1240 * f, label: 'hits', color: 'text-emerald-400' },
                items: [
                    { value: 890 * f, label: 'únicos', color: 'text-white' },
                    { value: '71%', label: 'retención', color: 'text-emerald-400' }
                ]
            },
            {
                key: 'widget',
                title: 'Interacción Widget',
                badge: 'IA Activa',
                theme: 'purple',
                primary: { value: 420 * f, label: 'aperturas', color: 'text-purple-400' },
                items: [
                    { value: 310 * f, label: 'mensajes', color: 'text-white' },
                    { value: '34%', label: 'CTR', color: 'text-purple-400' }
                ]
            },
            {
                key: 'demos',
                title: 'Simulador Demo',
                badge: 'Fast-Pass',
                theme: 'cyan',
                primary: { value: 185 * f, label: 'iniciadas', color: 'text-cyan-400' },
                items: [
                    { value: 94 * f, label: 'completas', color: 'text-emerald-400' },
                    { value: '51%', label: 'conv.', color: 'text-cyan-400' }
                ]
            },
            {
                key: 'leads',
                title: 'Intención Comercial',
                badge: 'Embudo',
                theme: 'amber',
                primary: { value: 49 * f, label: 'precios', color: 'text-amber-400' },
                items: [
                    { value: 31 * f, label: 'instalación', color: 'text-blue-400' },
                    { value: 19 * f, label: 'leads', color: 'text-emerald-400' }
                ]
            }
        ],
        timeline: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            charts: {
                overview: {
                    title: 'Embudo General de Conversión',
                    colors: ['#10b981', '#a855f7', '#06b6d4', '#f59e0b'],
                    series: [
                        { name: 'Hits / Tráfico', data: [150, 180, 170, 210, 190, 160, 180].map(n => n * f) },
                        { name: 'Aperturas Widget', data: [55, 60, 58, 72, 65, 50, 60].map(n => n * f) },
                        { name: 'Demos Iniciadas', data: [20, 25, 22, 35, 30, 25, 28].map(n => n * f) },
                        { name: 'Demos Completadas', data: [10, 12, 11, 18, 15, 13, 15].map(n => n * f) }
                    ]
                },
                widget: {
                    title: 'Actividad del Widget IA',
                    colors: ['#a855f7', '#3b82f6'],
                    series: [
                        { name: 'Aperturas Widget', data: [55, 60, 58, 72, 65, 50, 60].map(n => n * f) },
                        { name: 'Mensajes Enviados', data: [40, 48, 42, 55, 50, 38, 37].map(n => n * f) }
                    ]
                },
                demos: {
                    title: 'Rendimiento de Demos & Fast-Pass',
                    colors: ['#06b6d4', '#10b981'],
                    series: [
                        { name: 'Demos Iniciadas', data: [20, 25, 22, 35, 30, 25, 28].map(n => n * f) },
                        { name: 'Demos Completadas', data: [10, 12, 11, 18, 15, 13, 15].map(n => n * f) }
                    ]
                },
                leads: {
                    title: 'Clics de Conversión Comercial',
                    colors: ['#f59e0b', '#10b981'],
                    series: [
                        { name: 'Clics en Precios', data: [6, 8, 5, 9, 7, 7, 7].map(n => n * f) },
                        { name: 'Leads Precalificados', data: [2, 3, 2, 4, 3, 2, 3].map(n => n * f) }
                    ]
                }
            }
        },
        recent_events: [...recentEventsStore]
    };
};

const axiosMock = {
    defaults: {
        withCredentials: true,
        headers: { common: {} }
    },
    get: async (url, config = {}) => {
        if (url.includes('/reports/system-usage')) {
            const days = config?.params?.days || '7';
            const scope = config?.params?.scope || 'native';
            return { data: buildSystemUsagePayload(days, scope) };
        }
        if (url.includes('/api/widget-config/')) {
            const slug = decodeURIComponent(url.split('/api/widget-config/')[1] || 'acmeai');
            if (slug === 'inactive-client') {
                return { data: { active: false } };
            }
            return {
                data: {
                    active: true,
                    config: {
                        business_name: slug === 'acmeai' ? 'AcmeAI' : `Negocio ${slug}`,
                        brand_color: '#10B981',
                        greeting: '¡Hola! Soy el asistente de AcmeAI. ¿En qué te puedo ayudar hoy?',
                        position: 'down-right',
                        widget_mode: 'dark',
                        demo_limit: 3
                    }
                }
            };
        }
        if (url.includes('/api/widget-status/')) {
            return { data: { ready: true } };
        }
        return { data: {} };
    },
    post: async (url, payload = {}) => {
        if (url.includes('/api/fast-pass')) {
            const target = payload.url || 'https://example.com';
            if (target.includes('invalid-domain')) {
                const err = new Error('Unreachable URL');
                err.response = { status: 422, data: { error: 'No pudimos conectar con ese dominio.' } };
                throw err;
            }
            return {
                data: {
                    success: true,
                    context: `Contexto sintético para ${target}: Horario L-V 9:00 a 18:00, Teléfono 555-0199.`,
                    demo_limit: 3,
                    brand_color: '#8b5cf6'
                }
            };
        }
        if (url.includes('/api/chat/')) {
            const msg = payload.message || '';
            if (payload.is_last_demo_turn) {
                return {
                    data: {
                        response: `Respuesta demo para "${msg}". Contáctanos al 555-0199.[FIN_DEMO]¡Excelente! Has completado la demostración. ¿Qué te gustaría conocer ahora?`,
                        goals: { demo_completed: true },
                        inputs: { test_question: msg }
                    }
                };
            }
            return {
                data: {
                    response: `Respuesta simulada de IA para: "${msg}"`,
                    goals: {},
                    inputs: {}
                }
            };
        }
        return { data: { success: true } };
    }
};

export default axiosMock;
