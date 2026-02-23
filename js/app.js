/**
 * HAUPTDATEI: App-Logik & UI-Steuerung
 * Stand: 2026-02-23 - Abgestimmt auf Google Script v1.8.0
 */

let appData = { personnel: [], stichtag: "", promoRules: [] };

// --- 1. DATEN-SYNCHRONISATION ---
async function fetchData() {
    const status = document.getElementById('sync-status');
    const loader = document.getElementById('loader');
    if(status) status.innerText = "Synchronisiere...";
    
    try {
        // Der Parameter ?action=read ist wichtig für dein doGet(e) im Script
        const response = await fetch(CONFIG.API_URL + "?action=read");
        const data = await response.json();
        appData = data;
        
        if(loader) loader.classList.add('hidden');
        if(status) status.innerText = "Verbunden";
        
        // Initiales Rendering
        renderDashboard();
    } catch (e) {
        console.error("Fehler beim Laden:", e);
        if(status) status.innerText = "Offline-Modus";
    }
}

// --- 2. DASHBOARD RENDERING ---
function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
    // Stichtag-Logik (Konvertierung für HTML-Date-Input)
    let dateVal = appData.stichtag || "";
    let currentStichtagISO = "";
    if(dateVal.includes('.')) {
        const p = dateVal.split('.');
        currentStichtagISO = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    } else {
        currentStichtagISO = dateVal;
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
            </div>
        </div>
    `;

    // JUBILÄEN (Original-Logik mit Icons)
    const jubilare = (appData.personnel || []).map((p, idx) => {
        const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
        const erreicht = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
        // Prüft, ob das Jubiläum bereits im Feld "Ehrenzeichen" steht
        const erledigt = erreicht && p.Ehrenzeichen && p.Ehrenzeichen.toString().includes(erreicht.toString());
        return { ...p, dz, originalIndex: idx, erreicht, anzeigen: erreicht && !erledigt };
    }).filter(p => p.anzeigen);

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
                        <span class="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-lg">${j.erreicht} J. FÄLLIG</span>
                    </div>
                </div>`;
        });
    }

    // BEFÖRDERUNGEN (Original-Logik)
    const bereit = (appData.personnel || []).map((p, idx) => ({ 
        ...p, 
        promo: checkPromotionStatus(p), 
        originalIndex: idx 
    })).filter(p => p.promo.isFällig);

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

// --- 3. DETAILANSICHT ---
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
        <h2 class="text-2xl font-black dark:text-white">${p.Name}, ${p.Vorname}</h2>
        <p class="text-red-700 font-bold uppercase text-xs tracking-wider">${p.Abteilung || 'LG13'} • ${p.Dienstgrad}</p>
    </div>
    
    <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        ${zeigeEhrungsAktion ? `
            <div onclick="showJubileeConfirm(${index}, '${fälligesJubiläum} Jahre')" 
                 class="bg-amber-500 p-5 rounded-3xl shadow-lg mb-4 text-white active:scale-95 transition-all cursor-pointer border-b-4 border-amber-700">
                <p class="text-[10px] font-black uppercase tracking-widest opacity-80">⚡ Aktion erforderlich</p>
                <p class="text-lg font-black mt-1">Ehrung zum ${fälligesJubiläum}-jährigen Jubiläum!</p>
            </div>
        ` : ''}

        <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-600 text-white shadow-lg cursor-pointer active:scale-95 transition-all' : 'bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-400'}">
            <p class="text-[10px] uppercase font-bold ${promo.isFällig ? 'text-green-100' : 'text-slate-500'} tracking-wider">
                ${promo.isFällig ? '⚡ Aktion erforderlich' : 'Status Beförderung'}
            </p>
            ${promo.isFällig 
                ? `<div onclick="showPromotionConfirm(${index}, '${promo.nextDG}')">
                     <p class="text-lg font-black mt-1">Beförderung zum ${promo.nextDG} veranlassen!</p>
                   </div>`
                : `<p class="text-sm font-bold mt-1 dark:text-white">Nächstes Ziel: <span class="text-red-700">${promo.nextDG || 'Endstufe'}</span></p>`
            }
        </div>

        <div class="grid grid-cols-2 gap-3">
            <a href="tel:${cleanPhone}" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl font-bold gap-2 text-xs active:scale-95 transition dark:text-white">📞 Anrufen</a>
            <a href="https://wa.me/${cleanPhone.replace('+', '').replace(/^00/, '')}" target="_blank" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold gap-2 text-xs active:scale-95 transition">💬 WhatsApp</a>
        </div>

        <div class="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
            <p class="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Ausbildungsstand</p>
            <div class="grid grid-cols-1 gap-2">
                ${CONFIG.LEHRGAENGE.map(lg => {
                    const hat = (p[lg] && p[lg].toString().trim() !== "" && p[lg].toString().trim() !== "-");
                    return `<div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
                        <span class="${hat ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-300 dark:text-slate-600'}">${lg}</span>
                        <span>${hat ? '✅' : '⚪'}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>

        ${p.Historie ? `
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
             <p class="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Historie</p>
             <p class="text-[10px] dark:text-slate-300 italic">${p.Historie}</p>
        </div>` : ''}
    </div>`;

    document.getElementById('member-modal').classList.remove('hidden');
}

// --- 4. NAVIGATION & PERSONAL-LISTE ---
function showViewWithNav(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.replace('text-red-700', 'text-slate-400'));
    
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    // Markiere Button als aktiv (einfache Logik)
    event.currentTarget.classList.replace('text-slate-400', 'text-red-700');
    
    if(viewId === 'personal') renderPersonalList();
}

function renderPersonalList() {
    const list = document.getElementById('member-list');
    if(!list) return;
    list.innerHTML = appData.personnel.map((p, idx) => `
        <div onclick="showDetails(${idx})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex justify-between items-center mb-2 active:scale-[0.98] transition-all" data-name="${p.Name} ${p.Vorname}">
            <div>
                <p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p>
                <p class="text-[10px] text-slate-400">${p.Dienstgrad}</p>
            </div>
            <span class="text-xl text-slate-300">➔</span>
        </div>
    `).join('');
}

function filterPersonal() {
    const query = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('.member-item').forEach(item => {
        const name = item.getAttribute('data-name').toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// --- 5. LOGIK (PRÜFUNG & API) ---
function checkPromotionStatus(p) {
    // 1. Die entscheidende Zeit für Beförderungen ist das Datum der letzten Beförderung
    // Falls das Feld leer ist, nehmen wir als Fallback den Eintritt
    const basisDatum = p.Letzte_Befoerderung || p.Eintritt;
    const letzteBef = AppUtils.parseDate(basisDatum);
    
    if (!letzteBef) return { isFällig: false, nextDG: "Daten fehlen" };

    // 2. Regel für den aktuellen Dienstgrad (OBM) finden
    const rules = appData.promoRules.find(r => r.Vorheriger_DG?.trim() === p.Dienstgrad?.trim());
    if (!rules) return { isFällig: false, nextDG: "Endstufe" };

    // 3. Zeit seit der letzten Beförderung berechnen
    const stichtagInput = document.getElementById('stichtag-input')?.value;
    const heute = stichtagInput ? new Date(stichtagInput) : new Date();
    
    let jahreSeitLetzterBef = heute.getFullYear() - letzteBef.getFullYear();
    if (heute < new Date(heute.getFullYear(), letzteBef.getMonth(), letzteBef.getDate())) {
        jahreSeitLetzterBef--;
    }

    const missing = [];
    
    // 4. Prüfung der Wartezeit (z.B. 3 oder 4 Jahre für HBM)
    const erforderlicheJahre = parseFloat(rules.Wartezeit_Jahre) || 0;
    if (jahreSeitLetzterBef < erforderlicheJahre) {
        missing.push(`Wartezeit: ${jahreSeitLetzterBef.toFixed(1)}/${erforderlicheJahre} J.`);
    }
    
    // 5. Prüfung der Lehrgänge (wie bisher)
    const gefordert = rules.Notwendiger_Lehrgang?.trim();
    if (gefordert && gefordert !== "" && gefordert !== "-") {
        const hatLehrgang = (p[gefordert] && p[gefordert].toString().trim() !== "" && p[gefordert] !== "-");
        if (!hatLehrgang) missing.push(`Lehrgang: ${gefordert}`);
    }

    return { 
        isFällig: missing.length === 0, 
        nextDG: rules.Ziel_DG_Kurz,
        reasons: missing 
    };
}

async function updateStichtag() {
    const input = document.getElementById('stichtag-input');
    if(!input || !input.value) return;
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=update_stichtag&date=${input.value}`);
        const res = await resp.json();
        if(res.success) fetchData();
    } catch(e) { alert("Fehler beim Speichern!"); }
}

function showJubileeConfirm(index, type) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <div class="bg-amber-50 dark:bg-slate-900 border-2 border-amber-600 p-6 rounded-3xl">
            <h3 class="font-black text-xl mb-4 text-amber-900 dark:text-amber-500">🎖️ Ehrung bestätigen</h3>
            <p class="text-sm mb-6">Wann hat <b>${p.Vorname} ${p.Name}</b> die Urkunde für <b>${type}</b> erhalten?</p>
            <input type="date" id="jubilee-date-input" class="w-full p-4 rounded-2xl mb-6 bg-white dark:bg-slate-800" value="${new Date().toISOString().split('T')[0]}">
            <div class="grid grid-cols-2 gap-4">
                <button onclick="showDetails(${index})" class="bg-slate-200 dark:bg-slate-700 p-4 rounded-2xl font-bold">❌</button>
                <button onclick="executeJubilee('${p.PersNr}', '${type}', ${index})" class="bg-amber-600 text-white p-4 rounded-2xl font-black">💾 SPEICHERN</button>
            </div>
        </div>`;
}

function showPromotionConfirm(index, nextDG) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <div class="bg-green-50 dark:bg-slate-900 border-2 border-green-600 p-6 rounded-3xl">
            <h3 class="font-black text-xl mb-4 text-green-900 dark:text-green-500">🚀 Beförderung</h3>
            <p class="text-sm mb-6">Datum für <b>${nextDG}</b>:</p>
            <input type="date" id="promo-date-input" class="w-full p-4 rounded-2xl mb-6 bg-white dark:bg-slate-800" value="${new Date().toISOString().split('T')[0]}">
            <div class="grid grid-cols-2 gap-4">
                <button onclick="showDetails(${index})" class="bg-slate-200 dark:bg-slate-700 p-4 rounded-2xl font-bold">❌</button>
                <button onclick="executePromotion('${p.PersNr}', '${nextDG}', ${index})" class="bg-green-600 text-white p-4 rounded-2xl font-black">💾 SPEICHERN</button>
            </div>
        </div>`;
}

async function executeJubilee(persNr, type, index) {
    const dateInput = document.getElementById('jubilee-date-input');
    const nurZahl = type.toString().replace(/[^0-9]/g, '');
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=confirm_jubilee&persNr=${persNr}&jubileeType=${nurZahl}&date=${dateInput.value}`);
        const res = await resp.json();
        if(res.success) { 
            await fetchData(); 
            closeDetails();
        }
    } catch (e) { alert("API-Fehler!"); }
}

async function executePromotion(persNr, nextDG, index) {
    const dateInput = document.getElementById('promo-date-input');
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=promote_member&persNr=${persNr}&newDG=${nextDG}&newDate=${dateInput.value}`);
        const res = await resp.json();
        if(res.success) { 
            await fetchData(); 
            closeDetails();
        }
    } catch (e) { alert("API-Fehler!"); }
}

function closeDetails() { document.getElementById('member-modal').classList.add('hidden'); }
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }

// Initialisierung
window.onload = fetchData;
