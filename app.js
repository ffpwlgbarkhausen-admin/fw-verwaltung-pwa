// --- KONFIGURATION & STATE ---
const API_URL = "https://script.google.com/macros/s/AKfycbw7V1qsZVVFF6a7QFX5Yi06T0hugJQ-SuWviI-8R3D6ddGvUxTW3Sqo-eaFVedN4C3-/exec"; 
let appData = { personnel: [], stichtag: new Date(), promoRules: [] }; 

// --- 1. HILFSFUNKTIONEN (Zentral für die ganze App) ---
const AppUtils = {
    // Wandelt alles in ein echtes Datum um (ISO oder TT.MM.JJJJ)
    parseDate: (str) => {
        if (!str || str === '-') return null;
        let d = new Date(str);
        if (isNaN(d.getTime()) && typeof str === 'string' && str.includes('.')) {
            const p = str.split('.');
            d = new Date(p[2], p[1] - 1, p[0]);
        }
        return isNaN(d.getTime()) ? null : d;
    },

    // Formatiert Datum für die Anzeige
    formatDate: (dateInput) => {
        const d = AppUtils.parseDate(dateInput);
        if (!d) return '-';
        return d.toLocaleDateString('de-DE');
    },

    // Berechnet Dienstzeit & Jubiläum
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

    // Jubilare filtern (Nutzt jetzt die zentrale Logik!)
    let jubilare = appData.personnel
        .map(p => ({ ...p, dz: AppUtils.getDienstzeit(p.Eintritt) }))
        .filter(p => p.dz.isJubilaeum)
        .sort((a, b) => b.dz.jahre - a.dz.jahre);

    jubilare.forEach(j => {
        list.innerHTML += `
            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl border-l-4 border-yellow-500 mb-3 ring-1 ring-yellow-200">
                <h4 class="font-bold text-slate-800 dark:text-white">🎖️ ${j.dz.jahre} J. Jubiläum</h4>
                <p class="text-sm text-yellow-700 font-bold">${j.Name}, ${j.Vorname}</p>
            </div>`;
    });

    // Beförderungen
    appData.personnel.forEach(p => {
        const promo = checkPromotionStatus(p);
        if (promo.isFällig) {
            list.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-orange-500 mb-2">
                    <h4 class="font-bold text-sm text-slate-800 dark:text-white">${p.Name}, ${p.Vorname}</h4>
                    <p class="text-[10px] text-slate-500">${p.Dienstgrad} ➔ <span class="text-orange-600 font-bold">${promo.nextDG}</span></p>
                </div>`;
        }
    });
}

function renderPersonal() {
    const list = document.getElementById('member-list');
    const statsDiv = document.getElementById('personal-stats');
    if(!list || !statsDiv) return;
    
    list.innerHTML = "";
    const abteilungen = {};
    appData.personnel.forEach(p => { abteilungen[p.Abteilung] = (abteilungen[p.Abteilung] || 0) + 1; });

    statsDiv.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p class="text-[10px] uppercase text-slate-400 font-bold">Gesamt</p>
            <p class="text-xl font-black text-red-700">${appData.personnel.length}</p>
        </div>
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <p class="text-[10px] uppercase text-slate-400 font-bold">Abteilungen</p>
            <p class="text-[9px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                ${Object.entries(abteilungen).map(([n, v]) => `${n}: ${v}`).join(' | ')}
            </p>
        </div>`;

    appData.personnel.sort((a,b) => a.Name.localeCompare(b.Name)).forEach((p, index) => {
        const promo = checkPromotionStatus(p);
        list.innerHTML += `
            <div onclick="showDetails(${index})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm mb-2 border-l-4 ${promo.isFällig ? 'border-orange-500 bg-orange-50/20' : 'border-transparent'} active:scale-95 transition-all">
                <div class="flex-1">
                    <p class="font-bold text-sm text-slate-800 dark:text-white">${p.Name}, ${p.Vorname} ${promo.isFällig ? '⭐' : ''}</p>
                    <p class="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">${p.Abteilung} | ${p.Dienstgrad}</p>
                </div>
                <span class="text-red-700 text-lg opacity-30">➔</span>
            </div>`;
    });
}

function checkPromotionStatus(p) {
    const rules = appData.promoRules.filter(r => r.Vorheriger_DG === p.Dienstgrad);
    let status = { isFällig: false, nextDG: "", missing: [] };
    if (rules.length === 0) return status;

    rules.forEach(rule => {
        const stichtag = AppUtils.parseDate(appData.stichtag);
        const letzteBef = AppUtils.parseDate(p.Letzte_Befoerderung);
        const jahre = (stichtag - letzteBef) / (1000 * 60 * 60 * 24 * 365.25);
        const zeitOK = jahre >= parseFloat(rule.Wartezeit_Jahre);

        const geforderterLehrgang = rule.Notwendiger_Lehrgang;
        const lehrgangOK = !geforderterLehrgang || (p[geforderterLehrgang] !== undefined && p[geforderterLehrgang] !== "" && p[geforderterLehrgang] !== null);

        if (zeitOK && lehrgangOK) {
            status.isFällig = true;
            status.nextDG = rule.Ziel_DG_Kurz;
        } else if (zeitOK && !lehrgangOK) {
            status.nextDG = rule.Ziel_DG_Kurz;
            status.missing.push(`Lehrgang fehlt: ${geforderterLehrgang}`);
        }
    });
    return status;
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
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-2xl font-black">${p.Name}, ${p.Vorname}</h2>
                    <p class="text-red-700 font-bold">${p.Abteilung} • ${p.Dienstgrad}</p>
                </div>
                <div class="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-lg text-center">
                    <p class="text-[10px] uppercase font-bold text-slate-500">Pers.Nr.</p>
                    <p class="text-sm font-black text-slate-800 dark:text-white">${p.PersNr || '---'}</p>
                </div>
            </div>
        </div>
        
        <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div class="grid grid-cols-2 gap-3">
                <a href="tel:${cleanPhone}" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl font-bold gap-2 active:scale-95 transition">📞 Anrufen</a>
                <a href="https://wa.me/${cleanPhone.replace('+', '').replace(/^00/, '')}" target="_blank" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold gap-2 active:scale-95 transition">💬 WhatsApp</a>
            </div>

            <div class="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p class="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Anschrift</p>
                <div class="flex justify-between items-center">
                    <p class="text-xs font-medium leading-relaxed">${p.Adresse || 'Keine Adresse hinterlegt'}</p>
                    ${p.Adresse ? `
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.Adresse)}" target="_blank" class="bg-blue-50 text-blue-600 p-2 rounded-xl active:scale-90 transition">
                            📍 Karte
                        </a>` : ''}
                </div>
            </div>

            <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-100 dark:bg-green-900/20 border-l-4 border-green-500' : 'bg-slate-100 dark:bg-slate-700/50 border-l-4 border-slate-400'}">
                <p class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Status Beförderung</p>
                <p class="text-sm font-bold mt-1">Ziel: <span class="text-red-700">${promo.nextDG || 'Aktuell Endstufe'}</span></p>
                ${promo.isFällig ? '<p class="text-green-600 text-[10px] font-bold mt-2">✓ Zeit & Lehrgang erfüllt</p>' : (promo.missing.length > 0 ? `<p class="text-red-600 text-[10px] font-bold mt-2 animate-pulse">⚠ ${promo.missing.join(', ')}</p>` : '')}
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div class="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p class="text-[10px] uppercase font-bold text-slate-400">Transponder</p>
                    <p class="text-xs font-mono font-bold">${p.Transponder || '---'}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p class="text-[10px] uppercase font-bold text-slate-400">DME-Nr.</p>
                    <p class="text-xs font-mono font-bold">${p.DME || '---'}</p>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p class="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Ausbildungsstand</p>
                <div class="grid grid-cols-1 gap-2">
                    ${lehrgangsListe.map(lg => {
                        const hat = (p[lg] !== undefined && p[lg] !== null && p[lg] !== "");
                        return `<div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
                            <span class="${hat ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}">${lg}</span>
                            <span>${hat ? '✅' : '🟣'}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                <div class="space-y-2">
                    <div>
                        <p class="text-slate-400 uppercase font-bold">Geburtstag</p>
                        <p class="font-medium">${AppUtils.formatDate(p.Geburtstag)}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 uppercase font-bold">Eintritt</p>
                        <p class="font-medium">${AppUtils.formatDate(p.Eintritt)}</p>
                    </div>
                </div>
                <div class="flex flex-col justify-between ${dz.isJubilaeum ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded p-1' : ''}">
                    <div>
                        <p class="text-slate-400 uppercase font-bold">Letzte Beförderung</p>
                        <p class="font-medium">${AppUtils.formatDate(p.Letzte_Befoerderung)}</p>
                    </div>
                    <div class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p class="text-slate-400 uppercase font-bold">Dienstzeit ${dz.isJubilaeum ? '🎖️' : ''}</p>
                        <p class="font-black text-red-700 text-sm">${dz.text}</p>
                    </div>
                </div>
            </div>
        </div>`;
    document.getElementById('member-modal').classList.remove('hidden');
}

function closeDetails() { document.getElementById('member-modal').classList.add('hidden'); }
function filterPersonal() {
    const s = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('.member-item').forEach(i => { i.style.display = i.innerText.toLowerCase().includes(s) ? 'flex' : 'none'; });
}
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }
