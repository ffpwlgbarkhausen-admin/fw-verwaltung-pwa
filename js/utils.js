/**
 * HILFSFUNKTIONEN (Utilities)
 */
const AppUtils = {
    parseDate: (str) => {
        if (!str || str === '-') return null;
        if (str instanceof Date) return str;
        const p = str.toString().split('.');
        if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
        let d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    },
    formatDate: (dateInput) => {
        const d = AppUtils.parseDate(dateInput);
        return d ? d.toLocaleDateString('de-DE') : '-';
    },
    getDienstzeit: (eintrittInput, pausenInput) => {
        const eintritt = AppUtils.parseDate(eintrittInput);
        if (!eintritt) return { text: '-', jahre: 0 };
        const stichtagInput = document.getElementById('stichtag-input')?.value;
        const heute = stichtagInput ? new Date(stichtagInput) : new Date();
        let jahre = heute.getFullYear() - eintritt.getFullYear();
        if (heute < new Date(heute.getFullYear(), eintritt.getMonth(), eintritt.getDate())) { jahre--; }
        const pause = parseFloat(pausenInput) || 0;
        const netto = jahre - pause;
        return { text: `${netto} J.`, jahre: netto };
    }
};
