<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import ReportStatCard from '@/Components/Reports/StatCard.vue';
import { Head } from '@inertiajs/vue3';
import VueApexCharts from 'vue3-apexcharts';

const telemetryData = ref(null);
const isLoading = ref(true);
const selectedDays = ref('7');
const selectedScope = ref('native'); // 'native' | 'demos' | 'all'
const activeMetric = ref('overview');

const selectMetric = (metricKey) => {
    activeMetric.value = activeMetric.value === metricKey ? 'overview' : metricKey;
};

const fetchSystemUsage = async () => {
    isLoading.value = true;
    try {
        const { data } = await axios.get('/reports/system-usage', {
            params: {
                days: selectedDays.value,
                scope: selectedScope.value,
            }
        });
        telemetryData.value = data;
    } catch (error) {
        console.error('Failed to load system usage', error);
    } finally {
        isLoading.value = false;
    }
};

const changeScope = (scope) => {
    selectedScope.value = scope;
    fetchSystemUsage();
};

const changeDays = (days) => {
    selectedDays.value = days;
    fetchSystemUsage();
};

onMounted(() => {
    fetchSystemUsage();
});

const enabledSeries = ref(['Hits / Tráfico']);

const currentChart = computed(() => {
    const charts = telemetryData.value?.timeline?.charts;
    if (!charts) return { title: '', colors: ['#10b981'], series: [] };
    return charts[activeMetric.value] || charts.overview;
});

// Reset pills whenever the chart mode changes:
// - In 'overview' mode, only turn on the first series ('Hits / Tráfico') by default
// - In single-card drilldown modes, turn on all series for that card
watch(
    () => [activeMetric.value, currentChart.value?.series],
    ([metric, rawSeries]) => {
        if (!rawSeries || !rawSeries.length) return;
        if (metric === 'overview') {
            const validSelection = enabledSeries.value.filter(name =>
                rawSeries.some(s => s.name === name)
            );
            if (validSelection.length === 0) {
                enabledSeries.value = [rawSeries[0].name];
            }
        } else {
            enabledSeries.value = rawSeries.map(s => s.name);
        }
    },
    { immediate: true }
);

const toggleSeriesPill = (seriesName) => {
    const idx = enabledSeries.value.indexOf(seriesName);
    if (idx > -1) {
        // Keep at least 1 series active so the chart never goes completely blank
        if (enabledSeries.value.length > 1) {
            enabledSeries.value.splice(idx, 1);
        }
    } else {
        enabledSeries.value.push(seriesName);
    }
};

const filteredChartData = computed(() => {
    const rawSeries = currentChart.value?.series || [];
    const rawColors = currentChart.value?.colors || ['#10b981', '#a855f7', '#ec4899', '#3b82f6'];

    const series = [];
    const colors = [];

    rawSeries.forEach((s, i) => {
        if (enabledSeries.value.includes(s.name)) {
            series.push(s);
            colors.push(rawColors[i] || '#3b82f6');
        }
    });

    return { series, colors };
});

const chartOptions = computed(() => ({
    chart: {
        toolbar: { show: false },
        foreColor: '#9ca3af',
        background: 'transparent',
        stacked: false,
        animations: { enabled: true, speed: 350 },
    },
    colors: filteredChartData.value.colors,
    stroke: { curve: 'smooth', width: 2.5 },
    xaxis: {
        categories: telemetryData.value?.timeline?.labels || [],
    },
    yaxis: { min: 0, forceNiceScale: true },
    dataLabels: { enabled: false },
    grid: { borderColor: '#1f2937', strokeDashArray: 4 },
    fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02 },
    },
    legend: { show: false },
    tooltip: { theme: 'dark' },
}));

const formatEventLabel = (type) => {
    const map = {
        proposal_opened: '📄 Abrió Propuesta Comercial',
        clicked_pricing: '🔥 Clic en Precios',
        clicked_installation: 'Clic en Instalación',
        clicked_prequalification: '🎯 Solicitud Prueba / Precalificación',
        powered_by_clicked: '⚡ Clic en Powered by AcmeAI',
        demo_completed: '✅ Completó Demo IA',
        demo_started: '💬 Inició Simulador IA',
        fast_pass_initiated: '⚡ Fast-Pass (Sitio Analizado por Visitante)',
        demo_chip_clicked: '🔘 Clic en Chip del Simulador',
        message_sent: '💬 Mensaje Enviado al Widget IA',
        chat_message: '🤖 Mensaje al Chat IA',
        widget_opened: '👀 Abrió Widget IA',
        widget_closed: '👋 Cerró Widget IA',
        widget_loaded: '🟢 Cargó Widget / Simulador',
        incoming_traffic: '🌐 Hit / Visita a Página',
        page_view: '📄 Vista de Página',
    };
    return map[type] || type;
};


</script>

<template>
    <Head title="Dashboard" />

    <AuthenticatedLayout>
        <div class="flex-1 overflow-y-auto px-5 py-3 bg-gray-900">
            <div class="mx-auto max-w-7xl flex flex-col gap-3">

                <!-- Compact Single-Row Command Bar -->
                <div class="flex flex-wrap items-center justify-between gap-2 bg-gray-950 px-4 py-2.5 rounded-xl border border-gray-800">
                    <div class="flex items-center gap-3">
                        <h1 class="text-sm font-bold text-white tracking-tight">
                            📊 Centro de Mando Global
                        </h1>

                        <div class="h-4 w-px bg-gray-800 hidden sm:block"></div>

                        <div class="flex items-center gap-1.5">
                            <button
                                @click="changeScope('native')"
                                class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                :class="selectedScope === 'native'
                                    ? 'bg-purple-600 text-white shadow'
                                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'"
                            >
                                🏠 example.com
                            </button>
                            <button
                                @click="changeScope('demos')"
                                class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                :class="selectedScope === 'demos'
                                    ? 'bg-cyan-600 text-white shadow'
                                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'"
                            >
                                🎯 Demos (/demo)
                            </button>
                            <button
                                @click="changeScope('all')"
                                class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                :class="selectedScope === 'all'
                                    ? 'bg-gray-700 text-white shadow'
                                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'"
                            >
                                🌐 Todo Acme
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center gap-1">
                        <button
                            v-for="opt in [
                                { label: '7D', val: '7' },
                                { label: '30D', val: '30' },
                                { label: '90D', val: '90' },
                                { label: 'Todo', val: 'all' }
                            ]"
                            :key="opt.val"
                            @click="changeDays(opt.val)"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                            :class="selectedDays === opt.val
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'"
                        >
                            {{ opt.label }}
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div v-if="isLoading" class="py-16 flex items-center justify-center text-emerald-400 font-semibold animate-pulse">
                    Cargando métricas globales del sistema...
                </div>

                <template v-else-if="telemetryData">
                    <!-- 8 Dynamic Status Cards Rendered via Loop -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <ReportStatCard
                            v-for="card in telemetryData.cards"
                            :key="card.key"
                            :card="card"
                            :active="activeMetric === card.key"
                            @select="selectMetric"
                        />
                    </div>

                    <!-- Interactive Timeline Chart + Live Telemetry Feed -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div class="lg:col-span-2 bg-gray-950 border border-gray-800 p-4 rounded-xl flex flex-col">
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div class="flex items-center gap-2">
                                    <h3 class="text-gray-300 text-xs font-bold uppercase tracking-wider">
                                        {{ currentChart.title }}
                                    </h3>
                                    <button
                                        v-if="activeMetric !== 'overview'"
                                        @click="activeMetric = 'overview'"
                                        class="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-gray-900 border border-gray-800 px-2.5 py-0.5 rounded-md transition"
                                    >
                                        ↺ Ver Embudo General
                                    </button>
                                </div>

                                <!-- Interactive Series Toggle Pills -->
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <button
                                        v-for="(s, idx) in (currentChart.series || [])"
                                        :key="s.name"
                                        type="button"
                                        @click="toggleSeriesPill(s.name)"
                                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                                        :class="enabledSeries.includes(s.name)
                                            ? 'bg-gray-900 text-gray-100 border-gray-700 shadow-sm'
                                            : 'bg-gray-950/40 text-gray-500 border-gray-800/60 opacity-50 hover:opacity-80'"
                                    >
                                        <span
                                            class="w-2.5 h-2.5 rounded-full transition-transform"
                                            :class="enabledSeries.includes(s.name) ? 'scale-100' : 'scale-75'"
                                            :style="{ backgroundColor: (currentChart.colors || ['#10b981', '#a855f7', '#ec4899', '#3b82f6'])[idx] }"
                                        ></span>
                                        <span>{{ s.name }}</span>
                                    </button>
                                </div>
                            </div>

                            <div class="flex-1 min-h-[250px]">
                                <VueApexCharts
                                    :key="activeMetric + '-' + selectedDays + '-' + selectedScope + '-' + enabledSeries.join(',')"
                                    type="area"
                                    height="250"
                                    :options="chartOptions"
                                    :series="filteredChartData.series"
                                />
                            </div>
                        </div>

                        <div class="bg-gray-950 border border-gray-800 p-4 rounded-xl flex flex-col max-h-[310px]">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    ⚡ Actividad Reciente en Vivo
                                </h3>
                            </div>
                            <div class="flex-1 overflow-y-auto divide-y divide-gray-800/70 pr-1">
                                <div
                                    v-for="ev in telemetryData.recent_events"
                                    :key="ev.id"
                                    class="py-2 flex items-start justify-between gap-2 px-2 rounded"
                                >
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-white truncate">
                                            {{ ev.domain }}
                                        </div>
                                        <div class="text-[11px] text-emerald-400">
                                            {{ formatEventLabel(ev.event_type) }}
                                        </div>
                                    </div>
                                    <span class="text-[10px] text-gray-500 shrink-0">
                                        {{ ev.time_ago }}
                                    </span>
                                </div>
                                <div v-if="!telemetryData.recent_events?.length" class="py-8 text-center text-xs text-gray-500">
                                    Sin eventos recientes para este filtro.
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

            </div>
        </div>
    </AuthenticatedLayout>
</template>