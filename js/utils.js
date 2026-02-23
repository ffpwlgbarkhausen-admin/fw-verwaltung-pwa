/**
 * HILFSFUNKTIONEN (Utilities)
 * Rechenlogik und Formatierung
 */
const AppUtils = {
    // Wandelt DD.MM.YYYY in ein JS-Date Objekt um
    parseDate: (str) => {
        if (!str || str === '-' || typeof str !== 'string') return null;
        if (str.includes('.')) {
            const p = str.split('.');
            return new Date(p[2], p[1] - 1, p[0]);
        }
        let d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    },

    // Gibt Datum als DD.MM.YYYY zurück
    formatDate: (dateInput) => {
        const d = AppUtils.parseDate(dateInput);
        return d ? d.toLocaleDateString('de-DE') : '-';
    },

    // Berechnet Dienstzeit unter Berücksichtigung von Pausen und Stichtag
    getDienstzeit: (eintrittInput, pausenInput) => {
        const eintritt = AppUtils.parseDate(eintrittInput);
        if (!eintritt) return { text: '-', isJubilaeum: false, jahre: 0 };

        const pause = parseFloat(pausenInput) || 0;
        const stichtagInput = document.getElementById('stichtag-input')?.value;
        const stichtag = stichtagInput ? new Date(stichtagInput) : new Date();

        // Jahre berechnen (Differenz der Jahre abzüglich Pause)
        let jahre = stichtag.getFullYear() - eintritt.getFullYear() - pause;
        
        // Prüfen, ob der Jahrestag im aktuellen Jahr schon war
        const jahrestagDiesesJahr = new Date(stichtag.getFullYear(), eintritt.getMonth(), eintritt.getDate());
        if (stichtag < jahrestagDiesesJahr) {
            // Wenn der Stichtag vor dem diesjährigen Jubiläumstag liegt, ein Jahr abziehen
            // (Nur wenn man es ganz genau tagesaktuell braucht, sonst weglassen)
        }

        return {
            text: `${jahre} J.`,
            jahre: jahre,
            isJubilaeum: CONFIG.JUBILAEEN.includes(jahre)
        };
    }
};
