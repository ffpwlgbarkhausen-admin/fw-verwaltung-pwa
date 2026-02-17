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
    alert("Fehler beim Laden der Daten. Prüfe die API-URL.");
  }
}

function initUI() {
  document.getElementById('loader').classList.add('hidden');
  showView('home');
  renderDashboard();
  renderPersonal();
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

function renderDashboard() {
  document.getElementById('stichtag-display').innerText = new Date(appData.stichtag).toLocaleDateString('de-DE');
  const list = document.getElementById('promo-list');
  list.innerHTML = "";

  appData.personnel.forEach(p => {
    // Hier greift deine im Sheet definierte Logik
    const rules = appData.promoRules.filter(r => r.Vorheriger_DG === p.Dienstgrad);
    rules.forEach(rule => {
      const diffJahre = (new Date(appData.stichtag) - new Date(p.Letzte_Befoerderung)) / (1000 * 60 * 60 * 24 * 365.25);
      const lehrgangOk = !rule.Notwendiger_Lehrgang || (p.Lehrgaenge && p.Lehrgaenge.includes(rule.Notwendiger_Lehrgang));

      if (diffJahre >= rule.Wartezeit_Jahre && lehrgangOk) {
        list.innerHTML += `
          <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border-l-4 border-red-700">
            <h4 class="font-bold">${p.Name}, ${p.Vorname}</h4>
            <p class="text-xs text-slate-500">${p.Dienstgrad} ➔ <span class="text-red-700 font-bold">${rule.Ziel_DG_Kurz}</span></p>
          </div>`;
      }
    });
  });
}

function renderPersonal() {
  const list = document.getElementById('member-list');
  const statsDiv = document.getElementById('personal-stats');
  list.innerHTML = "";
  
  // Statistik berechnen
  const total = appData.personnel.length;
  const abteilungen = {};
  appData.personnel.forEach(p => {
    abteilungen[p.Abteilung] = (abteilungen[p.Abteilung] || 0) + 1;
  });

  statsDiv.innerHTML = `
    <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
      <p class="text-[10px] uppercase text-slate-400 font-bold">Gesamtstärke</p>
      <p class="text-xl font-black text-red-700">${total}</p>
    </div>
    <div class="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <p class="text-[10px] uppercase text-slate-400 font-bold">Abteilungen</p>
      <p class="text-[10px] truncate">${Object.entries(abteilungen).map(([n, v]) => `${n}: ${v}`).join(' | ')}</p>
    </div>
  `;
  // Hilfsfunktion zur Beförderungsprüfung
function checkPromotionStatus(p) {
  const rules = appData.promoRules.filter(r => r.Vorheriger_DG === p.Dienstgrad);
  let status = { isFällig: false, nextDG: "", missing: [] };

  rules.forEach(rule => {
    const jahre = (new Date(appData.stichtag) - new Date(p.Letzte_Befoerderung)) / (1000 * 60 * 60 * 24 * 365.25);
    const zeitOK = jahre >= rule.Wartezeit_Jahre;
    const lehrgangOK = !rule.Notwendiger_Lehrgang || (p.Lehrgaenge && p.Lehrgaenge.includes(rule.Notwendiger_Lehrgang));

    if (zeitOK && lehrgangOK) {
      status.isFällig = true;
      status.nextDG = rule.Ziel_DG_Kurz;
    } else if (zeitOK && !lehrgangOK) {
      status.nextDG = rule.Ziel_DG_Kurz;
      status.missing.push(`Lehrgang: ${rule.Notwendiger_Lehrgang}`);
    }
  });
  return status;
}
  
  // Liste rendern
  appData.personnel.sort((a,b) => a.Name.localeCompare(b.Name)).forEach((p, index) => {
    // Prüfen ob Beförderung fällig (wie im Dashboard)
    const canPromote = checkPromotionStatus(p);

    list.innerHTML += `
      <div onclick="showDetails(${index})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm mb-2 border border-transparent ${canPromote.isFällig ? 'border-orange-400 bg-orange-50/30' : ''}">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="font-bold text-sm">${p.Name}, ${p.Vorname}</p>
            ${canPromote.isFällig ? '<span class="text-orange-500 text-xs">⭐</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 font-medium">${p.Abteilung} | ${p.Dienstgrad}</p>
        </div>
        <div class="text-right">
           <span class="text-red-700 text-lg opacity-50">➔</span>
        </div>
      </div>`;
  });
}

function filterPersonal() {
  const s = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.member-item').forEach(i => {
    i.style.display = i.innerText.toLowerCase().includes(s) ? 'flex' : 'none';
  });
}

function showDetails(index) {
  const p = appData.personnel[index];
  const promo = checkPromotionStatus(p);
  const content = document.getElementById('modal-content');
  
  content.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-black">${p.Name}, ${p.Vorname}</h2>
      <p class="text-red-700 font-bold">${p.Abteilung} • ${p.Dienstgrad}</p>
    </div>
    
    <div class="space-y-4">
      <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-100 dark:bg-green-900/20' : 'bg-slate-100 dark:bg-slate-700/50'}">
        <p class="text-[10px] uppercase font-bold text-slate-500">Beförderungs-Check</p>
        <p class="text-sm font-bold">Ziel: ${promo.nextDG || 'Kein Ziel definiert'}</p>
        ${promo.isFällig ? '<p class="text-green-600 text-xs font-bold mt-1">✓ Alle Bedingungen erfüllt!</p>' : ''}
        ${promo.missing.length > 0 ? `<p class="text-red-600 text-xs font-bold mt-1">⚠ Es fehlt: ${promo.missing.join(', ')}</p>` : ''}
      </div>

      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><p class="text-[10px] text-slate-400 uppercase font-bold">Geburtstag</p><p>${p.Geburtsdatum || '-'}</p></div>
        <div><p class="text-[10px] text-slate-400 uppercase font-bold">Eintritt</p><p>${p.Eintrittsdatum || '-'}</p></div>
      </div>

      <div>
        <p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Vorhandene Lehrgänge</p>
        <div class="flex flex-wrap gap-1">
          ${(p.Lehrgaenge || '').split(',').map(l => `<span class="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-[10px]">${l.trim()}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
  document.getElementById('member-modal').classList.remove('hidden');
}

function closeDetails() {
  document.getElementById('member-modal').classList.add('hidden');
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}
