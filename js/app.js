/**
 * HAUPTDATEI: App-Logik & UI-Steuerung
 */

let appData = { personnel: [], stichtag: "", promoRules: [] };

async function fetchData() {
    const status = document.getElementById('sync-status');
    if(status) status.innerText = "Synchronisiere...";
    try {
        const response = await fetch(CONFIG.API_URL + "?action=read");
        appData = await response.json();
        if(status) status.innerText = "Verbunden";
        renderDashboard();
    } catch (e) {
        if(status) status.innerText = "Offline";
    }
}

function renderDashboard() {
    const list = document.getElementById('promo-list');
    if(!list) return;
    
    // Stichtag-Input (Exakt wie in deiner TXT)
    let dateVal = appData.stichtag || "";
    if(dateVal.includes('.')) {
        const p = dateVal.split('.');
        dateVal = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    }

    list.innerHTML = `
        <div class="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8">
            <p class="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-3 text-center">Stichtag anpassen</p>
            <div class="flex gap-2">
                <input type="date" id="stichtag-input" value="${dateVal}" class="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 text-sm font-bold">
                <button onclick="updateStichtag()" class="bg-red-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase">Speichern</button>
            </div>
        </div>
    `;

    // JUBILÄEN RENDERN (Mit deinen Icons)
    const jubilare = (appData.personnel || []).map((p, idx) => {
        const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
        const erreicht = [...CONFIG.JUBILAEEN].reverse().find(m => m <= dz.jahre);
        const erledigt = erreicht && p.Ehrenzeichen && p.Ehrenzeichen.toString().includes(erreicht.toString());
        return { ...p, dz, originalIndex: idx, erreicht, anzeigen: erreicht && !erledigt };
    }).filter(p => p.anzeigen);

    if(jubilare.length > 0) {
        list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">🎖️ Offene Ehrungen</h3>`;
        jubilare.forEach(j => {
            list.innerHTML += `
                <div onclick="showDetails(${j.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-amber-400 mb-3 active:scale-95 transition-all">
                    <div class="flex justify-between items-start">
                        <div><p class="font-black text-sm dark:text-white">${j.Name}, ${j.Vorname}</p><p class="text-[10px] text-slate-400">Dienstzeit: ${j.dz.text}</p></div>
                        <span class="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-lg">${j.erreicht} J. FÄLLIG</span>
                    </div>
                </div>`;
        });
    }

    // BEFÖRDERUNGEN RENDERN
    const bereit = (appData.personnel || []).map((p, idx) => ({ ...p, promo: checkPromotionStatus(p), originalIndex: idx })).filter(p => p.promo.isFällig);
    list.innerHTML += `<h3 class="text-[10px] font-black uppercase text-slate-400 mb-3 mt-6 tracking-widest">📋 Beförderungen</h3>`;
    if(bereit.length > 0) {
        bereit.forEach(p => {
            list.innerHTML += `
                <div onclick="showDetails(${p.originalIndex})" class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-green-500 mb-3 active:scale-95 transition-all">
                    <p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p>
                    <p class="text-xs mt-1"><span class="text-slate-400">${p.Dienstgrad}</span> ➔ <span class="text-green-600 font-black">${p.promo.nextDG}</span></p>
                </div>`;
        });
    } else {
        list.innerHTML += `<div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-[10px] italic">Keine Ereignisse fällig.</div>`;
    }
}

// --- HILFSFUNKTIONEN FÜR LOGIK ---
function checkPromotionStatus(p) {
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    const rules = appData.promoRules.find(r => r.Vorheriger_DG?.trim() === p.Dienstgrad?.trim());
    if (!rules) return { isFällig: false, nextDG: "Endstufe" };
    
    const missing = [];
    if (dz.jahre < parseFloat(rules.Wartezeit_Jahre)) missing.push("Wartezeit");
    const lehrgang = rules.Notwendiger_Lehrgang?.trim();
    if (lehrgang && (!p[lehrgang] || p[lehrgang] === "" || p[lehrgang] === "-")) missing.push("Lehrgang");
    
    return { isFällig: missing.length === 0, nextDG: rules.Ziel_DG_Kurz };
}

// --- PERSONAL-LISTE & FILTER ---
function renderPersonalList() {
    const list = document.getElementById('member-list');
    if(!list) return;
    list.innerHTML = appData.personnel.map((p, idx) => `
        <div onclick="showDetails(${idx})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex justify-between items-center mb-2" data-name="${p.Name} ${p.Vorname}">
            <div><p class="font-black text-sm dark:text-white">${p.Name}, ${p.Vorname}</p><p class="text-[10px] text-slate-400">${p.Dienstgrad}</p></div>
            <span class="text-xl">➔</span>
        </div>
    `).join('');
}

function filterPersonal() {
    const q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('.member-item').forEach(i => {
        i.style.display = i.getAttribute('data-name').toLowerCase().includes(q) ? 'flex' : 'none';
    });
}

// --- MODAL & AKTIONEN ---
function showDetails(idx) {
    const p = appData.personnel[idx];
    const dz = AppUtils.getDienstzeit(p.Eintritt, p.Pausen_Jahre);
    const promo = checkPromotionStatus(p);
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-black dark:text-white">${p.Name}, ${p.Vorname}</h2>
            <p class="text-red-700 font-bold uppercase text-xs">${p.Dienstgrad}</p>
        </div>
        <div class="space-y-4">
            <div class="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Dienstzeit</p>
                <p class="text-lg font-black dark:text-white">${dz.text}</p>
            </div>
            <div class="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Historie</p>
                <p class="text-xs dark:text-slate-300 italic">${p.Historie || 'Keine Einträge'}</p>
            </div>
        </div>
    `;
    document.getElementById('member-modal').classList.remove('hidden');
}

async function updateStichtag() {
    const val = document.getElementById('stichtag-input').value;
    const res = await fetch(`${CONFIG.API_URL}?action=update_stichtag&date=${val}`);
    if((await res.json()).success) fetchData();
}

function showViewWithNav(v) {
    document.querySelectorAll('.view').forEach(x => x.classList.add('hidden'));
    document.getElementById(`view-${v}`).classList.remove('hidden');
    if(v === 'personal') renderPersonalList();
}

function closeDetails() { document.getElementById('member-modal').classList.add('hidden'); }
function toggleDarkMode() { document.documentElement.classList.toggle('dark'); }
window.onload = fetchData;
