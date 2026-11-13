import { recordLocalTelemetry } from '../mocks/axios.js';

export const trackEvent = (eventType, details = {}) => {
    try {
        let visitorUuid = localStorage.getItem('acme_uuid');

        if (!visitorUuid) {
            if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
                visitorUuid = window.crypto.randomUUID();
            } else {
                visitorUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
            localStorage.setItem('acme_uuid', visitorUuid);
        }

        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const paramsObj = Object.fromEntries(urlParams.entries());

        if (paramsObj.ref) {
            paramsObj.source = paramsObj.ref;
            delete paramsObj.ref;
        }

        const eventData = {
            domain: typeof window !== 'undefined' ? (window.location.hostname || 'example.com') : 'example.com',
            visitor_uuid: visitorUuid,
            event_type: eventType,
            details: { ...paramsObj, ...details }
        };

        recordLocalTelemetry(eventData);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('acme-telemetry-event', { detail: eventData }));
        }
    } catch (error) {
        console.error('Telemetry failed:', error);
    }
};
