/**
 * HAUPTDATEI: App-Logik & UI-Steuerung
 * Alle Module integriert: Dashboard, Personal, Details & API-Anbindung
 */

// --- 1. KONFIGURATION & STATE ---
const API_URL = "https://script.google.com/macros/s/AKfycbyja4HWHpmuwWTuZBEXTOFGns8-xb1S4ppSUc2xXWcJ8SdBmfkUZQUlSa-z-ypqK6jW/exec"; 

const CONFIG = {
    API_URL: API_URL,
    JUBILAEEN: [10, 25, 40, 50, 60, 70],
    LEHRGAENGE: [
        "Grundausbildung", 
        "Truppführer", 
        "Gruppenführer", 
        "Zugführer", 
        "Verbandsführer 1", 
        "Verbandsführer 2"]
};

let appData = { personnel: [], stichtag: new Date(), promoRules: [] };

// --- 2. HILFSFUNKTIONEN (DATENVERARBEITUNG) ---
const AppUtils = {
    parseDate: (str) => {
        if (!str || str === '-') return null;
        if (str instanceof Date) return str;
        let d = new Date(str);
        // Fix für deutsches Format (DD.MM.YYYY)
        if (isNaN(d.getTime()) && typeof str === 'string' && str.includes('.')) {
            const p = str.split('.');
            d = new Date(p[2], p[1] - 1, p[0]);
        }
        return isNaN(d.getTime()) ? null : d;
    },

    formatDate: (dateInput) => {
        const d = AppUtils.parseDate(dateInput);
        return d ? d.toLocaleDateString('de-DE') : '-';
    },

    getDienstzeit: (eintrittInput, pausenInput) => {
        const eintritt = AppUtils.parseDate(eintrittInput);
        if (!eintritt) return { text: '-', jahre: 0 };
        
        const heute = new Date();
        let jahre = heute.getFullYear() - eintritt.getFullYear();
        const m = heute.getMonth() - eintritt.getMonth();
        if (m < 0 || (m === 0 && heute.getDate() < eintritt.getDate())) {
            jahre--;
        }
        
        const pause = parseFloat(pausenInput) || 0;
        const nettoJahre = jahre - pause;
        
        return {
            text: `${nettoJahre.toFixed(1)} J.`,
            jahre: nettoJahre
        };
    }
};

// --- 3. DATEN LADEN ---
async function fetchData() {
    const status = document.getElementById('sync-status');
    const loader = document.getElementById('loader');
    if(status) status.innerText = "Synchronisiere...";
    
    try {
        const response = await fetch(CONFIG.API_URL);
        const text = await response.text();
        try {
            appData = JSON.parse(text);
        } catch(e) {
            console.error("Server lieferte kein JSON:", text);
            throw new Error("Ungültige Antwort vom Server");
        }
        
        if(loader) loader.classList.add('hidden');
        if(status) status.innerText = "Verbunden";
        
        renderDashboard();
    } catch (e) {
        console.error("Fehler beim Laden:", e);
        if(status) status.innerText = "Offline-Modus";
    }
}

// --- 4. RENDERING: DASHBOARD ---
function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
    // Stichtag für Input-Feld vorbereiten
    let currentStichtagISO = "";
    const raw = (appData.stichtag || "").toString().trim();
    if(raw.includes('.')) {
        const p = raw.split('.');
        currentStichtagISO = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    } else {
        currentStichtagISO = raw;
    }

    list.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8">
            <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-3 text-center">Stichtag anpassen</p>
            <div class="flex flex-col gap-3">
                <div class="flex gap-2">
                    <input type="date" id="stichtag-input" value="${currentStichtagISO}"
                           class="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold dark:text-white focus:ring-2 focus:ring-red-500 transition-all">
                    <button onclick="updateStichtag()" 
                            class="bg-red-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                        Speichern
                    </button>
                </div>
                <p id="last-saved-info" class="text-[9px] text-slate-400 text-center italic">
                    ${appData.lastSaved ? `Zuletzt aktualisiert: ${appData.lastSaved}` : 'Datenquelle: Google Tabelle'}
                </p>
            </div>
        </div>
    `;

    // 4a. Jubiläen berechnen & anzeigen
    const jubilare = (appData.personnel || [])
        .map((p, idx) => {
            const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
            const erreichtesJubiläum = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
            const bereitsEingetragen = erreichtesJubiläum && p.Ehrenzeichen && 
                                      p.Ehrenzeichen.toString().includes(erreichtesJubiläum.toString());
            return { ...p, dz, originalIndex: idx, faellig: erreichtesJubiläum, anzeigen: erreichtesJubiläum && !bereitsEingetragen };
        })
        .filter(p => p.anzeigen);

    if(jubilare.length > 0) {
        list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2">🎖️ Offene Ehrungen</h3>`;
        jubilare.forEach(j => {
            list.innerHTML += `
                <div onclick="showDetails(${j.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-amber-400 mb-3 active:scale-95 transition-all cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-black text-sm dark:text-white">${j.Name}, ${j.Vorname}</p>
                            <p class="text-[10px] text-slate-400">Dienstzeit: ${j.dz.text}</p>
                        </div>
                        <span class="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-lg">${j.faellig} J. FÄLLIG</span>
                    </div>
                </div>`;
        });
    }

    // 4b. Beförderungen berechnen & anzeigen
    const bereit = (appData.personnel || [])
        .map((p, idx) => ({ ...p, promo: checkPromotionStatus(p), originalIndex: idx }))
        .filter(p => p.promo.isFällig);

    list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 mt-6 tracking-widest flex items-center gap-2">📋 Beförderungen</h3>`;

    if(bereit.length > 0) {
        bereit.forEach(p => {
            list.innerHTML += `
                <div onclick="showDetails(${p.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-green-500 mb-3 active:scale-95 transition-all cursor-pointer">
                    <p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p>
                    <p class="text-xs mt-1">
                        <span class="text-slate-400">${p.Dienstgrad}</span> ➔ <span class="text-green-600 font-black">${p.promo.nextDG}</span>
                    </p>
                </div>`;
        });
    } else {
        list.innerHTML += `<div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-[10px] italic">Keine Ereignisse fällig.</div>`;
    }
}

// --- 5. DETAILANSICHT ---
// --- 5. DETAILANSICHT ---
function showDetails(index) {
    const p = appData.personnel[index];
    const promo = checkPromotionStatus(p);
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    const content = document.getElementById('modal-content');
    const cleanPhone = p.Telefon ? p.Telefon.toString().replace(/\s+/g, '') : '';
    
    const fälligesJubiläum = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
    const ehrungSchonErhalten = fälligesJubiläum && p.Ehrenzeichen && p.Ehrenzeichen.toString().includes(fälligesJubiläum.toString());
    const zeigeEhrungsAktion = fälligesJubiläum && !ehrungSchonErhalten;

    content.innerHTML = `
    <div class="mb-6">
        <h2 class="text-2xl font-black dark:text-white">${p.Name}, ${p.Vorname} ${p.PersNr ? `<span class="text-slate-400 font-medium text-lg">(${p.PersNr})</span>` : ''}</h2>
        <p class="text-red-700 font-bold uppercase text-xs tracking-wider">${p.Abteilung} • ${p.Dienstgrad}</p>
    </div>
    
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        ${zeigeEhrungsAktion ? `
            <div onclick="showJubileeConfirm(${index}, '${fälligesJubiläum} Jahre')" 
                 class="bg-amber-500 p-5 rounded-3xl shadow-lg shadow-amber-900/20 mb-4 text-white active:scale-95 transition-all cursor-pointer border-b-4 border-amber-700">
                <p class="text-[10px] font-black uppercase tracking-widest text-amber-100 opacity-80">⚡ Aktion erforderlich</p>
                <p class="text-lg font-black mt-1">Ehrung zum ${fälligesJubiläum}-jährigen Jubiläum!</p>
                <p class="text-[10px] mt-1 underline decoration-amber-300">Hier klicken, um Datum zu wählen & zu speichern</p>
            </div>
        ` : ''}

        <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-600 text-white shadow-lg cursor-pointer active:scale-95 transition-all' : 'bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-400'}">
            <p class="text-[10px] uppercase font-bold ${promo.isFällig ? 'text-green-100' : 'text-slate-500'} tracking-wider">
                ${promo.isFällig ? '⚡ Aktion erforderlich' : 'Status Beförderung'}
            </p>
            ${promo.isFällig 
                ? `<div onclick="showPromotionConfirm(${index}, '${promo.nextDG}')">
                     <p class="text-lg font-black mt-1">Beförderung zum ${promo.nextDG} veranlassen!</p>
                     <p class="text-[10px] opacity-90 mt-1 underline text-white">Hier klicken zum Bestätigen & Datum wählen</p>
                   </div>`
                : `<p class="text-sm font-bold mt-1 dark:text-white">Nächstes Ziel: <span class="text-red-700">${promo.nextDG || 'Endstufe erreicht'}</span></p>
                   ${promo.missing.length > 0 ? `<p class="text-red-600 text-[10px] font-bold mt-2">⚠ ${promo.missing.join(', ')}</p>` : ''}`
            }
        </div>

        <div class="grid grid-cols-2 gap-3">
            <a href="tel:${cleanPhone}" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl font-bold gap-2 text-xs active:scale-95 transition dark:text-white">📞 Anrufen</a>
            <a href="https://wa.me/${cleanPhone.replace('+', '').replace(/^00/, '')}" target="_blank" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold gap-2 text-xs active:scale-95 transition">💬 WhatsApp</a>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div class="space-y-3">
                <div><p class="text-slate-400 uppercase font-bold tracking-tight">Geburtstag</p><p class="font-bold text-sm dark:text-white">${AppUtils.formatDate(p.Geburtstag)}</p></div>
                <div><p class="text-slate-400 uppercase font-bold tracking-tight">Eintritt</p><p class="font-bold text-sm dark:text-white">${AppUtils.formatDate(p.Eintritt)}</p></div>
            </div>
            <div onclick="${zeigeEhrungsAktion ? `showJubileeConfirm(${index}, '${fälligesJubiläum} Jahre')` : ''}" 
                 class="flex flex-col justify-between p-2 rounded-xl transition-all ${zeigeEhrungsAktion ? 'bg-amber-500 text-white shadow-lg cursor-pointer active:scale-95 ring-2 ring-amber-300' : 'bg-white/50 dark:bg-slate-800/50'}">
                <div><p class="${zeigeEhrungsAktion ? 'text-amber-100' : 'text-slate-400'} uppercase font-bold tracking-tight">Ehrenzeichen</p><p class="font-bold text-sm ${zeigeEhrungsAktion ? 'text-white' : 'dark:text-white'}">${p.Ehrenzeichen || 'Keines'}</p></div>
                <div class="mt-2 pt-2 border-t ${zeigeEhrungsAktion ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'}"><p class="${zeigeEhrungsAktion ? 'text-amber-100' : 'text-slate-400'} uppercase font-bold tracking-tight">Dienstzeit</p><p class="font-black ${zeigeEhrungsAktion ? 'text-white' : 'text-red-700'} text-base">${dz.text}</p></div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p class="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Ausbildungsstand</p>
            <div class="grid grid-cols-1 gap-2">
                ${CONFIG.LEHRGAENGE.map(lg => {
                    const hat = (p[lg] && p[lg].toString().trim() !== "" && p[lg].toString().trim() !== "-");
                    return `<div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
                        <span class="${hat ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}">${lg}</span>
                        <span>${hat ? '✅' : '🟣'}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    </div>`;

    // Modal am Ende anzeigen
    document.getElementById('member-modal').classList.remove('hidden');
}

// --- 6. NAVIGATION & PERSONAL-LISTE ---
function showViewWithNav(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    if(viewId === 'personal') renderPersonalList();
}

function renderPersonalList() {
    const list = document.getElementById('member-list');
    if(!list) return;
    list.innerHTML = appData.personnel.map((p, idx) => `
        <div onclick="showDetails(${idx})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex justify-between items-center mb-2">
            <div><p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p><p class="text-[10px] text-slate-400">${p.Dienstgrad}</p></div>
            <span class="text-xl">➔</span>
        </div>
    `).join('');
}

function closeDetails() { document.getElementById('member-modal').classList.add('hidden'); }
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }

// --- 7. LOGIK (PRÜFUNG & SPEICHERN) ---
function checkPromotionStatus(p) {
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    const rules = appData.promoRules.find(r => r.Vorheriger_DG?.trim() === p.Dienstgrad?.trim());
    if (!rules) return { isFällig: false, nextDG: "Endstufe", missing: [] };

    const missing = [];
    const wartezeit = parseFloat(rules.Wartezeit_Jahre) || 0;
    if (dz.jahre < wartezeit) missing.push(`${(wartezeit - dz.jahre).toFixed(1)} J. fehlen`);
    
    const gefordert = rules.Notwendiger_Lehrgang?.trim();
    if (gefordert && (!p[gefordert] || p[gefordert].toString().trim() === "")) {
        missing.push(`Lehrgang ${gefordert}`);
    }

    return { isFällig: missing.length === 0, nextDG: rules.Ziel_DG_Kurz, missing: missing };
}

// Speicher-Aktionen
async function executeJubilee(persNr, type, index) {
    const dateInput = document.getElementById('jubilee-date-input');
    if(!dateInput?.value) return;
    const nurZahl = type.replace(/[^0-9]/g, '');
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=confirm_jubilee&persNr=${persNr}&jubileeType=${nurZahl}&date=${dateInput.value}`);
        const res = await resp.json();
        if(res.success) { await fetchData(); setTimeout(() => showDetails(index), 500); }
    } catch (e) { alert("Fehler!"); }
}

async function executePromotion(persNr, zielDG, index) {
    const dateInput = document.getElementById('promo-date-input');
    if(!dateInput?.value) return;
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=promote_member&persNr=${persNr}&newDG=${zielDG}&newDate=${dateInput.value}`);
        const res = await resp.json();
        if(res.success) { await fetchData(); closeDetails(); }
    } catch (e) { alert("Fehler!"); }
}

// Modal-Helfer für Bestätigungen
function showJubileeConfirm(index, type) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <div class="bg-amber-50 dark:bg-slate-900 border-2 border-amber-600 p-6 rounded-3xl">
            <h3 class="font-black text-xl mb-4">🎖️ Ehrung bestätigen</h3>
            <p class="text-sm mb-6">Wann hat <b>${p.Vorname} ${p.Name}</b> die Urkunde für <b>${type}</b> erhalten?</p>
            <input type="date" id="jubilee-date-input" class="w-full p-4 rounded-2xl mb-6" value="${new Date().toISOString().split('T')[0]}">
            <div class="grid grid-cols-2 gap-4">
                <button onclick="showDetails(${index})" class="bg-slate-200 p-4 rounded-2xl">❌ Abbrechen</button>
                <button onclick="executeJubilee('${p.PersNr}', '${type}', ${index})" class="bg-amber-600 text-white p-4 rounded-2xl">💾 Speichern</button>
            </div>
        </div>`;
}

function showPromotionConfirm(index, nextDG) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
    <div class="bg-green-50 dark:bg-slate-900 border-2 border-green-600 p-6 rounded-3xl">
        <h3 class="font-black text-xl mb-4">🚀 Beförderung bestätigen</h3>
        <p class="text-sm mb-6">Datum der Beförderung zum <b>${nextDG}</b>:</p>
        <input type="date" id="promo-date-input" class="w-full p-4 rounded-2xl mb-6" value="${new Date().toISOString().split('T')[0]}">
        <div class="grid grid-cols-2 gap-4">
            <button onclick="showDetails(${index})" class="bg-slate-200 p-4 rounded-2xl">❌ Abbrechen</button>
            <button onclick="executePromotion('${p.PersNr}', '${nextDG}', ${index})" class="bg-green-600 text-white p-4 rounded-2xl">💾 Speichern</button>
        </div>
    </div>`;
}

// Start
window.onload = fetchData;
