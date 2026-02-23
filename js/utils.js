/**
 * HILFSFUNKTIONEN (Utilities)
 */
const AppUtils = {
    // Wandelt verschiedene Datumsformate (ISO oder DE) in ein Date-Objekt um
    parseDate: (str) => {
        if (!str || str === '-' || str === "") return null;
        if (str instanceof Date) return str;
        
        // Versuche deutsches Format: dd.mm.yyyy
        const parts = str.toString().split('.');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        
        // Fallback für ISO oder andere Formate
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

        const pause = parseFloat(pausenInput) || 0;
        
        // Berechne Dienstzeit basierend auf dem Stichtag im UI (falls vorhanden)
        const stichtagInput = document.getElementById('stichtag-input')?.value;
        const heute = stichtagInput ? new Date(stichtagInput) : new Date();

        let jahre = heute.getFullYear() - eintritt.getFullYear();
        const m = heute.getMonth() - eintritt.getMonth();
        if (m < 0 || (m === 0 && heute.getDate() < eintritt.getDate())) {
            jahre--;
        }

        const nettoJahre = jahre - pause;
        return {
            text: `${nettoJahre.toFixed(1)} J.`,
            jahre: nettoJahre
        };
    }
};
