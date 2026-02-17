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
      <p class="text-[10px] truncate font-medium text-slate-600 dark:text-slate-300">
        ${Object.entries(abteilungen).map(([n, v]) => `${n}: ${v}`).join(' | ')}
      </p>
    </div>
  `;

  // Liste rendern
  appData.personnel.sort((a,b) => a.Name.localeCompare(b.Name)).forEach((p, index) => {
    const promo = checkPromotionStatus(p);

    list.innerHTML += `
      <div onclick="showDetails(${index})" class="member-item bg-white dark:bg-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm mb-2 border-l-4 ${promo.isFällig ? 'border-orange-500 bg-orange-50/20' : 'border-transparent'} active:scale-95 transition-all">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <p class="font-bold text-sm text-slate-800 dark:text-white">${p.Name}, ${p.Vorname}</p>
            ${promo.isFällig ? '<span class="text-orange-500 text-xs" title="Beförderung fällig">⭐</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">${p.Abteilung} | ${p.Dienstgrad}</p>
        </div>
        <div class="text-right">
           <span class="text-red-700 text-lg opacity-30 font-black">➔</span>
        </div>
      </div>`;
  });
}
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
  
  // Telefonnummer bereinigen (Leerzeichen entfernen)
  const cleanPhone = p.Telefon ? p.Telefon.replace(/\s+/g, '') : '';

  content.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-black">${p.Name}, ${p.Vorname}</h2>
      <p class="text-red-700 font-bold">${p.Abteilung} • ${p.Dienstgrad}</p>
    </div>
    
    <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      
      <div class="grid grid-cols-2 gap-3">
        <a href="tel:${cleanPhone}" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-slate-100 dark:bg-slate-700 p-4 rounded-2xl font-bold gap-2 active:scale-95 transition-transform">
          <span>📞</span> Anrufen
        </a>
        <a href="https://wa.me/${cleanPhone.replace('+', '').replace(/^00/, '')}" target="_blank" class="${p.Telefon ? 'flex' : 'hidden'} items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold gap-2 active:scale-95 transition-transform">
          <span>💬</span> WhatsApp
        </a>
      </div>

      <div class="p-4 rounded-2xl ${promo.isFällig ? 'bg-green-100 dark:bg-green-900/20 border-l-4 border-green-500' : 'bg-slate-100 dark:bg-slate-700/50 border-l-4 border-slate-400'}">
        <p class="text-[10px] uppercase font-bold text-slate-500">Beförderungs-Check zum ${new Date(appData.stichtag).toLocaleDateString('de-DE')}</p>
        <div class="flex justify-between items-end mt-1">
          <p class="text-sm font-bold">Ziel: <span class="text-red-700">${promo.nextDG || 'Endstufe'}</span></p>
        </div>
        ${promo.isFällig ? 
          '<p class="text-green-600 text-[10px] font-bold mt-2 italic">✓ Alle Kriterien (Zeit & Lehrgang) erfüllt.</p>' : 
          (promo.missing.length > 0 ? `<p class="text-red-600 text-[10px] font-bold mt-2">⚠ Fehlend: ${promo.missing.join(', ')}</p>` : '<p class="text-slate-500 text-[10px] mt-2 italic">Keine weitere Beförderung geplant.</p>')
        }
      </div>

      <div class="grid grid-cols-2 gap-4 text-sm bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
        <div><p class="text-[10px] text-slate-400 uppercase font-bold">Geburtstag</p><p>${p.Geburtsdatum || '-'}</p></div>
        <div><p class="text-[10px] text-slate-400 uppercase font-bold">Letzte Bef.</p><p>${p.Letzte_Befoerderung || '-'}</p></div>
      </div>

      <div>
        <p class="text-[10px] text-slate-400 uppercase font-bold mb-2 ml-1">Lehrgangs-Portfolio</p>
        <div class="flex flex-wrap gap-1">
          ${p.Lehrgaenge ? p.Lehrgaenge.split(',').map(l => 
            `<span class="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 px-2 py-1 rounded-lg text-[10px] border border-red-100 dark:border-red-900/30">${l.trim()}</span>`
          ).join('') : '<p class="text-xs text-slate-400 italic">Keine Daten hinterlegt</p>'}
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
