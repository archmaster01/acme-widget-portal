import { defineComponent, h, reactive } from 'vue';

const pageState = reactive({
    url: '/dashboard',
    component: 'Dashboard',
    props: {
        auth: {
            user: {
                id: 1,
                name: 'Demo Operator',
                email: 'user@example.com',
                business_name: 'Bistro Central',
                slug: 'bistro-central.example.com',
                whatsapp_number: '5550199',
                brand_color: '#10B981'
            }
        }
    }
});

export const usePage = () => pageState;

export const router = {
    visit: (url) => { pageState.url = url; },
    get: (url) => { pageState.url = url; },
    post: () => Promise.resolve()
};

export const Head = defineComponent({
    name: 'InertiaHead',
    props: { title: { type: String, default: '' } },
    setup(props) {
        if (typeof document !== 'undefined' && props.title) {
            document.title = props.title;
        }
        return () => null;
    }
});

export const Link = defineComponent({
    name: 'InertiaLink',
    props: { href: { type: String, default: '#' } },
    setup(props, { slots, attrs }) {
        return () => h('a', { href: props.href, ...attrs }, slots.default ? slots.default() : []);
    }
});
