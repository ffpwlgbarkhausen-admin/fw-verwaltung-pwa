// ANALYSE: Ersetze diesen Link durch deine Web-App URL aus Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbxA8lHhtAXoGKTCkN1s4thQH-qWQYeNS3QkySUDpB-2_3mrAuy2cuuWBy4UjR4xpjeR/exec"; 

let appData = {}; 

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

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${name}`);
  if(targetView) targetView.classList.add('active');
  
  // Header Titel anpassen
  const title = document.getElementById('header-title');
  if(title) title.innerText = name === 'home' ? 'LG13 PRO' : 'PERSONALVERWALTUNG';
}

function renderDashboard() {
  const stichtagElement = document.getElementById('stichtag-display');
  if(stichtagElement) stichtagElement.innerText = new Date(appData.stichtag).toLocaleDateString('de-DE');
  
  const list = document.getElementById('promo-list');
  if(!list) return;
  list.innerHTML = "";

  appData.personnel.forEach(p => {
    const promo = checkPromotionStatus(p);
    if (promo.isFällig) {
      list.innerHTML += `
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-orange-500">
          <h4 class="font-bold">${p.Name}, ${p.Vorname}</h4>
          <p class="text-xs text-slate-500">${p.Dienstgrad} ➔ <span class="text-orange-600 font-bold">${promo.nextDG}</span></p>
        </div>`;
    }
  });
}

function renderPersonal() {
  const list = document.getElementById('member-list');
  const statsDiv = document.getElementById('personal-stats');
  if(!list || !statsDiv) return;
  
  list.innerHTML = "";
  const total = appData.personnel.length;
  const abteilungen = {};

  appData.personnel.forEach(p => {
    abteilungen[p.Abteilung] = (abteilungen[p.Abteilung] || 0) + 1;
  });

  statsDiv.innerHTML = `
    <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
      <p class="text-[10px] uppercase text-slate-400 font-bold">Gesamt</p>
      <p class="text-xl font-black text-red-700">${total}</p>
    </div>
    <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden text-ellipsis">
      <p class="text-[10px] uppercase text-slate-400 font-bold">Abteilungen</p>
      <p class="text-[9px] font-medium leading-tight text-slate-600 dark:text-slate-300">
        ${Object.entries(abteilungen).map(([n, v]) => `${n}: ${v}`).join(' | ')}
      </p>
    </div>
  `;

  appData.personnel.sort((a,b) => a.Name.localeCompare(b.Name)).forEach((p, index) => {
    const promo = checkPromotionStatus(p);
    list.innerHTML += `
      <div onclick="showDetails(${index})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm mb-2 border-l-4 ${promo.isFällig ? 'border-orange-500 bg-orange-50/20' : 'border-transparent'} active:scale-95 transition-all">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="font-bold text-sm text-slate-800 dark:text-white">${p.Name}, ${p.Vorname}</p>
            ${promo.isFällig ? '<span class="text-orange-500 text-xs">⭐</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">${p.Abteilung || 'Keine Abt.'} | ${p.Dienstgrad}</p>
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
    // 1. Zeitprüfung
    const stichtag = new Date(appData.stichtag);
    const letzteBef = new Date(p.Letzte_Befoerderung);
    const jahre = (stichtag - letzteBef) / (1000 * 60 * 60 * 24 * 365.25);
    const zeitOK = jahre >= parseFloat(rule.Wartezeit_Jahre);

    // 2. Dynamische Lehrgangsprüfung in den Einzelspalten
    const geforderterLehrgang = rule.Notwendiger_Lehrgang;
    let lehrgangOK = true;

    if (geforderterLehrgang && geforderterLehrgang !== "") {
      // Wir schauen direkt in der Spalte nach, die so heißt wie der geforderte Lehrgang
      // Beispiel: Wenn in der Regel "Truppführer" steht, prüfen wir p["Truppführer"]
      const zertifikat = p[geforderterLehrgang];
      
      // Ein Lehrgang gilt als vorhanden, wenn die Spalte nicht leer ist
      lehrgangOK = (zertifikat !== undefined && zertifikat !== null && zertifikat !== "");
    }

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
  const content = document.getElementById('modal-content');
  const cleanPhone = p.Telefon ? p.Telefon.toString().replace(/\s+/g, '') : '';

  // 1. HILFSFUNKTIONEN
  const formatDateClean = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    const raw = dateStr.split('T')[0]; 
    if (raw.includes('-') && raw.split('-')[0].length === 4) {
      const [y, m, d] = raw.split('-');
      return `${d}.${m}.${y}`;
    }
    return raw;
  };

  const getDienstzeitInfo = (eintrittStr) => {
    if (!eintrittStr || eintrittStr === '-') return { text: '-', isJubilaeum: false };
    
    try {
      // Datum parsen (dd.mm.yyyy)
      const parts = eintrittStr.split('.');
      const eintrittDate = new Date(parts[2], parts[1] - 1, parts[0]);
      const stichtagDate = new Date(appData.stichtag);
      
      const jahre = Math.floor((stichtagDate - eintrittDate) / (1000 * 60 * 60 * 24 * 365.25));
      
      if (jahre < 0) return { text: "0 J.", isJubilaeum: false };

      // Deine Jubiläums-Liste
      const jubilaeen = [25, 35, 40, 50, 60, 70, 75, 80];
      const isJubilaeum = jubilaeen.includes(jahre);
      
      return { 
        text: jahre + " J.", 
        isJubilaeum: isJubilaeum 
      };
    } catch (e) { return { text: "-", isJubilaeum: false }; }
  };

  const dz = getDienstzeitInfo(p.Eintritt);
  const lehrgangsListe = ["Probezeit", "Grundausbildung", "Truppführer", "Gruppenführer", "Zugführer", "Verbandsführer 1", "Verbandsführer 2"];

  // 2. HTML STRUKTUR (Auszug der Stammdaten-Sektion)
  // Ersetze den unteren Teil deines innerHTML durch diesen:

  content.innerHTML = `
    ${content.innerHTML} 

    <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl mt-4">
      <div>
        <p class="text-slate-400 uppercase font-bold">Geburtstag</p>
        <p class="font-medium">${formatDateClean(p.Geburtstag)}</p>
      </div>
      <div class="${dz.isJubilaeum ? 'ring-2 ring-yellow-400 ring-offset-2 rounded-lg p-1 bg-yellow-50 dark:bg-yellow-900/20' : ''}">
        <p class="text-slate-400 uppercase font-bold flex items-center gap-1">
          Bef. | Dienstzeit ${dz.isJubilaeum ? '🎖️' : ''}
        </p>
        <p class="font-medium">
          ${formatDateClean(p.Letzte_Befoerderung)} | 
          <span class="${dz.isJubilaeum ? 'text-yellow-600 font-black animate-bounce inline-block' : 'text-red-700 font-bold'}">
            ${dz.text}
          </span>
        </p>
      </div>
    </div>`;
  
  document.getElementById('member-modal').classList.remove('hidden');
}

function closeDetails() {
  document.getElementById('member-modal').classList.add('hidden');
}

function filterPersonal() {
  const s = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.member-item').forEach(i => {
    i.style.display = i.innerText.toLowerCase().includes(s) ? 'flex' : 'none';
  });
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}
