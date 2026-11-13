<script setup>
import { usePage } from '@inertiajs/vue3';
import ChatWidget from '@/Components/ChatWidget.ce.vue';

const page = usePage();
</script>

<template>
    <div class="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
        <header class="bg-gray-950 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span class="font-bold text-sm tracking-wide text-white">AcmeAI · SaaS Control</span>
            </div>
            <div class="text-xs text-gray-400">
                {{ page.props.auth.user.email }}
            </div>
        </header>
        <main class="flex-1 flex flex-col">
            <slot />
        </main>
        <ChatWidget :prospect="{ slug: 'acmeai', name: 'AcmeAI', brand_color: '#10B981', whatsapp_number: '5550199' }" />
    </div>
</template>
