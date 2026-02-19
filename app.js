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
    const stichtagElement = document.getElementById('stichtag-display');
    if(stichtagElement) stichtagElement.innerText = AppUtils.formatDate(appData.stichtag);
    
    const list = document.getElementById('promo-list');
    if(!list) return;
    list.innerHTML = "";

    // 1. JUBILÄEN (Jetzt im großen Karten-Design)
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
                        <span class="text-slate-400 ml-1">• Herzlichen Glückwunsch!</span>
                    </p>
                </div>`;
        });
    }

    // 2. BEFÖRDERUNGEN (Konsistent zu den Jubiläen)
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
                        <span class="text-slate-400">${p.Dienstgrad}</span> 
                        <span class="text-green-600 font-bold mx-1">➔</span> 
                        <span class="text-green-600 font-black">Beförderung zum ${p.promo.nextDG}</span>
                    </p>
                </div>`;
        });
    } else {
        list.innerHTML += `
            <div class="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <p class="text-xs text-slate-400 italic font-medium">Aktuell keine anstehenden Ereignisse zum Stichtag.</p>
            </div>`;
    }
}

function renderPersonal() {
    const list = document.getElementById('member-list');
    const statsDiv = document.getElementById('personal-stats');
    if(!list || !statsDiv) return;
    
    list.innerHTML = "";
    const abteilungen = {};
    appData.personnel.forEach(p => { abteilungen[p.Abteilung] = (abteilungen[p.Abteilung] || 0) + 1; });

    statsDiv.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1">
            <p class="text-[10px] uppercase text-slate-400 font-bold">Gesamt</p>
            <p class="text-xl font-black text-red-700">${appData.personnel.length}</p>
        </div>
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex-[2]">
            <p class="text-[10px] uppercase text-slate-400 font-bold">Abteilungen</p>
            <p class="text-[9px] font-medium text-slate-600 dark:text-slate-300">${Object.entries(abteilungen).map(([n, v]) => `${n}: ${v}`).join(' | ')}</p>
        </div>`;

    appData.personnel
        .map((p, originalIndex) => ({ ...p, originalIndex })) 
        .sort((a, b) => a.Name.localeCompare(b.Name))
        .forEach((p) => {
            const promo = checkPromotionStatus(p);
            list.innerHTML += `
                <div data-index="${p.originalIndex}" onclick="showDetails(${p.originalIndex})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm mb-2 border-l-4 ${promo.isFällig ? 'border-orange-500 bg-orange-50/20' : 'border-transparent'} active:scale-95 transition-all cursor-pointer">
                    <div class="flex-1">
                        <p class="font-bold text-sm text-slate-800 dark:text-white">
                            ${p.Name}, ${p.Vorname} ${p.PersNr ? `(${p.PersNr})` : ''} 
                            ${promo.isFällig ? `<span class="ml-2 text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full">BEFÖRDERN</span>` : ''}
                        </p>
                        <p class="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">${p.Abteilung} | ${p.Dienstgrad}</p>
                    </div>
                    <span class="text-red-700 text-lg opacity-30">➔</span>
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
