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
  appData.personnel.sort((a,b) => a.Name.localeCompare(b.Name)).forEach(p => {
    list.innerHTML += `
      <div class="member-item bg-white dark:bg-slate-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
        <div><p class="font-bold text-sm">${p.Name}, ${p.Vorname}</p><p class="text-[10px] text-slate-400">${p.Dienstgrad}</p></div>
        <span class="text-xs opacity-30 italic">Details ➔</span>
      </div>`;
  });
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
