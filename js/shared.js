// =====================
// GLOBAL VARIABLES
// =====================
let sbData, sbApp, CONFIG;

let currentUser = null;
let users = [];
let assignments = {};
let assignmentDates = {};
let allCS = [];
let selectedCS = [];
let currentCRM = '';
let orders = [];
let filtered = [];
let filteredOrders = [];
let allOrders = [];
let editId = null;
let selectedOrders = new Set();
let currentPage = 1;
let rowsPerPage = 20;

// =====================
// INIT SUPABASE
// =====================
async function initSupabase() {
    try {
        const response = await fetch('/api/config');
        CONFIG = await response.json();

        const { createClient } = supabase;
        sbData = createClient(CONFIG.DATA_SUPABASE_URL, CONFIG.DATA_SUPABASE_KEY);
        sbApp = createClient(CONFIG.APP_SUPABASE_URL, CONFIG.APP_SUPABASE_KEY);
    } catch (error) {
        console.error('Failed to load config:', error);
        alert('Failed to load configuration. Please refresh the page.');
    }
}

// =====================
// AUTH
// =====================
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const { data } = await sbApp.from('users').select('*').eq('username', username).eq('password', password).single();

    if (!data) return alert('Username/password salah!');

    currentUser = data;
    sessionStorage.setItem('user', JSON.stringify(data));

    if (data.role === 'admin') {
        window.location.href = 'admin.html';
    } else if (data.role === 'spv') {
        window.location.href = 'spv.html';
    } else if (data.role === 'crm') {
        window.location.href = 'crm.html';
    } else {
        alert('Role tidak dikenali!');
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
}

// =====================
// LOAD USERS
// =====================
async function loadUsers() {
    const { data } = await sbApp.from('users').select('*').order('username');
    if (data) users = data;
}

// =====================
// LOAD ASSIGNMENTS
// =====================
async function loadAssignments() {
    const { data } = await sbApp.from('crm_assignments').select('*');
    if (data) {
        assignments = {};
        assignmentDates = {};

        data.forEach(i => {
            if (!assignments[i.crm_name]) {
                assignments[i.crm_name] = [];
                assignmentDates[i.crm_name] = [];
            }
            assignments[i.crm_name].push(i.cs_name);
            assignmentDates[i.crm_name].push({
                cs: i.cs_name,
                produk: i.produk,
                dateFrom: i.date_from,
                dateTo: i.date_to
            });
        });
    }
}

// =====================
// HELPERS
// =====================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function extractProduk(jumlahText) {
    if (!jumlahText) return null;

    let match = jumlahText.match(/NEW\s+(.+)/i);
    if (match) return match[1].trim().toUpperCase();

    match = jumlahText.match(/^\d+\s+\w+\s+(.+)/i);
    if (match) return match[1].trim().toUpperCase();

    return jumlahText.trim().toUpperCase();
}

function extractEkspedisi(pembayaran) {
    if (!pembayaran) return null;

    const words = pembayaran.trim().split(/\s+/);
    const firstWord = words[0].toUpperCase();

    if (['COD', 'TRANSFER', 'TUNAI'].includes(firstWord)) {
        return words[1] ? words[1].toUpperCase() : null;
    }

    return firstWord;
}

// =====================
// DATE RANGE PICKER
// =====================
const DRP_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DRP_DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

let drp = {
    startDate: null,
    endDate: null,
    hoverDate: null,
    selecting: false,
    activePreset: null,
    leftYear: null,
    leftMonth: null
};

function drpToday() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function drpFmt(date) {
    if (!date) return '—';
    const d = date.getDate().toString().padStart(2,'0');
    const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][date.getMonth()];
    return `${d} ${m} ${date.getFullYear()}`;
}

function drpToStr(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = (date.getMonth()+1).toString().padStart(2,'0');
    const d = date.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${d}`;
}

function drpSetPreset(key) {
    const today = drpToday();
    drp.activePreset = key;
    switch (key) {
        case 'today':
            drp.startDate = today; drp.endDate = today; break;
        case 'yesterday': {
            const y = new Date(today); y.setDate(y.getDate()-1);
            drp.startDate = y; drp.endDate = y; break;
        }
        case '7days': {
            const s = new Date(today); s.setDate(s.getDate()-6);
            drp.startDate = s; drp.endDate = today; break;
        }
        case '14days': {
            const s = new Date(today); s.setDate(s.getDate()-13);
            drp.startDate = s; drp.endDate = today; break;
        }
        case '28days': {
            const s = new Date(today); s.setDate(s.getDate()-27);
            drp.startDate = s; drp.endDate = today; break;
        }
        case '30days': {
            const s = new Date(today); s.setDate(s.getDate()-29);
            drp.startDate = s; drp.endDate = today; break;
        }
        case 'thisweek': {
            const s = new Date(today); s.setDate(s.getDate() - today.getDay());
            const e = new Date(s); e.setDate(e.getDate()+6);
            drp.startDate = s; drp.endDate = e; break;
        }
        case 'lastweek': {
            const e = new Date(today); e.setDate(e.getDate() - today.getDay() - 1);
            const s = new Date(e); s.setDate(s.getDate()-6);
            drp.startDate = s; drp.endDate = e; break;
        }
        case 'thismonth':
            drp.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            drp.endDate   = new Date(today.getFullYear(), today.getMonth()+1, 0); break;
        case 'lastmonth':
            drp.startDate = new Date(today.getFullYear(), today.getMonth()-1, 1);
            drp.endDate   = new Date(today.getFullYear(), today.getMonth(), 0); break;
    }
    drp.selecting = false;
    if (drp.startDate) {
        drp.leftYear  = drp.startDate.getFullYear();
        drp.leftMonth = drp.startDate.getMonth();
    }
}

function drpApplyToInputs() {
    document.getElementById('adminDateFrom').value = drpToStr(drp.startDate);
    document.getElementById('adminDateTo').value   = drpToStr(drp.endDate);
    const label = document.getElementById('datePickerLabel');
    if (label) {
        if (drp.startDate && drp.endDate) {
            label.textContent = drpToStr(drp.startDate) === drpToStr(drp.endDate)
                ? drpFmt(drp.startDate)
                : `${drpFmt(drp.startDate)} – ${drpFmt(drp.endDate)}`;
        }
    }
}

function syncDateLabel2() {
    const lbl = document.getElementById('datePickerLabel2');
    const main = document.getElementById('datePickerLabel');
    if (lbl && main) lbl.textContent = main.textContent;
}

function toggleDatePicker(btn) {
    if (document.getElementById('drpContainer')) { closeDatePicker(); return; }
    if (!drp.leftYear) {
        const t = drpToday();
        drp.leftYear  = t.getFullYear();
        drp.leftMonth = t.getMonth();
    }
    const overlay = document.createElement('div');
    overlay.className = 'drp-overlay';
    overlay.id = 'drpOverlay';
    overlay.onclick = closeDatePicker;
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    container.className = 'drp-container';
    container.id = 'drpContainer';
    const rect = btn.getBoundingClientRect();
    container.style.top  = (rect.bottom + 6) + 'px';
    container.style.left = Math.min(rect.left, window.innerWidth - 760) + 'px';
    container.onclick = e => e.stopPropagation();
    document.body.appendChild(container);
    drpRender();

    window.addEventListener('scroll', closeDatePicker, { capture: true, once: true });
}

function closeDatePicker() {
    document.getElementById('drpOverlay')?.remove();
    document.getElementById('drpContainer')?.remove();
    window.removeEventListener('scroll', closeDatePicker, true);
}

function drpClickDay(dateStr) {
    const clicked = new Date(dateStr + 'T00:00:00');
    drp.activePreset = null;
    if (!drp.selecting || !drp.startDate) {
        drp.startDate = clicked;
        drp.endDate   = null;
        drp.selecting = true;
    } else {
        if (clicked < drp.startDate) {
            drp.endDate   = drp.startDate;
            drp.startDate = clicked;
        } else {
            drp.endDate = clicked;
        }
        drp.selecting = false;
    }
    drpRender();
}

function drpHoverDay(dateStr) {
    if (drp.selecting) {
        drp.hoverDate = new Date(dateStr + 'T00:00:00');
        drpRender();
    }
}

function drpNavMonth(dir) {
    const d = new Date(drp.leftYear, drp.leftMonth + dir, 1);
    drp.leftYear  = d.getFullYear();
    drp.leftMonth = d.getMonth();
    drpRender();
}

function drpApply() {
    if (!drp.startDate || !drp.endDate) { alert('Pilih tanggal mulai dan selesai!'); return; }
    drpApplyToInputs();
    syncDateLabel2();
    closeDatePicker();

    if (typeof updateAssignmentStats === 'function') {
        updateAssignmentStats();
    }
}

function drpRenderCal(year, month) {
    const today     = drpToday();
    const firstDay  = new Date(year, month, 1).getDay();
    const lastDay   = new Date(year, month+1, 0).getDate();
    const prevLast  = new Date(year, month, 0).getDate();

    let html = DRP_DAYS.map(d => `<div class="drp-day-hdr">${d}</div>`).join('');

    for (let i = firstDay-1; i >= 0; i--) {
        const d = prevLast - i;
        const s = drpToStr(new Date(year, month-1, d));
        html += `<div class="drp-day drp-other" onclick="drpClickDay('${s}')" onmouseenter="drpHoverDay('${s}')">${d}</div>`;
    }

    for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, month, d);
        const s    = drpToStr(date);
        let cls    = 'drp-day';
        if (s === drpToStr(today)) cls += ' drp-today';

        const rangeEnd = drp.endDate || (drp.selecting ? drp.hoverDate : null);
        if (drp.startDate && rangeEnd) {
            const lo = drp.startDate <= rangeEnd ? drp.startDate : rangeEnd;
            const hi = drp.startDate <= rangeEnd ? rangeEnd : drp.startDate;
            const sLo = drpToStr(lo), sHi = drpToStr(hi);
            if (s === sLo && s === sHi) cls += ' drp-sel';
            else if (s === sLo) cls += ' drp-range-start';
            else if (s === sHi) cls += ' drp-range-end';
            else if (date > lo && date < hi) cls += ' drp-in-range';
        } else if (drp.startDate && s === drpToStr(drp.startDate)) {
            cls += ' drp-sel';
        }

        html += `<div class="${cls}" onclick="drpClickDay('${s}')" onmouseenter="drpHoverDay('${s}')">${d}</div>`;
    }

    return `
        <div>
            <div style="text-align:center;font-weight:700;font-size:13px;color:#1e293b;margin-bottom:10px;">
                ${DRP_MONTHS[month]} ${year}
            </div>
            <div class="drp-month-grid">${html}</div>
        </div>`;
}

function drpRender() {
    const c = document.getElementById('drpContainer');
    if (!c) return;

    const right = (() => {
        const d = new Date(drp.leftYear, drp.leftMonth+1, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    })();

    const presets = [
        { key:'today',     label:'Hari Ini' },
        { key:'yesterday', label:'Kemarin' },
        { key:'7days',     label:'7 hari terakhir' },
        { key:'14days',    label:'14 hari terakhir' },
        { key:'28days',    label:'28 hari terakhir' },
        { key:'30days',    label:'30 hari terakhir' },
        { key:'thisweek',  label:'Minggu ini' },
        { key:'lastweek',  label:'Minggu lalu' },
        { key:'thismonth', label:'Bulan ini' },
        { key:'lastmonth', label:'Bulan lalu' },
    ];

    const rangeEnd = drp.endDate || (drp.selecting ? drp.hoverDate : null);
    const startLbl = drpFmt(drp.startDate);
    const endLbl   = drpFmt(rangeEnd);

    c.innerHTML = `
        <div class="drp-presets">
            <div style="padding:10px 18px 6px;font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.06em;">PRESET</div>
            ${presets.map(p => `
                <div class="drp-preset-item ${drp.activePreset===p.key?'drp-active':''}" onclick="drpSetPreset('${p.key}');drpRender();">
                    <input type="radio" name="drp-preset" ${drp.activePreset===p.key?'checked':''}>
                    ${p.label}
                </div>
            `).join('')}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;min-width:520px;">
            <div style="padding:20px;display:flex;align-items:flex-start;gap:12px;">
                <button onclick="drpNavMonth(-1)" class="btn btn-secondary btn-small" style="margin-top:4px;">&#8249;</button>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;flex:1;">
                    ${drpRenderCal(drp.leftYear, drp.leftMonth)}
                    ${drpRenderCal(right.y, right.m)}
                </div>
                <button onclick="drpNavMonth(1)" class="btn btn-secondary btn-small" style="margin-top:4px;">&#8250;</button>
            </div>
            <div class="drp-footer">
                <div>
                    <div style="font-size:13px;font-weight:600;color:#334155;">
                        ${startLbl} &nbsp;–&nbsp; ${endLbl}
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Tanggal ditampilkan dalam Waktu Jakarta</div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="closeDatePicker()" class="btn btn-secondary">Batal</button>
                    <button onclick="drpApply()" class="btn btn-primary">Update</button>
                </div>
            </div>
        </div>
    `;
}
