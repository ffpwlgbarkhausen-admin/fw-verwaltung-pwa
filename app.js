// --- KONFIGURATION & STATE ---
const API_URL = "https://script.google.com/macros/s/AKfycbw7V1qsZVVFF6a7QFX5Yi06T0hugJQ-SuWviI-8R3D6ddGvUxTW3Sqo-eaFVedN4C3-/exec"; 
let appData = { personnel: [], stichtag: new Date(), promoRules: [] }; 

// --- 1. HILFSFUNKTIONEN ---
const AppUtils = {
    parseDate: (str) => {
        if (!str || str === '-') return null;
        let d = new Date(str);
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

    getDienstzeit: (eintrittInput) => {
        const eintritt = AppUtils.parseDate(eintrittInput);
        if (!eintritt) return { text: '-', isJubilaeum: false, jahre: 0 };

        const stichtag = AppUtils.parseDate(appData.stichtag) || new Date();
        let jahre = stichtag.getFullYear() - eintritt.getFullYear();
        const m = stichtag.getMonth() - eintritt.getMonth();
        if (m < 0 || (m === 0 && stichtag.getDate() < eintritt.getDate())) jahre--;

        const jahreAnzeige = jahre >= 0 ? jahre : 0;
        const jubilaeen = [25, 35, 40, 50, 60, 70, 75, 80];
        return { 
            text: jahreAnzeige + " J.", 
            isJubilaeum: jubilaeen.includes(jahreAnzeige),
            jahre: jahreAnzeige
        };
    }
};

// --- 2. CORE FUNKTIONEN ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}?action=read`);
        appData = await response.json();
        initUI();
    } catch (e) {
        console.error("API Fehler:", e);
    }
}

function initUI() {
    const loader = document.getElementById('loader');
    if(loader) loader.classList.add('hidden');
    
    // Setze das Datum im Input-Feld auf den aktuellen Stichtag aus der API
    const stichtagInput = document.getElementById('stichtag-input');
    if(stichtagInput && appData.stichtag) {
        const d = AppUtils.parseDate(appData.stichtag);
        if(d) stichtagInput.value = d.toISOString().split('T')[0];
    }

    showView('home');
    renderDashboard();
    renderPersonal();
}

function checkPromotionStatus(p) {
    const rules = appData.promoRules.filter(r => r.Vorheriger_DG.trim() === p.Dienstgrad.trim());
    let status = { isFällig: false, nextDG: "", missing: [] };
    if (rules.length === 0) return status;

    const rule = rules[0]; 
    status.nextDG = rule.Ziel_DG_Kurz;

    const stichtag = AppUtils.parseDate(appData.stichtag);
    const letzteBef = AppUtils.parseDate(p.Letzte_Befoerderung);
    
    // Zeitprüfung
    let zeitOK = false;
    if (letzteBef) {
        const jahre = (stichtag - letzteBef) / (1000 * 60 * 60 * 24 * 365.25);
        zeitOK = jahre >= parseFloat(rule.Wartezeit_Jahre);
    }

    // Lehrgangsprüfung
    const gefLg = rule.Notwendiger_Lehrgang ? rule.Notwendiger_Lehrgang.trim() : "";
    const hatLg = p[gefLg] ? p[gefLg].toString().trim() !== "" : false;
    const lehrgangOK = !gefLg || hatLg;

    if (zeitOK && lehrgangOK) {
        status.isFällig = true;
    } else {
        if (!zeitOK) status.missing.push("Wartezeit");
        if (!lehrgangOK) status.missing.push(`Lehrgang: ${gefLg}`);
    }
    return status;
}

// --- 3. UI RENDERING ---
function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(`view-${name}`);
    if(targetView) targetView.classList.add('active');
    const title = document.getElementById('header-title');
    if(title) title.innerText = name === 'home' ? 'LG13 PRO' : 'PERSONALVERWALTUNG';
}

function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
    // 1. ZUERST: Die Steuerung für den Stichtag aufbauen
    // Wir nutzen appData.stichtag als Standardwert für das Input-Feld
    const currentStichtagISO = AppUtils.parseDate(appData.stichtag).toISOString().split('T')[0];

    list.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8">
            <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-3 text-center">Simulation: Stichtag anpassen</p>
            <div class="flex flex-col gap-3">
                <div class="flex gap-2">
                    <input type="date" id="stichtag-input" value="${currentStichtagISO}"
                           class="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm font-bold dark:text-white focus:ring-2 focus:ring-red-500 transition-all">
                    <button onclick="updateStichtag()" 
                            class="bg-red-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-red-900/20">
                        Speichern
                    </button>
                </div>
                <p id="last-saved-info" class="text-[9px] text-slate-400 text-center italic">
                    ${appData.lastSaved ? `Zuletzt aktualisiert: ${appData.lastSaved}` : 'Aktuell: Daten aus Google Tabelle'}
                </p>
            </div>
        </div>
    `;

    // 2. JUBILÄEN
    const jubilare = appData.personnel
        .map(p => ({ ...p, dz: AppUtils.getDienstzeit(p.Eintritt) }))
        .filter(p => p.dz.isJubilaeum);

    if(jubilare.length > 0) {
        list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2">
            <span class="w-8 h-[1px] bg-slate-200"></span> 🎖️ Jubiläen
        </h3>`;
        
        jubilare.forEach(j => {
            list.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-amber-400 mb-3 ring-1 ring-slate-200 dark:ring-slate-700">
                    <p class="font-black text-sm dark:text-white">${j.Name}, ${j.Vorname}</p>
                    <p class="text-xs mt-1">
                        <span class="text-amber-600 font-black">🎖️ ${j.dz.jahre} Jahre Dienstzeit</span>
                    </p>
                </div>`;
        });
    }

    // 3. BEFÖRDERUNGEN
    const bereit = appData.personnel
        .map((p, idx) => ({ ...p, promo: checkPromotionStatus(p), originalIndex: idx }))
        .filter(p => p.promo.isFällig);

    list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 mt-6 tracking-widest flex items-center gap-2">
        <span class="w-8 h-[1px] bg-slate-200"></span> 📋 Beförderungen
    </h3>`;

    if(bereit.length > 0) {
        bereit.forEach(p => {
            list.innerHTML += `
                <div onclick="showDetails(${p.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-green-500 mb-3 active:scale-95 transition-all cursor-pointer ring-1 ring-slate-200 dark:ring-slate-700">
                    <p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p>
                    <p class="text-xs mt-1">
                        <span class="text-slate-400">${p.Dienstgrad}</span> ➔ <span class="text-green-600 font-black">${p.promo.nextDG}</span>
                    </p>
                </div>`;
        });
    } else {
        list.innerHTML += `<div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-xs italic">Keine Ereignisse fällig.</div>`;
    }
}

// HILFSFUNKTION FÜR DEN SPEICHER-BUTTON
function updateStichtag() {
    const input = document.getElementById('stichtag-input');
    if(!input) return;

    // Wert in appData speichern
    appData.stichtag = input.value;
    
    // Zeitstempel für "Zuletzt gespeichert"
    const jetzt = new Date();
    appData.lastSaved = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + " Uhr";

    // Alles neu zeichnen (Dashboard + Personalverwaltung)
    renderDashboard();
    renderPersonal();
}

function renderPersonal() {
    const list = document.getElementById('member-list');
    const statsDiv = document.getElementById('personal-stats');
    if(!list || !statsDiv) return;
    
    list.innerHTML = "";
    const abteilungen = {};
    appData.personnel.forEach(p => { abteilungen[p.Abteilung] = (abteilungen[p.Abteilung] || 0) + 1; });

    statsDiv.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 w-full flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
            <div class="flex flex-col">
                <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest">Gesamtstärke</p>
                <p class="text-4xl font-black text-red-700 leading-none mt-1">${appData.personnel.length}</p>
            </div>
            
            <div class="hidden sm:block w-[1px] h-12 bg-slate-100 dark:bg-slate-700"></div>

            <div class="flex-1">
                <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-2">Abteilungs-Verteilung</p>
                <div class="flex flex-wrap gap-2">
                    ${Object.entries(abteilungen).map(([n, v]) => `
                        <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                            <span class="text-[10px] font-black text-red-700">${n}</span>
                            <span class="text-xs font-bold dark:text-white">${v}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;

    appData.personnel
        .map((p, originalIndex) => ({ ...p, originalIndex })) 
        .sort((a, b) => a.Name.localeCompare(b.Name))
        .forEach((p) => {
            const promo = checkPromotionStatus(p);
            const dz = AppUtils.getDienstzeit(p.Eintritt);

            let zeitInfo = "";
            const rule = appData.promoRules.find(r => r.Vorheriger_DG.trim() === p.Dienstgrad.trim());
            const zielDG = rule ? rule.Ziel_DG_Kurz : "---";

            if (promo.isFällig) {
                zeitInfo = `<span class="text-orange-600 font-black italic uppercase">Jetzt fällig zum ${zielDG}!</span>`;
            } else if (rule) {
                const letzteBef = AppUtils.parseDate(p.Letzte_Befoerderung);
                const stichtag = AppUtils.parseDate(appData.stichtag);
                if (letzteBef) {
                    const erreichteJahre = (stichtag - letzteBef) / (1000 * 60 * 60 * 24 * 365.25);
                    const restJahre = parseFloat(rule.Wartezeit_Jahre) - erreichteJahre;
                    
                    if (restJahre > 0) {
                        const restAnzeige = restJahre < 1 
                            ? `${Math.ceil(restJahre * 12)} Mon.` 
                            : `${restJahre.toFixed(1)} J.`;
                        
                        zeitInfo = `<span class="text-slate-400 font-bold uppercase">Noch ${restAnzeige} bis ${zielDG}</span>`;
                    }
                }
            }

            list.innerHTML += `
                <div data-index="${p.originalIndex}" onclick="showDetails(${p.originalIndex})" 
                     class="member-item bg-white dark:bg-slate-800 p-5 rounded-2xl flex justify-between items-center shadow-sm mb-3 border border-slate-100 dark:border-slate-700 border-l-4 ${promo.isFällig ? 'border-l-orange-500 bg-orange-50/10' : 'border-l-slate-300'} active:scale-[0.98] transition-all cursor-pointer">
                    
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <p class="font-black text-base text-slate-800 dark:text-white">
                                ${p.Name}, ${p.Vorname} 
                                <span class="text-slate-400 font-medium text-sm ml-1">(${p.PersNr || '---'})</span>
                            </p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-1 rounded-md font-black uppercase tracking-tighter">${p.Abteilung}</span>
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">${p.Dienstgrad}</span>
                            <span class="text-[10px] ml-1 font-bold tracking-tight">${zeitInfo}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <div class="text-right hidden sm:block">
                             <p class="text-[9px] text-slate-300 uppercase font-black tracking-widest">Dienstzeit</p>
                             <p class="text-xs font-black ${dz.isJubilaeum ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}">${dz.text}</p>
                        </div>
                        <span class="text-slate-300 text-xl font-light">❯</span>
                    </div>
                </div>`;
        });
}
function showDetails(index) {
    const p = appData.personnel[index];
    const promo = checkPromotionStatus(p);
    const dz = AppUtils.getDienstzeit(p.Eintritt);
    const content = document.getElementById('modal-content');
    const cleanPhone = p.Telefon ? p.Telefon.toString().replace(/\s+/g, '') : '';
    const lehrgangsListe = ["Probezeit", "Grundausbildung", "Truppführer", "Gruppenführer", "Zugführer", "Verbandsführer 1", "Verbandsführer 2"];

    content.innerHTML = `
    <div class="mb-6">
        <h2 class="text-2xl font-black dark:text-white">${p.Name}, ${p.Vorname} ${p.PersNr ? `<span class="text-slate-400 font-medium text-lg">(${p.PersNr})</span>` : ''}</h2>
        <p class="text-red-700 font-bold uppercase text-xs tracking-wider">${p.Abteilung} • ${p.Dienstgrad}</p>
    </div>
    
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div class="grid grid-cols-2 gap-3">
            <a href="tel:${cleanPhone}" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl font-bold gap-2 active:scale-95 transition dark:text-white">📞 Anrufen</a>
            <a href="https://wa.me/${cleanPhone.replace('+', '').replace(/^00/, '')}" target="_blank" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold gap-2 active:scale-95 transition">💬 WhatsApp</a>
        </div>

        <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-400'}">
            <p class="text-[10px] uppercase font-bold ${promo.isFällig ? 'text-green-100' : 'text-slate-500'} tracking-wider">Status Beförderung</p>
            ${promo.isFällig 
                ? `<p class="text-lg font-black mt-1">Beförderung zum ${promo.nextDG} veranlassen!</p>
                   <p class="text-[10px] opacity-90 mt-1">✓ Wartezeit und Lehrgang erfolgreich abgeschlossen.</p>`
                : `<p class="text-sm font-bold mt-1 dark:text-white">Nächstes Ziel: <span class="text-red-700">${promo.nextDG || 'Endstufe erreicht'}</span></p>
                   ${promo.missing.length > 0 ? `<p class="text-red-600 text-[10px] font-bold mt-2">⚠ ${promo.missing.join(', ')}</p>` : ''}`
            }
        </div>

        <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div class="space-y-3">
                <div>
                    <p class="text-slate-400 uppercase font-bold tracking-tight">Geburtstag</p>
                    <p class="font-bold text-sm dark:text-white">${AppUtils.formatDate(p.Geburtstag)}</p>
                </div>
                <div>
                    <p class="text-slate-400 uppercase font-bold tracking-tight">Eintritt</p>
                    <p class="font-bold text-sm dark:text-white">${AppUtils.formatDate(p.Eintritt)}</p>
                </div>
            </div>
            <div class="flex flex-col justify-between p-2 rounded-xl ${dz.isJubilaeum ? 'bg-amber-100/50 ring-1 ring-amber-400' : 'bg-white/50 dark:bg-slate-800/50'}">
                <div>
                    <p class="text-slate-400 uppercase font-bold tracking-tight">Letzte Beförderung</p>
                    <p class="font-bold text-sm dark:text-white">${AppUtils.formatDate(p.Letzte_Befoerderung)}</p>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p class="text-slate-400 uppercase font-bold tracking-tight">Dienstzeit ${dz.isJubilaeum ? '🎖️' : ''}</p>
                    <p class="font-black text-red-700 text-base">${dz.text}</p>
                </div>
            </div>
        </div>

        <div class="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p class="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Ausbildungsstand</p>
            <div class="grid grid-cols-1 gap-2">
                ${lehrgangsListe.map(lg => {
                    const hat = (p[lg] && p[lg].toString().trim() !== "");
                    return `<div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
                        <span class="${hat ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}">${lg}</span>
                        <span>${hat ? '✅' : '🟣'}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    </div>`;

    document.getElementById('member-modal').classList.remove('hidden');
}

function filterPersonal() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('.member-item').forEach(item => {
        const p = appData.personnel[item.getAttribute('data-index')];
        const searchPool = `${p.Name} ${p.Vorname} ${p.PersNr} ${p.Abteilung} ${p.Dienstgrad}`.toLowerCase();
        item.style.display = searchPool.includes(searchTerm) ? 'flex' : 'none';
    });
}
function closeDetails() { document.getElementById('member-modal').classList.add('hidden'); }
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }
function updateStichtag() {
    const input = document.getElementById('stichtag-input');
    if(!input || !input.value) return;

    // 1. Neuen Stichtag in State übernehmen
    appData.stichtag = input.value;
    
    // 2. Zeitstempel generieren
    const jetzt = new Date();
    appData.lastSaved = jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + " Uhr";

    // 3. UI komplett neu berechnen
    renderDashboard();
    renderPersonal();
    
    // Kleines Feedback-Highlight
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "✓ OK";
    setTimeout(() => btn.innerText = originalText, 2000);
}
