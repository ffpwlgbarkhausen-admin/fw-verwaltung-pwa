/**
 * HAUPTDATEI: App-Logik & UI-Steuerung
 */

// Globaler State
let appData = { personnel: [], stichtag: new Date(), promoRules: [] };

// --- 1. DATEN-FUNKTIONEN ---
async function fetchData() {
    const status = document.getElementById('sync-status');
    const loader = document.getElementById('loader');
    if(status) status.innerText = "Synchronisiere...";
    
    try {
        const response = await fetch(CONFIG.API_URL);
        // Prüfen, ob die Antwort wirklich JSON ist
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

// --- 2. DASHBOARD RENDERN ---
function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
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
            <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-3 text-center">Hier Stichtag anpassen</p>
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

    // JUBILÄEN
    const jubilare = appData.personnel
        .map((p, idx) => {
            const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
            const erreichtesJubiläum = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
            const bereitsEingetragen = erreichtesJubiläum && p.Ehrenzeichen && 
                                      p.Ehrenzeichen.toString().includes(erreichtesJubiläum.toString());
            return { ...p, dz, originalIndex: idx, faellig: erreichtesJubiläum, anzeigen: erreichtesJubiläum && !bereitsEingetragen };
        })
        .filter(p => p.anzeigen);

    if(jubilare.length > 0) {
        list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2">
            <span class="w-8 h-[1px] bg-slate-200"></span> 🎖️ Offene Ehrungen
        </h3>`;
        jubilare.forEach(j => {
            list.innerHTML += `
                <div onclick="showDetails(${j.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-amber-400 mb-3 active:scale-95 transition-all cursor-pointer ring-1 ring-slate-200 dark:ring-slate-700">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-black text-sm dark:text-white">${j.Name}, ${j.Vorname}</p>
                            <p class="text-[10px] text-slate-400">Dienstzeit: ${j.dz.jahre} Jahre</p>
                        </div>
                        <span class="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-lg">
                            ${j.faellig} J. FÄLLIG
                        </span>
                    </div>
                </div>`;
        });
    }

    // BEFÖRDERUNGEN
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
        list.innerHTML += `<div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-[10px] italic font-medium">Keine Ereignisse fällig.</div>`;
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

// --- 4. NAVIGATION & TOOLS ---
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

function showViewWithNav(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('text-red-700');
        b.classList.add('text-slate-400');
        if(b.getAttribute('data-view') === viewId) {
            b.classList.add('text-red-700');
            b.classList.remove('text-slate-400');
        }
    });
    if(viewId === 'personal') renderPersonalList();
}

function closeDetails() {
    document.getElementById('member-modal').classList.add('hidden');
}

function renderPersonalList() {
    const list = document.getElementById('member-list');
    const stats = document.getElementById('personal-stats');
    if(!list) return;

    const total = appData.personnel.length;
    stats.innerHTML = `
        <div class="bg-red-700 text-white p-6 rounded-3xl shadow-xl mb-4">
            <p class="text-[10px] uppercase font-black opacity-60 tracking-widest">Gesamtstärke</p>
            <h2 class="text-4xl font-black">${total} <span class="text-sm font-light opacity-80">Einsatzkräfte</span></h2>
        </div>
    `;

    list.innerHTML = appData.personnel.map((p, idx) => `
        <div onclick="showDetails(${idx})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center active:scale-95 transition-all mb-2">
            <div>
                <p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p>
                <p class="text-[10px] text-slate-400 uppercase font-bold">${p.Dienstgrad}</p>
            </div>
            <span class="text-xl">➔</span>
        </div>
    `).join('');
}

function filterPersonal() {
    const query = document.getElementById('search').value.toLowerCase();
    const cards = document.getElementById('member-list').children;
    
    appData.personnel.forEach((p, idx) => {
        const match = p.Name.toLowerCase().includes(query) || p.Vorname.toLowerCase().includes(query);
        if(cards[idx]) cards[idx].style.display = match ? 'flex' : 'none';
    });
}

// --- 5. LOGIK (PRÜFUNG & SPEICHERN) ---
function checkPromotionStatus(p) {
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    const rules = appData.promoRules.find(r => r.Vorheriger_DG && r.Vorheriger_DG.trim() === p.Dienstgrad.trim());
    if (!rules) return { isFällig: false, nextDG: "Endstufe", missing: [] };

    const missing = [];
    const wartezeit = parseFloat(rules.Wartezeit_Jahre) || 0;
    if (dz.jahre < wartezeit) missing.push(`${(wartezeit - dz.jahre).toFixed(1)} Jahre fehlen`);
    
    const gefordert = rules.Notwendiger_Lehrgang ? rules.Notwendiger_Lehrgang.trim() : "";
    if (gefordert && (!p[gefordert] || p[gefordert].toString().trim() === "")) {
        missing.push(`Lehrgang ${gefordert}`);
    }

    return {
        isFällig: missing.length === 0,
        nextDG: rules.Ziel_DG_Kurz,
        missing: missing
    };
}

async function updateStichtag() {
    const val = document.getElementById('stichtag-input').value;
    if(!val) return;
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=update_stichtag&date=${val}`);
        const res = await resp.json();
        if(res.success) {
            const info = document.getElementById('last-saved-info');
            if(info) info.innerText = "✅ Stichtag im Sheet gespeichert!";
            await fetchData();
        }
    } catch(e) { alert("Fehler beim Speichern!"); }
}

function showJubileeConfirm(index, type) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <div class="bg-amber-50 dark:bg-slate-900 border-2 border-amber-600 p-6 rounded-3xl shadow-2xl">
            <h3 class="text-amber-800 dark:text-amber-400 font-black text-xl mb-2 uppercase text-center">🎖️ Ehrung bestätigen</h3>
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-6 text-center">Wann hat <b>${p.Vorname} ${p.Name}</b> die Urkunde für <b>${type}</b> erhalten?</p>
            <input type="date" id="jubilee-date-input" class="w-full p-4 rounded-2xl border-2 border-amber-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold mb-6 text-lg text-slate-900 dark:text-white" value="${new Date().toISOString().split('T')[0]}">
            <div class="grid grid-cols-2 gap-4">
                <button onclick="showDetails(${index})" class="bg-slate-200 dark:bg-slate-700 p-4 rounded-2xl font-black uppercase text-xs">❌ Abbrechen</button>
                <button id="confirm-jubilee-btn" onclick="executeJubilee('${p.PersNr}', '${type}', ${index})" class="bg-amber-600 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg">💾 Speichern</button>
            </div>
        </div>`;
}

async function executeJubilee(persNr, type, index) {
    const dateInput = document.getElementById('jubilee-date-input');
    const btn = document.getElementById('confirm-jubilee-btn');
    if(!dateInput || !dateInput.value) return;

    const nurZahl = type.toString().replace(/[^0-9]/g, '');
    btn.innerText = "⌛...";
    btn.disabled = true;

    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=confirm_jubilee&persNr=${persNr}&jubileeType=${nurZahl}&date=${dateInput.value}`);
        const res = await resp.json();
        if(res.success) {
            btn.innerHTML = "✅ GESPEICHERT";
            await fetchData(); 
            setTimeout(() => showDetails(index), 1000);
        }
    } catch (e) { alert("Fehler!"); btn.disabled = false; }
}

function showPromotionConfirm(index, nextDG) {
    const p = appData.personnel[index];
    const content = document.getElementById('modal-content');
    content.innerHTML = `
    <div class="bg-green-50 dark:bg-slate-900 border-2 border-green-600 p-6 rounded-3xl shadow-2xl transition-all">
        <h3 class="text-green-800 dark:text-green-400 font-black text-xl mb-2 uppercase">Beförderung bestätigen</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-6">Du beförderst <b>${p.Vorname} ${p.Name}</b> zum <b>${nextDG}</b>.</p>
        <input type="date" id="promo-date-input" class="w-full p-4 rounded-2xl border-2 border-green-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold mb-6 text-lg text-slate-900 dark:text-white" value="${new Date().toISOString().split('T')[0]}">
        <div class="grid grid-cols-2 gap-4">
            <button onclick="showDetails(${index})" class="bg-slate-200 dark:bg-slate-700 p-4 rounded-2xl font-black uppercase text-xs">❌ Abbrechen</button>
            <button id="confirm-promo-btn" onclick="executePromotion('${p.PersNr}', '${nextDG}', ${index})" class="bg-green-600 text-white p-4 rounded-2xl font-black uppercase text-xs shadow-lg">🚀 Speichern</button>
        </div>
    </div>`;
}

async function executePromotion(persNr, zielDG, index) {
    const dateInput = document.getElementById('promo-date-input');
    const btn = document.getElementById('confirm-promo-btn');
    if(!dateInput || !dateInput.value) return;

    btn.innerText = "⌛...";
    btn.disabled = true;
    try {
        const resp = await fetch(`${CONFIG.API_URL}?action=promote_member&persNr=${persNr}&newDG=${zielDG}&newDate=${dateInput.value}`);
        const result = await resp.json();
        if(result.success) {
            btn.innerText = "✅ ERFOLG";
            await fetchData();
            setTimeout(closeDetails, 1000);
        }
    } catch (e) { alert("Fehler!"); btn.disabled = false; }
}

// Start
window.onload = fetchData;
