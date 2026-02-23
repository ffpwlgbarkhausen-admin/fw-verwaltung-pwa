/**
 * HAUPTDATEI: App-Logik & UI-Steuerung
 */

// Der State bleibt hier, da er sich zur Laufzeit ändert
let appData = { personnel: [], stichtag: new Date(), promoRules: [] };

// 1. DATEN-FUNKTIONEN
async function fetchData() {
    try {
        const response = await fetch(CONFIG.API_URL); // Nutzt CONFIG
        appData = await response.json();
        renderDashboard();
    } catch (e) {
        console.error("Fehler beim Laden:", e);
    }
}

// 2. DASHBOARD RENDERN
function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
    // ... (Dein Code für Stichtag-ISO Berechnung)

    // JUBILÄEN LOGIK (Mit CONFIG statt messlatten)
    const jubilare = appData.personnel
        .map((p, idx) => {
            const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
            const erreichtesJubiläum = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
            const bereitsEingetragen = erreichtesJubiläum && p.Ehrenzeichen && 
                                      p.Ehrenzeichen.toString().includes(erreichtesJubiläum.toString());
            return { ...p, dz, originalIndex: idx, faellig: erreichtesJubiläum, anzeigen: erreichtesJubiläum && !bereitsEingetragen };
        })
        .filter(p => p.anzeigen);

    // ... (Rest von renderDashboard wie gehabt)
}

// 3. DETAILANSICHT
function showDetails(index) {
    const p = appData.personnel[index];
    const promo = checkPromotionStatus(p);
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    
    // Nutzt CONFIG für Jubiläen und Lehrgänge
    const fälligesJubiläum = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
    const ehrungSchonErhalten = fälligesJubiläum && p.Ehrenzeichen && p.Ehrenzeichen.toString().includes(fälligesJubiläum.toString());
    const zeigeEhrungsAktion = fälligesJubiläum && !ehrungSchonErhalten;

    // ... (Dein HTML-String für showDetails)
    // WICHTIG: Ersetze lehrgangsListe.map durch CONFIG.LEHRGAENGE.map
}

// 4. WEITERE FUNKTIONEN (checkPromotionStatus, updateStichtag, showJubileeConfirm, executeJubilee)
// ... Kopiere diese Funktionen einfach hier unten drunter.

// INITIALISIERUNG
window.onload = fetchData;
