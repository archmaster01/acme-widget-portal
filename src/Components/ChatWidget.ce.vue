<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { trackEvent } from '../utils/telemetry.js';

// Globally force cookies and identify as an AJAX request
axios.defaults.withCredentials = true;
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const props = defineProps({
    prospect: {
        type: [Object, String],
        default: () => ({})
    },
    displayMode: {
        type: String,
        default: 'floating' 
    }
});

const prospectData = computed(() => {
    if (typeof props.prospect === 'string') {
        try { return JSON.parse(props.prospect); } 
        catch (e) { return {}; }
    }
    return props.prospect || {};
});

// DOM & State Refs
const isOpen = ref(false);
const showTooltip = ref(false);
const messages = ref([]);
const isLoading = ref(false);
const isTraining = ref(false);
const newMessage = ref('');
const messagesArea = ref(null);
const chatInput = ref(null);
const demoQuestionsLeft = ref(3);
const demoQuestionsTotal = ref(3);

// Core Machine State
const widgetMode = ref('native');
const targetUrl = ref('');
const scrapedContext = ref('');

// Persistent Ledgers
const goals = ref({
    needs_identified: false,
    business_type_identified: false,
    business_size_identified: false,
    url_captured: false,
    demo_completed: false,
    offer_presented: false,
    whatsapp_sent: false,
    script_delivered: false
});

const inputs = ref({
    name: null,
    email: null,
    whatsapp: null,
    painpoint: null,
    business_type: null,
    business_size: null,
    url: null,
    test_question: null,
    platform: null
});

const widgetConfig = ref({
    slug: prospectData.value?.slug || 'acmeai',
    businessName: prospectData.value?.name || 'AcmeAI',
    brandColor: prospectData.value?.brand_color || '#10B981',
    greeting: 'Pregúntame lo que quieras...',
    whatsapp: prospectData.value?.whatsapp_number || '',
    position: 'down-right',
    theme: 'dark',
    isActive: true
});

const scrollToBottom = () => {
    nextTick(() => {
        if (messagesArea.value) {
            messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
        }
    });
};

const toggleChat = () => {
    if (!widgetConfig.value.isActive) return;
    const wasTooltipVisible = showTooltip.value;
    isOpen.value = !isOpen.value;

    if (isOpen.value) {
        showTooltip.value = false;
        trackEvent('widget_opened', { mode: widgetMode.value, is_proactive: wasTooltipVisible });
        scrollToBottom();
    } else {
        if (widgetMode.value === 'demo' || window.location.pathname.startsWith('/demo/')) {
            showTooltip.value = true;
        }
        trackEvent('widget_closed', { mode: widgetMode.value, message_count: messages.value.length });
    }
};

const sendMessage = async () => {
    if (isLoading.value || !newMessage.value.trim()) return;

    const userText = newMessage.value.trim();

    newMessage.value = '';
    if (chatInput.value) chatInput.value.style.height = 'auto';

    await nextTick();
    if (chatInput.value) chatInput.value.focus();

    const isLandingPage = ['acmeai', 'example.com', 'example.test', 'fast-pass'].includes(widgetConfig.value.slug);

    // --- INTERCEPTOR DE URL ---
    if (isLandingPage && widgetMode.value === 'native' && !targetUrl.value) {
        const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-zA-Z]{2,6}\b\S*/i;
        const match = userText.match(urlRegex);

        if (match && !userText.includes('@')) {
            messages.value.push({ role: 'user', text: userText, mode: widgetMode.value });
            scrollToBottom();
            startFastPass(match[0]); 
            return;
        }
    }

    // --- FLUJO ESTÁNDAR ---
    messages.value.push({ role: 'user', text: userText, mode: widgetMode.value });
    isLoading.value = true;
    scrollToBottom();

    if (widgetMode.value === 'demo' && demoQuestionsLeft.value > 0) {
        demoQuestionsLeft.value--;
    }

    try {
        const isAcmeHost = ['example.com', 'example.test', 'localhost', '127.0.0.1'].includes(window.location.hostname);
        const baseUrl = isAcmeHost ? window.location.origin : (import.meta.env.VITE_API_BASE_URL || 'https://example.com');
        let endpoint = `${baseUrl}/api/chat/${encodeURIComponent(widgetConfig.value.slug)}`;
        
        let payload = {
            message: userText,
            mode: widgetMode.value,
            history: messages.value.slice(0, -1),
            goals: goals.value,
            inputs: inputs.value,
            is_last_demo_turn: (widgetMode.value === 'demo' && demoQuestionsLeft.value === 0)
        };

        if (widgetMode.value === 'demo') {
            const cleanDomain = targetUrl.value.replace(/^https?:\/\//, '').replace(/\/$/, '');
            endpoint = `${baseUrl}/api/chat/${encodeURIComponent(cleanDomain)}`; 
            payload.context = scrapedContext.value;
        } else if (widgetMode.value === 'conversion') {
            endpoint = `${baseUrl}/api/chat/acmeai`; 
        }

        const response = await axios.post(endpoint, payload, { withCredentials: true });

        let aiText = response.data.response;
        
        if (typeof response.data === 'object' && response.data !== null) {
            trackEvent('message_sent', {
                mode: widgetMode.value,
                character_count: userText.length,
                message: userText.slice(0, 500),
                ai_response: (aiText || '').replace('[FIN_DEMO]', ' ').trim().slice(0, 800),
            });
            aiText = response.data.response || "No pude procesar la respuesta.";
            
            if (response.data.goals) {
                Object.keys(response.data.goals).forEach(key => {
                    if (response.data.goals[key] === true) goals.value[key] = true;
                });
            }
            if (response.data.inputs) {
                Object.keys(response.data.inputs).forEach(key => {
                    if (response.data.inputs[key] !== null && response.data.inputs[key] !== undefined) {
                        inputs.value[key] = response.data.inputs[key];
                    }
                });
            }
        }

        if (aiText.includes('[FIN_DEMO]')) {
            if (!goals.value.demo_completed) {
                trackEvent('demo_completed', { 
                    target_domain: targetUrl.value,
                    questions_asked: demoQuestionsTotal.value 
                });
            }
            goals.value.demo_completed = true;
        }

        if (goals.value.demo_completed) {
            widgetMode.value = 'conversion';
        } else if (goals.value.url_captured) {
            widgetMode.value = 'demo';
        } else {
            widgetMode.value = 'native';
        }

        if (aiText.includes('[FIN_DEMO]')) {
            const parts = aiText.split('[FIN_DEMO]');
            
            if (parts[0].trim()) {
                messages.value.push({ role: 'model', text: parts[0].trim(), mode: 'demo' });
            }
            
            messages.value.push({ role: 'separator', text: '✓ DEMOSTRACIÓN COMPLETADA', mode: 'native' });
            
            if (parts[1].trim()) {
                messages.value.push({ role: 'model', text: parts[1].trim(), mode: 'conversion' });
            }
        } else {
            messages.value.push({ role: 'model', text: aiText, mode: widgetMode.value });
        }

        if (response.data.training) {
            isTraining.value = true;
            
            const pollSlug = widgetMode.value === 'demo' && targetUrl.value 
                ? targetUrl.value.replace(/^https?:\/\//, '').replace(/\/$/, '') 
                : widgetConfig.value.slug;

            const checkStatus = setInterval(async () => {
                try {
                    const statusRes = await axios.get(`${baseUrl}/api/widget-status/${encodeURIComponent(pollSlug)}`, { withCredentials: true });
                    
                    if (statusRes.data.ready) {
                        isTraining.value = false;
                        clearInterval(checkStatus);
                        messages.value.push({
                            role: 'model',
                            text: '¡Memoria actualizada! Ya terminé de leer el sitio web. ¿Qué te gustaría saber?',
                            mode: widgetMode.value
                        });
                        scrollToBottom();
                        await nextTick();
                        if (chatInput.value) chatInput.value.focus();
                    }
                } catch (error) {
                    clearInterval(checkStatus);
                    isTraining.value = false;
                }
            }, 2000);
        }
    } catch (error) {
        messages.value.push({
            role: 'model',
            text: 'Error de conexión. Por favor, intenta de nuevo.',
            mode: widgetMode.value
        });
    } finally {
        isLoading.value = false;
        scrollToBottom();
        await nextTick();
        if (chatInput.value) chatInput.value.focus();
    }
};

const proactiveMessage = computed(() => {
    if (widgetMode.value === 'demo' || props.displayMode === 'fullscreen') {
        return `👋 Preparamos este agente para ${widgetConfig.value.businessName}.\nHazle una pregunta como si fueras uno de tus clientes.`;
    }

    const isLandingPage = ['acmeai', 'example.com', 'example.test', 'fast-pass'].includes(widgetConfig.value.slug);
    if (isLandingPage) {
        return '¡Hola! ¿Quieres ver cómo atendería a los visitantes de tu sitio web? Haz clic aquí y te hago una prueba en vivo.';
    }
    
    return widgetConfig.value.greeting || `¡Hola! Soy el asistente virtual de ${widgetConfig.value.businessName}. ¿En qué te puedo ayudar hoy?`;
});

const closedButtonText = computed(() => {
    return (widgetMode.value === 'demo' || props.displayMode === 'fullscreen')
        ? '✨ Probar mi agente'
        : 'Preguntar a la IA...';
});

const whatsappUrl = computed(() => {
    const defaultText = `Hola, me interesa agendar una cita. Vengo de su sitio web.`;
    return `https://wa.me/${widgetConfig.value.whatsapp}?text=${encodeURIComponent(defaultText)}`;
});

const suggestedPrompts = computed(() => {
    if (widgetMode.value !== 'demo') return [];
    return [
        '¿Dónde están ubicados?',
        '¿Qué servicios ofrecen?'
    ];
});

const sendSuggestedMessage = async (text, intent = null) => {
    if (intent) {
        trackEvent(`clicked_${intent}`, { 
            target_domain: targetUrl.value,
            mode: widgetMode.value 
        });
    } else if (widgetMode.value === 'demo') {
        trackEvent('demo_chip_clicked', { prompt: text });
    }

    newMessage.value = text;
    await sendMessage();
};

const triggerLiveDemo = () => {
    isOpen.value = true;
    showTooltip.value = false;
    messages.value = [{
        role: 'model',
        text: '¡Hola! Escribe la URL de tu negocio (ej. tuempresa.com) y te mostraré en vivo cómo atendería a tus clientes.',
        mode: widgetMode.value
    }];
    nextTick(() => {
        if (chatInput.value) chatInput.value.focus();
        scrollToBottom();
    });
};

const dynamicStyles = computed(() => {
    const isLight = widgetConfig.value.theme === 'light';
    return {
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(10, 15, 28, 0.88)',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.12)' : `${widgetConfig.value.brandColor}50`,
    };
});

const theme = computed(() => {
    const isLight = widgetConfig.value.theme === 'light';
    return {
        text: isLight ? 'text-slate-800' : 'text-slate-100',
        muted: isLight ? 'text-slate-500' : 'text-slate-400',
        border: isLight ? 'border-slate-200' : 'border-white/10',
        userBubbleNative: isLight
            ? 'bg-slate-900 text-white shadow-sm'
            : 'bg-white/10 border border-white/10 text-white shadow-sm',
        userBubbleDemo: 'bg-purple-600 text-white shadow-md', 
        aiBubbleDemo: isLight 
            ? 'bg-slate-100 border-slate-200 shadow-sm text-slate-800' 
            : 'bg-slate-800 border-purple-500/30 shadow-sm text-slate-100',
        input: isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-white/60',
        iconBtn: isLight
            ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60'
            : 'text-white/50 hover:text-white hover:bg-white/10'
    };
});

const headerStyles = computed(() => {
    const isLight = widgetConfig.value.theme === 'light';
    return {
        backgroundColor: isLight ? `${widgetConfig.value.brandColor}10` : `${widgetConfig.value.brandColor}20`,
        borderColor: isLight ? 'rgba(0, 0, 0, 0.05)' : `${widgetConfig.value.brandColor}40`,
    };
});

const startFastPass = async (url) => {
    targetUrl.value = url;
    widgetMode.value = 'loading';
    const cleanDomain = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    messages.value.push({
        role: 'model',
        text: 'Dame un momento, estoy leyendo tu sitio web...',
        mode: 'native' 
    });
    scrollToBottom();
    await nextTick();
    isLoading.value = true;

    trackEvent('fast_pass_initiated', { target_domain: url });

    try {
        const isAcmeHost = ['example.com', 'example.test', 'localhost', '127.0.0.1'].includes(window.location.hostname);
        const baseUrl = isAcmeHost ? window.location.origin : (import.meta.env.VITE_API_BASE_URL || 'https://example.com');
        let response;
        try {
            response = await axios.post(`${baseUrl}/api/fast-pass`, 
                { url: `https://${cleanDomain}` },
                { withCredentials: true }
            );
        } catch (firstError) {
            if (firstError.response) {
                throw firstError;
            }
            response = await axios.post(`${baseUrl}/api/fast-pass`, 
                { url: `http://${cleanDomain}` },
                { withCredentials: true }
            );
        }
        
        if (response.data.success) {
            scrapedContext.value = response.data.context;
            goals.value.url_captured = true;
            inputs.value.url = `https://${cleanDomain}`;
            widgetMode.value = 'demo';
            
            demoQuestionsTotal.value = response.data.demo_limit || 3;
            demoQuestionsLeft.value = demoQuestionsTotal.value;
            
            const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
            widgetConfig.value.brandColor = response.data.brand_color || colors[cleanDomain.length % colors.length];

            messages.value.push({
                role: 'model',
                text: `¡Sitio verificado! 🎭 Entrando en MODO DEMO.\n\nAhora estoy actuando como el recepcionista de IA de tu negocio. Pruébame con una pregunta para que veas cómo atiendo a tus clientes. Inspirate en las preguntas que te hacen normalmente, como ¿Dónde están ubicados? o ¿Tienen estacionamiento?`,
                mode: 'demo'
            });
        }
    } catch (error) {
        widgetMode.value = 'native';
        targetUrl.value = '';
        
        let errorMessage = 'Ups, no pude leer ese sitio web. ¿Podrías verificar que la URL esté escrita correctamente y sea pública?';

        if (error.response?.status === 429) {
            errorMessage = 'Has hecho demasiadas peticiones seguidas. Por favor, espera un minuto e intenta de nuevo.';
        } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message; 
        }

        messages.value.push({ role: 'model', text: errorMessage, mode: 'native' });
    } finally {
        isLoading.value = false;
        scrollToBottom();
        setTimeout(() => {
            if (chatInput.value) chatInput.value.focus();
        }, 50);
    }
};

const dynamicPlaceholder = computed(() => {
    if (widgetMode.value === 'demo') return 'Pregunta como cliente...';

    const isLandingPage = ['acmeai', 'example.com', 'example.test', 'fast-pass'].includes(widgetConfig.value.slug);
    const lastMsg = messages.value[messages.value.length - 1]?.text?.toLowerCase() || '';

    if (
        isLandingPage &&
        widgetMode.value === 'native' &&
        !targetUrl.value &&
        (lastMsg.includes('url') || lastMsg.includes('tuempresa.com') || lastMsg.includes('sitio web') || lastMsg.includes('página web'))
    ) {
        return 'ej. www.tuempresa.com';
    }

    if (widgetMode.value === 'conversion') {
        if (lastMsg.includes('correo') || lastMsg.includes('email')) {
            return 'Ingresa tu correo electrónico...';
        }
        if (lastMsg.includes('whatsapp') || lastMsg.includes('número') || lastMsg.includes('dígitos')) {
            return 'Ingresa tu número de WhatsApp...';
        }
        if (lastMsg.includes('nombre')) {
            return 'Ingresa tu nombre completo...';
        }
        return 'Escribe tu respuesta...';
    }

    return 'Pregúntame lo que quieras...';
});

const displayDomain = computed(() => {
    if (!targetUrl.value) return '';
    return targetUrl.value.replace(/^https?:\/\//, '').replace(/\/$/, '');
});

const handleKeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
};

const autoResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px'; 
};

const layoutClasses = computed(() => {
    const map = {
        'arriba-izquierda': {
            container: 'top-20 left-0 right-0 px-4 sm:px-0 sm:top-24 sm:left-9 sm:right-auto items-center sm:items-start justify-start',
            origin: 'origin-top sm:origin-top-left'
        },
        'arriba-derecha': {
            container: 'top-20 left-0 right-0 px-4 sm:px-0 sm:top-24 sm:left-auto sm:right-9 items-center sm:items-end justify-start',
            origin: 'origin-top sm:origin-top-right'
        },
        'abajo-izquierda': {
            container: 'bottom-12 left-0 right-0 px-4 sm:px-0 sm:left-9 sm:right-auto items-center sm:items-start justify-end',
            origin: 'origin-bottom sm:origin-bottom-left'
        },
        'abajo-derecha': {
            container: 'bottom-12 left-0 right-0 px-4 sm:px-0 sm:left-auto sm:right-9 items-center sm:items-end justify-end',
            origin: 'origin-bottom sm:origin-bottom-right'
        }
    };

    const pos = widgetConfig.value.position;
    if (pos === 'down-right') return map['abajo-derecha'];
    if (pos === 'down-left') return map['abajo-izquierda'];
    
    return map[pos] || map['abajo-derecha'];
});

onMounted(async () => {
    const isDemoRoute = window.location.pathname.startsWith('/demo/');

    window.addEventListener('acmeai-open-demo', triggerLiveDemo);

    let slug = null;
    const scriptTag = document.currentScript || document.querySelector('script[data-acme-id], script[src*="widget.js"]');

    if (scriptTag && scriptTag.getAttribute('data-acme-id')) {
        slug = scriptTag.getAttribute('data-acme-id');
    } else if (prospectData.value?.domain || prospectData.value?.slug) {
        slug = prospectData.value.domain || prospectData.value.slug;
    } else if (isDemoRoute) {
        slug = decodeURIComponent(window.location.pathname.replace(/^\/demo\//, '').replace(/\/$/, ''));
    } else {
        slug = widgetConfig.value.slug || 'acmeai';
    }

    // INSTANT 0ms BOOT FOR /demo/ ROUTES
    if (isDemoRoute && slug && slug !== 'fast-pass') {
        const instantName = scriptTag?.getAttribute('data-business-name') || slug;
        const instantColor = scriptTag?.getAttribute('data-brand-color') || '#10B981';
        const instantLimit = parseInt(scriptTag?.getAttribute('data-demo-limit') || '12', 10);

        widgetConfig.value.slug = slug;
        widgetConfig.value.businessName = instantName;
        widgetConfig.value.brandColor = instantColor;
        widgetMode.value = 'demo';
        goals.value.url_captured = true;
        targetUrl.value = `https://${slug}`;
        inputs.value.url = targetUrl.value;
        demoQuestionsTotal.value = instantLimit;
        demoQuestionsLeft.value = instantLimit;

        messages.value = [{
            role: 'model',
            text: `¡Hola! Soy la IA de ${instantName}.\n\nAhora estoy actuando como el recepcionista de IA de tu negocio. Pruébame con una pregunta para que veas cómo atiendo a tus clientes. Inspirate en las preguntas que te hacen normalmente, como ¿Dónde están ubicados? o ¿Tienen estacionamiento?`,
            mode: 'demo'
        }];

        setTimeout(() => {
            if (!isOpen.value && widgetConfig.value.isActive) {
                isOpen.value = true;
                showTooltip.value = false;
                trackEvent('widget_opened', { mode: 'demo', is_proactive: true, auto_open_demo: true });
                scrollToBottom();
            }
        }, 300);
    } else if (props.displayMode === 'fullscreen') {
        isOpen.value = true;
        trackEvent('widget_opened', { mode: widgetMode.value, is_proactive: false, fullscreen: true });
    }

    const tooltipDelay = (props.displayMode === 'fullscreen' || isDemoRoute || widgetMode.value === 'demo') ? 400 : 2000;

    setTimeout(() => {
        if (!isOpen.value && widgetConfig.value.isActive) {
            showTooltip.value = true;
        }
    }, tooltipDelay);

    if (slug) {
        try {
            const isAcmeHost = ['example.com', 'example.test', 'localhost', '127.0.0.1'].includes(window.location.hostname);
            const baseUrl = isAcmeHost ? window.location.origin : (import.meta.env.VITE_API_BASE_URL || 'https://example.com');
            const res = await axios.get(`${baseUrl}/api/widget-config/${encodeURIComponent(slug)}`, { withCredentials: true });

            if (res.data.active) {
                trackEvent('widget_loaded', { slug: slug, mode: widgetMode.value });

                widgetConfig.value.slug = slug;
                widgetConfig.value.businessName = res.data.config.business_name || widgetConfig.value.businessName || slug;
                widgetConfig.value.brandColor = res.data.config.brand_color || widgetConfig.value.brandColor || '#10B981';
                widgetConfig.value.greeting = res.data.config.greeting;
                widgetConfig.value.position = res.data.config.position || 'down-right';
                widgetConfig.value.theme = res.data.config.widget_mode || 'dark';

                if (res.data.config.demo_limit && messages.value.filter(m => m.role === 'user').length === 0) {
                    demoQuestionsTotal.value = res.data.config.demo_limit;
                    demoQuestionsLeft.value = res.data.config.demo_limit;
                }
                
                if (messages.value.length === 0) {
                    const isAcmeDomain = ['example.com', 'example.test', 'localhost', '127.0.0.1'].includes(window.location.hostname);
                    const isLandingPageSlug = ['acmeai', 'example.com', 'example.test', 'fast-pass'].includes(slug);

                    if (isAcmeDomain && !isLandingPageSlug && props.displayMode !== 'fullscreen') {
                        widgetMode.value = 'demo';
                        goals.value.url_captured = true;
                        targetUrl.value = `https://${slug}`;
                        inputs.value.url = targetUrl.value;

                        demoQuestionsTotal.value = res.data.config.demo_limit || 12;
                        demoQuestionsLeft.value = demoQuestionsTotal.value;

                        messages.value.push({
                            role: 'model',
                            text: `¡Hola! Soy la IA de ${widgetConfig.value.businessName}.\n\nAhora estoy actuando como el recepcionista de IA de tu negocio. Pruébame con una pregunta para que veas cómo atiendo a tus clientes. Inspirate en las preguntas que te hacen normalmente, como ¿Dónde están ubicados? o ¿Tienen estacionamiento?`,
                            mode: 'demo'
                        });
                    } else {
                        widgetMode.value = 'native';

                        const initialGreeting = isLandingPageSlug
                            ? (widgetConfig.value.greeting || '¡Hola! Soy el asistente de AcmeAI. ¿En qué te puedo ayudar hoy?')
                            : (widgetConfig.value.greeting || `¡Hola! Soy el asistente de ${widgetConfig.value.businessName}. ¿En qué te puedo ayudar hoy?`);

                        messages.value.push({
                            role: 'model',
                            text: initialGreeting,
                            mode: 'native'
                        });
                    }
                }
            } else {
                widgetConfig.value.isActive = false;
            }
        } catch (error) {
            console.error('AcmeAI: Could not load widget configuration.', error);
        }
    }
});

onUnmounted(() => {
    window.removeEventListener('acmeai-open-demo', triggerLiveDemo);
});

watch(isLoading, async (newIsLoading) => {
    if (!newIsLoading) {
        await nextTick();
        if (chatInput.value) chatInput.value.focus();
    }
});

watch(isOpen, (newVal) => {
    window.dispatchEvent(new CustomEvent('acmeai-state-change', {
        detail: { isOpen: newVal }
    }));
});
</script>

<template>
    <!-- Outer Wrapper -->
    <div :class="[
        displayMode === 'floating' 
            ? 'fixed z-[9999] pointer-events-none flex flex-col ' + layoutClasses.container 
            : 'relative w-full h-full flex items-center justify-center pointer-events-auto p-4'
    ]">

        <!-- OPEN STATE -->
        <div v-show="isOpen"
            class="flex flex-col overflow-hidden transition-colors duration-700 backdrop-blur-2xl"
            :class="[
                displayMode === 'floating'
                    ? 'pointer-events-auto w-full max-w-[92vw] sm:w-80 md:w-[28rem] mx-auto sm:mx-0 rounded-3xl shadow-2xl border max-h-[80vh] ' + layoutClasses.origin
                    : 'w-full h-full rounded-2xl shadow-2xl border'
            ]"
            :style="dynamicStyles">

            <!-- Persistent Top Header (Full space for Business Name + Minimize Button) -->
            <div class="px-5 py-3 border-b shrink-0 transition-colors duration-700 flex items-center justify-between gap-3" :style="headerStyles">
                <div class="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <span class="w-2 h-2 rounded-full animate-pulse shrink-0" :style="{ backgroundColor: widgetConfig.brandColor || '#10B981' }"></span>
                    <div class="flex flex-col min-w-0">
                        <span class="font-bold text-sm tracking-wide truncate" :class="theme.text">
                            {{ widgetConfig.businessName || displayDomain }}
                        </span>
                        <span v-if="widgetMode === 'demo' && displayDomain && widgetConfig.businessName !== displayDomain"
                              class="text-[10px] opacity-60 truncate leading-tight" :class="theme.text">
                            {{ displayDomain }}
                        </span>
                    </div>
                </div>

                <!-- Minimize / Close Button -->
                <button v-if="displayMode === 'floating'"
                        type="button"
                        @click.stop="toggleChat"
                        title="Minimizar chat"
                        aria-label="Minimizar chat"
                        class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer border border-white/10 bg-white/5 hover:bg-white/15"
                        :class="theme.text">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <span class="text-[11px]">Minimizar</span>
                </button>
            </div>

            <!-- Dedicated Demo Mode Ribbon Below Header -->
            <div v-if="widgetMode === 'demo'"
                 class="px-5 py-1.5 bg-purple-600/90 border-b border-purple-400/30 text-white flex items-center justify-center gap-2 shrink-0 shadow-sm">
                <span class="text-[11px] font-semibold tracking-wide">
                    🤖 Modo Demo · {{ demoQuestionsLeft }} {{ demoQuestionsLeft === 1 ? 'pregunta disponible' : 'preguntas disponibles' }}
                </span>
            </div>

            <!-- Loading Mode Subheader -->
            <div v-if="widgetMode === 'loading'" class="px-5 py-2 border-b border-blue-500/20 bg-blue-900/30 text-center animate-pulse shrink-0">
                <p class="text-blue-200 text-xs font-semibold tracking-wider">🔍 Escaneando {{ targetUrl }}...</p>
            </div>

            <!-- Chat Body Area -->
            <div class="flex-1 flex flex-col relative overflow-hidden">
                <div ref="messagesArea"
                     class="overflow-y-auto scrollbar-hide flex flex-col gap-5 px-6"
                     :class="messages.length > 0 ? 'pt-5 pb-2' : 'py-4'">

                    <div v-for="(msg, index) in messages" :key="index"
                         class="flex w-full"
                         :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">

                        <!-- User Bubble -->
                        <div v-if="msg.role === 'user'"
                             class="text-right text-sm font-light max-w-[85%] px-4 py-2 rounded-2xl rounded-tr-sm border"
                             :class="msg.mode === 'demo' ? theme.userBubbleDemo : theme.userBubbleNative">
                            {{ msg.text }}
                        </div>

                        <!-- Separator -->
                        <div v-else-if="msg.role === 'separator'" class="flex items-center justify-center w-full my-2 opacity-60">
                            <div class="h-px flex-1" :class="theme.border"></div>
                            <span class="text-[9px] uppercase tracking-widest px-4 font-semibold" :class="theme.text">{{ msg.text }}</span>
                            <div class="h-px flex-1" :class="theme.border"></div>
                        </div>

                        <!-- AI Bubble -->
                        <div v-else
                            class="text-left text-sm font-light leading-relaxed max-w-[95%] break-words whitespace-pre-wrap"
                            :class="msg.mode === 'demo' 
                                ? ['p-3 rounded-2xl rounded-tl-sm border', theme.aiBubbleDemo] 
                                : theme.text">
                            {{ msg.text }}
                            
                            <!-- Suggested Prompts (Demo Chips) -->
                            <div v-if="widgetMode === 'demo' && index === 0" class="mt-4 flex flex-col gap-2">
                                <span class="text-xs opacity-70 font-medium mb-1">Prueba con una pregunta:</span>
                                <div class="flex flex-wrap gap-2">
                                    <button v-for="prompt in suggestedPrompts" :key="prompt"
                                        @click.prevent="sendSuggestedMessage(prompt)"
                                        class="text-xs bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/40 text-white px-3 py-1.5 rounded-full transition-colors text-left shadow-sm cursor-pointer">
                                        {{ prompt }}
                                    </button>
                                </div>
                            </div>

                            <!-- Quick Replies (Conversion Chips) -->
                            <div v-if="widgetMode === 'conversion' && msg.text.includes('¿Qué te gustaría conocer ahora?') && index === messages.length - 1" class="mt-4 flex flex-wrap gap-2">
                                <button @click.prevent="sendSuggestedMessage('🎯 Cómo precalifica', 'prequalification')" class="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-white px-3 py-1.5 rounded-full transition-colors text-left shadow-sm cursor-pointer">
                                    🎯 Cómo precalifica
                                </button>
                                <button @click.prevent="sendSuggestedMessage('⚙️ Cómo se instala', 'installation')" class="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-white px-3 py-1.5 rounded-full transition-colors text-left shadow-sm cursor-pointer">
                                    ⚙️ Cómo se instala
                                </button>
                                <button @click.prevent="sendSuggestedMessage('💰 Planes y precios', 'pricing')" class="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-white px-3 py-1.5 rounded-full transition-colors text-left shadow-sm cursor-pointer">
                                    💰 Planes y precios
                                </button>
                            </div>
                        </div>
                    </div>

                    <div v-if="isLoading" class="flex justify-start mt-2 mb-2">
                        <div class="flex items-center gap-1.5 bg-white/5 px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 w-fit">
                            <span class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style="animation-delay: -0.32s"></span>
                            <span class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style="animation-delay: -0.16s"></span>
                            <span class="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                </div>

                <div class="px-6 pb-5 pt-3 shrink-0 relative">
                    <form @submit.prevent="sendMessage" class="flex items-center pb-2 border-b transition-colors duration-300" :class="[theme.border, 'focus-within:border-blue-500/50']">
                        <svg class="w-5 h-5 flex-shrink-0" :style="{ color: widgetConfig.brandColor || '#10B981' }" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                        </svg>

                        <textarea ref="chatInput"
                            v-model="newMessage"
                            rows="1"
                            @keydown="handleKeydown"
                            @input="autoResize"
                            :placeholder="isTraining ? 'Memorizando...' : dynamicPlaceholder"
                            class="flex-1 bg-transparent border-0 focus:ring-0 text-sm ml-3 px-0 font-light outline-none shadow-none resize-none max-h-24 overflow-y-auto scrollbar-hide py-1"
                            :class="[{ 'opacity-50': isLoading }, theme.input]"
                        ></textarea>

                        <button type="button" @mousedown.prevent @click="sendMessage"
                            :disabled="isLoading || !newMessage.trim()"
                            class="ml-2 p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            :class="theme.iconBtn">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                    
                    <!-- Micro-Aviso de Privacidad -->
                    <div v-if="widgetMode === 'conversion'" class="mt-3 text-[10px] leading-relaxed text-center px-2" :class="theme.muted">
                        🔒 <strong :class="theme.text">Privacidad:</strong> La información proporcionada durante esta demostración se utiliza únicamente para operar y evaluar la experiencia de AcmeAI. No introduzcas información sensible o confidencial.
                    </div>

                    <div class="mt-4 flex justify-end">
                        <a href="https://example.com" target="_blank" rel="noopener noreferrer"
                            @click="trackEvent('powered_by_clicked', { source_slug: widgetConfig.slug })"
                            class="group flex items-center gap-2 text-[9px] font-semibold tracking-widest italic transition-colors"
                            :class="[theme.muted, 'hover:opacity-80']">
                            <span>Powered by AcmeAI.com</span>
                            <img src="data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2718%27%20height%3D%2718%27%3E%3Crect%20width%3D%2718%27%20height%3D%2718%27%20rx%3D%274%27%20fill%3D%27%2310b981%27%2F%3E%3C%2Fsvg%3E" alt="AcmeAI"
                                 class="object-contain opacity-50 group-hover:opacity-100 transition-opacity" style="width: 18px; height: 18px;">
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- CLOSED STATE (PILL + CLICKABLE SPEECH BUBBLE WITH DOWNWARD ARROW) -->
        <div v-if="displayMode === 'floating'" class="relative flex flex-col items-end w-full sm:w-auto">
            <!-- Globo Proactivo con Flecha hacia abajo (Compacto) -->
            <div v-show="!isOpen && showTooltip" 
                @click="toggleChat"
                class="pointer-events-auto mb-1 flex flex-col items-end animate-bounce origin-bottom-right transition-all cursor-pointer select-none drop-shadow-2xl">
                
                <!-- Cuerpo de la burbuja blanca (reducido de 280px a 215px) -->
                <div class="relative bg-white text-gray-800 text-xs font-normal px-3.5 py-2.5 rounded-2xl max-w-[215px] whitespace-pre-wrap leading-snug shadow-lg">
                    {{ proactiveMessage }}
                </div>

                <!-- Puntero / Flecha de burbuja apuntando directo al botón -->
                <svg class="w-5 h-3.5 -mt-0.5 mr-10 text-white fill-current" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 L16 20 L32 0 Z" />
                </svg>
            </div>

            <!-- Botón Flotante Principal -->
            <button v-show="!isOpen"
                    type="button"
                    @click="toggleChat"
                    class="pointer-events-auto w-fit h-fit group flex items-center gap-3 bg-black/85 backdrop-blur-xl border border-white/15 px-5 py-3 rounded-full shadow-2xl hover:bg-black transition-all duration-300 hover:scale-105 cursor-pointer">
                <svg class="w-5 h-5 flex-shrink-0 animate-pulse" :style="{ color: widgetConfig.brandColor || '#10B981' }" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
                <span class="text-white text-sm font-medium tracking-wide group-hover:text-white">{{ closedButtonText }}</span>
            </button>
        </div>
    </div>
</template>

<style>
@import '../css/widget.css';
</style>
<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>