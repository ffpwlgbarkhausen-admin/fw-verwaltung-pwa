/**
 * HILFSFUNKTIONEN (Utilities)
 */
const AppUtils = {
    parseDate: (str) => {
        if (!str || str === '-' || typeof str !== 'string') return null;
        if (str.includes('.')) {
            const p = str.split('.');
            return new Date(p[2], p[1] - 1, p[0]);
        }
        let d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    },

    formatDate: (dateInput) => {
        const d = AppUtils.parseDate(dateInput);
        return d ? d.toLocaleDateString('de-DE') : '-';
    },

    getDienstzeit: (eintrittInput, pausenInput) => {
        const eintritt = AppUtils.parseDate(eintrittInput);
        if (!eintritt) return { text: '-', isJubilaeum: false, jahre: 0 };

        const pause = parseFloat(pausenInput) || 0;
        const stichtagInput = document.getElementById('stichtag-input')?.value;
        const stichtag = stichtagInput ? new Date(stichtagInput) : new Date();

        let jahre = stichtag.getFullYear() - eintritt.getFullYear() - pause;
        
        return {
            text: `${jahre} J.`,
            jahre: jahre,
            isJubilaeum: CONFIG.JUBILAEEN.includes(jahre)
        };
    }
};
