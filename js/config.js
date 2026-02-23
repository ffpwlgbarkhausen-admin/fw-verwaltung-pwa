/**
 * ZENTRALE KONFIGURATION
 * Alle festen Werte und Einstellungen der App
 */
const CONFIG = {
    // Die Schnittstelle zu Google Sheets
    API_URL: "https://script.google.com/macros/s/AKfycbyja4HWHpmuwWTuZBEXTOFGns8-xb1S4ppSUc2xXWcJ8SdBmfkUZQUlSa-z-ypqK6jW/exec",

    // Jubiläums-Meilensteine für die Berechnung
    JUBILAEEN: [25, 35, 40, 50, 60, 70, 75, 80],

    // Alle relevanten Lehrgänge für die Personalübersicht
    LEHRGAENGE: [
        "Probezeit", 
        "Grundausbildung", 
        "Truppführer", 
        "Gruppenführer", 
        "Zugführer", 
        "Verbandsführer 1", 
        "Verbandsführer 2"
    ],

    // Design-Farben für Banner (falls du sie mal global ändern willst)
    THEME: {
        AMBER: 'amber-500',
        GREEN: 'green-600',
        RED: 'red-700'
    }
};
