/* ======================================================================
   LAPKA LANGSIR -- state, util, shell
   ====================================================================== */

const SHIFTS = [
  { id:"malam", label:"LAPKA Malam", judulShift:"LANGSIR MALAM", jamMulai:"22:00", jamSelesai:"06:00", panelId:"panelMalam" },
  { id:"siang", label:"LAPKA Siang", judulShift:"LANGSIR SIANG", jamMulai:"14:00", jamSelesai:"22:00", panelId:"panelSiang" },
  { id:"pagi",  label:"LAPKA Pagi",  judulShift:"LANGSIR PAGI",  jamMulai:"06:00", jamSelesai:"14:00", panelId:"panelPagi"  },
];
const TAB_PEGAWAI = { id:"pegawai", label:"Input Pegawai", panelId:"panelPegawai" };
const ALL_TABS = [ TAB_PEGAWAI, ...SHIFTS ]; // Pegawai di paling kiri

const LS_KEY = "lapka_langsir_state_v1";
const ROLE_LABELS = { MAS:"MAS", KDR:"KDR", ASMAS:"ASMAS" };

let activeTab = "malam";

/* ---------------------------------------------------------------------
   STATE PER SHIFT
   sheet:        tanggal acuan (ISO yyyy-mm-dd) -- dipakai untuk semua 3 shift
                 (malam, siang, pagi dianggap pada hari yang sama di kalender;
                 nomor surat & bulan/tahun ikut tanggal ini)
   masinis/asisten: { nama, nipp } -- berlaku untuk seluruh form (langsir loko)
   ppka:         { nama, nipp }
   blocks:       daftar baris kereta, tiap blok = { kereta, roles:[{role,nama,nipp}], isLangsir }
--------------------------------------------------------------------- */
function emptyShiftData(shiftId){
  const sh = SHIFTS.find(s=>s.id===shiftId);
  return {
    noSurat: "",
    kodeStasiun: "KTG",
    jamMulai: sh.jamMulai,
    jamSelesai: sh.jamSelesai,
    masinis: { nama:"", nipp:"" },
    asisten: { nama:"", nipp:"" },
    ppka: { nama:"", nipp:"" },
    catatan: [
      "KEC LANGSIR MAX : 30 KM/JAM",
      "PLR DIPO DAPAT MEMBERIKAN SEMBOYAN/PERINTAH LANGSIR SAAT DI WILAYAH DIPO",
      "LANGSIR MELEWATI PERON / DI JALUR PUTAR / DI JALUR BONGKAR KECEPATAN MAX : 5 KM/JAM"
    ],
    blocks: [
      makeBlock("", [ {role:"MAS", nama:"", nipp:""}, {role:"KDR", nama:"", nipp:""} ]),
      makeBlock("", [ {role:"MAS", nama:"", nipp:""}, {role:"KDR", nama:"", nipp:""} ]),
      makeBlock("", [ {role:"MAS", nama:"", nipp:""}, {role:"KDR", nama:"", nipp:""} ]),
      makeBlock("LANGSIR", [ {role:"MAS", nama:"", nipp:""}, {role:"ASMAS", nama:"", nipp:""} ], true),
    ],
    mapping: {} // { blockId: { MAS:"279", KDR:"279", ASMAS:"" } } -- nomor KA asal (kedatangan)
  };
}
let blockIdCounter = 1;
function makeBlock(kereta, roles, isLangsir){
  return { id: "b" + (blockIdCounter++), kereta: kereta||"", isLangsir: !!isLangsir, roles: roles||[] };
}

function defaultState(){
  return {
    tanggal: todayISO(),
    sheetId: "",
    sheetTab: "",
    shiftData: {
      malam: emptyShiftData("malam"),
      siang: emptyShiftData("siang"),
      pagi: emptyShiftData("pagi"),
    }
  };
}

let state = defaultState();

/* ---------------------------------------------------------------------
   UTIL
--------------------------------------------------------------------- */
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isoToDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}
function addDaysISO(iso, delta){
  const d = isoToDate(iso);
  d.setDate(d.getDate()+delta);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatTglDDMMYYYY(iso){
  const [y,m,d] = iso.split("-");
  return `${d}-${m}-${y}`;
}
function formatBulanTahun(iso){
  const [y,m] = iso.split("-");
  return `${m}/${y}`;
}
function formatDateLong(iso){
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const dt = isoToDate(iso);
  return `${hari[dt.getDay()]}, ${dt.getDate()} ${bln[dt.getMonth()]} ${dt.getFullYear()}`;
}
function escapeHtml(s){ return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escapeAttr(s){ return String(s ?? "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

function saveLocal(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
}
function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.shiftData) state = parsed;
    }
  }catch(e){}
}

function toast(msg, type){
  let stack = document.getElementById("toastStack");
  if(!stack){
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.style.position = "fixed";
    stack.style.bottom = "18px";
    stack.style.right = "18px";
    stack.style.display = "flex";
    stack.style.flexDirection = "column";
    stack.style.gap = "8px";
    stack.style.zIndex = "999";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.padding = "10px 16px";
  el.style.borderRadius = "6px";
  el.style.fontSize = "13px";
  el.style.color = "#fff";
  el.style.maxWidth = "320px";
  el.style.boxShadow = "0 4px 14px rgba(0,0,0,.2)";
  el.style.background = type === "error" ? "#8a1f1f" : (type === "success" ? "#1f7a3d" : "#1a1a1a");
  stack.appendChild(el);
  setTimeout(()=>el.remove(), 4200);
}

/* ---------------------------------------------------------------------
   TAB BAR
--------------------------------------------------------------------- */
function renderTabBar(){
  const bar = document.getElementById("tabBar");
  const all = ALL_TABS;
  bar.innerHTML = all.map(t=>{
    const isPegawai = t.id === "pegawai";
    const cls = ["tab-btn"];
    if(t.id === activeTab) cls.push("active");
    if(isPegawai) cls.push("tab-pegawai");
    return `<div class="${cls.join(' ')}" data-tab="${t.id}">${escapeHtml(t.label)}</div>`;
  }).join("");
  bar.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      activeTab = btn.dataset.tab;
      updatePanelVisibility();
      renderTabBar();
    });
  });
}
function updatePanelVisibility(){
  const all = ALL_TABS;
  all.forEach(t=>{
    const panel = document.getElementById(t.panelId);
    if(!panel) return;
    panel.classList.toggle("active", t.id === activeTab);
  });
  const sh = SHIFTS.find(s=>s.id===activeTab);
  if(sh) renderShiftPanel(sh.id);
  if(activeTab === "pegawai") pegawaiInitOnce();
}

/* ======================================================================
   RENDER SATU PANEL SHIFT (config card + sheet + mapping rumus)
   ====================================================================== */
function renderShiftPanel(shiftId){
  const sh = SHIFTS.find(s=>s.id===shiftId);
  const panel = document.getElementById(sh.panelId);
  const data = state.shiftData[shiftId];

  panel.innerHTML = `
    <div class="panel-wrap">

      <div class="config-card">
        <h2>Sumber Data Pegawai (Google Spreadsheet)</h2>
        <p class="hint">
          Diambil dari sheet publik (tanpa API key) lewat metode <code>gviz/tq</code> &mdash; sama seperti
          program Pungutan. Tanggal acuan di bawah berlaku untuk ketiga shift (Malam/Siang/Pagi) sekaligus.
        </p>
        <div class="config-row">
          <div class="col">
            <label class="field-label">Spreadsheet ID</label>
            <input type="text" id="inpSheetId-${shiftId}" placeholder="contoh: 1AbCParaIDSheetKamu..." value="${escapeAttr(state.sheetId)}">
          </div>
          <div class="col narrow">
            <label class="field-label">Nama Tab / Sheet</label>
            <input type="text" id="inpSheetTab-${shiftId}" placeholder="contoh: JUNI 2026" value="${escapeAttr(state.sheetTab)}">
          </div>
          <div class="col btncol">
            <button type="button" class="small" id="btnTestConn-${shiftId}">Tes Koneksi</button>
          </div>
          <div class="col btncol">
            <button type="button" class="tiny ghost" id="btnDebug-${shiftId}" title="Lihat data mentah hasil ekstraksi">&#x1F52C; Debug</button>
          </div>
        </div>
        <div class="status-line" id="connStatus-${shiftId}">
          <span class="status-dot" id="connDot-${shiftId}"></span>
          <span id="connMsg-${shiftId}">Belum terhubung.</span>
        </div>
        <details class="help">
          <summary>Format sheet yang diharapkan</summary>
          <div class="help-body">
            Sheet harus berisi blok per KA <b>kedatangan</b> (nomor KA ganjil): satu baris header berisi
            <code>TANGGAL</code>, <code>STASIUN</code>, <code>NO KA</code> &mdash; lalu beberapa baris di bawahnya berisi
            kru (<code>NIPP</code>, <code>NAMA</code>, <code>JABATAN</code>) untuk KA itu, sampai baris header KA berikutnya.
            Kolom akan dideteksi otomatis dari label header; gunakan tombol Debug untuk memeriksa hasil deteksi.
          </div>
        </details>
      </div>

      <div class="sheet-outer">
        <div class="sheet-outer-label">
          <span>Lembar Cetak &mdash; ${escapeHtml(sh.label)}</span>
          <span class="lbl-actions">
            <button type="button" class="tiny ghost" id="btnPrint-${shiftId}">&#128424; Cetak / PDF</button>
          </span>
        </div>
        <div class="sheet" id="sheetEl-${shiftId}">
          <!-- diisi renderSheet() -->
        </div>
      </div>

      <div class="config-card">
        <h2>Rumus Mapping &mdash; Kereta Tugas &larr; KA Kedatangan</h2>
        <p class="hint">
          Dinasan kru berubah-ubah. Atur di sini: untuk tiap baris kereta pada lembar di atas,
          kru-nya (MAS/KDR/ASMAS) diambil dari KA kedatangan nomor berapa. Klik <b>Generate</b> untuk
          mengisi otomatis nama &amp; NIPP ke lembar berdasarkan rumus ini. Baris akan otomatis menyesuaikan
          jika kamu menambah/menghapus baris kereta di lembar atas.
        </p>
        <div id="mappingWrap-${shiftId}"><!-- diisi renderMapping() --></div>
        <div class="config-row" style="margin-top:12px;">
          <div class="col btncol">
            <button type="button" class="primary" id="btnGenerate-${shiftId}">&#9889; Generate dari Spreadsheet</button>
          </div>
          <div class="col btncol">
            <button type="button" class="ghost small" id="btnClearNames-${shiftId}">Kosongkan semua nama</button>
          </div>
        </div>
      </div>

    </div>
  `;

  renderSheet(shiftId);
  renderMapping(shiftId);
  wirePanelEvents(shiftId);
  updateConnStatus(shiftId);
}


/* ======================================================================
   RENDER SHEET (lembar LAPKA itu sendiri)
   ====================================================================== */
function renderSheet(shiftId){
  const sh = SHIFTS.find(s=>s.id===shiftId);
  const data = state.shiftData[shiftId];
  const el = document.getElementById(`sheetEl-${shiftId}`);

  const tglDDMM = formatTglDDMMYYYY(state.tanggal);
  const bulanTahun = formatBulanTahun(state.tanggal);

  el.innerHTML = `
    <div class="form-no">O.82</div>

    <div class="title-row">
      <div class="title-left">
        <div class="main-title">LAPORAN PERJALANAN KERETA API (LAPKA) LANGSIR</div>
        <div class="nomor-line">
          <span>No.</span>
          <span class="nomor-seg">
            <input type="text" class="nomor-input-no" id="inpNoSurat-${shiftId}"
                   placeholder="_____" maxlength="8" value="${escapeAttr(data.noSurat)}">
          </span>
          <span class="nomor-fixed">/LAPKA-LANGSIR/</span>
          <span class="nomor-seg">
            <input type="text" class="nomor-input-kode" id="inpKodeStasiun-${shiftId}"
                   maxlength="6" value="${escapeAttr(data.kodeStasiun)}">
          </span>
          <span class="nomor-fixed">/</span>
          <span class="nomor-bulan-tahun" id="bulanTahun-${shiftId}">${bulanTahun}</span>
        </div>
      </div>

      <div class="title-right">
        <div class="shift-pill-row">
          ${SHIFTS.map(s=>`<span class="shift-pill ${s.id===shiftId?'current':''}">${s.judulShift.replace('LANGSIR ','')}</span>`).join("")}
        </div>
        <div class="jam-row">
          <span class="stasiun-line">${sh.judulShift}, TGL</span>
        </div>
        <div class="jam-row">
          <span class="date-nav">
            <button type="button" class="date-arrow" id="btnDateBack-${shiftId}" title="Tanggal sebelumnya">&#9664;</button>
            <span class="date-display" id="dateDisplay-${shiftId}">${tglDDMM}</span>
            <button type="button" class="date-arrow" id="btnDateFwd-${shiftId}" title="Tanggal berikutnya">&#9654;</button>
          </span>
          <span>, PUKUL</span>
          <input type="text" class="jam-input" id="inpJamMulai-${shiftId}" maxlength="5" value="${escapeAttr(data.jamMulai)}">
          <span>-</span>
          <input type="text" class="jam-input" id="inpJamSelesai-${shiftId}" maxlength="5" value="${escapeAttr(data.jamSelesai)}">
        </div>
        <div class="jam-row">
          <span>STASIUN</span>
          <input type="text" class="jam-input" style="width:6em;" id="inpStasiunLine-${shiftId}" value="${escapeAttr(data.kodeStasiun)}">
        </div>
      </div>
    </div>

    <div class="meta-list">
      <div class="meta-row">
        <span class="meta-num">1.</span>
        <span class="meta-label">MASINIS</span>
        <span class="name-combo" style="flex:1;">
          <input type="text" class="meta-val" id="inpMasinisNama-${shiftId}" placeholder="NAMA MASINIS" value="${escapeAttr(data.masinis.nama)}" autocomplete="off">
          <div class="suggest-list" id="sugMasinis-${shiftId}"></div>
        </span>
        <span>(</span>
        <input type="text" class="meta-val" style="flex:0 0 70px;" id="inpMasinisNipp-${shiftId}" placeholder="NIPP" value="${escapeAttr(data.masinis.nipp)}">
        <span>)</span>
      </div>
      <div class="meta-row">
        <span class="meta-num">2.</span>
        <span class="meta-label">ASISTEN MASINIS</span>
        <span class="name-combo" style="flex:1;">
          <input type="text" class="meta-val" id="inpAsistenNama-${shiftId}" placeholder="NAMA ASISTEN MASINIS" value="${escapeAttr(data.asisten.nama)}" autocomplete="off">
          <div class="suggest-list" id="sugAsisten-${shiftId}"></div>
        </span>
        <span>(</span>
        <input type="text" class="meta-val" style="flex:0 0 70px;" id="inpAsistenNipp-${shiftId}" placeholder="NIPP" value="${escapeAttr(data.asisten.nipp)}">
        <span>)</span>
      </div>
      <div class="meta-row">
        <span class="meta-num">3.</span>
        <span class="meta-label">LOK LOK LANGSIR</span>
      </div>
      <div class="meta-row">
        <span class="meta-num">4.</span>
        <span class="meta-label">CATATAN LAIN DALAM PERJALANAN :</span>
      </div>
    </div>

    <div class="catatan-block" id="catatanBlock-${shiftId}"></div>

    <div class="sign-section">
      <div class="sign-col sign-left">
        <div class="sign-title">MASINIS/ASISTEN MASINIS</div>
        <div class="sign-name-row">
          <span class="lbl">Nama:</span>
          <span class="name-combo" style="flex:1;">
            <input type="text" id="inpSignMasinisNama-${shiftId}" value="${escapeAttr(data.masinis.nama)}" autocomplete="off" disabled>
          </span>
        </div>
        <div class="sign-name-row">
          <span class="lbl">Nipp:</span>
          <span>${escapeHtml(data.masinis.nipp) || "&mdash;"}</span>
        </div>
      </div>
      <div class="sign-col sign-right">
        <div class="sign-title">PPKA / PAP</div>
        <div class="sign-name-row">
          <span class="lbl">Nama:</span>
          <span class="name-combo" style="flex:1;">
            <input type="text" class="meta-val" id="inpPpkaNama-${shiftId}" placeholder="NAMA PPKA/PAP" value="${escapeAttr(data.ppka.nama)}" autocomplete="off">
            <div class="suggest-list" id="sugPpka-${shiftId}"></div>
          </span>
        </div>
        <div class="sign-name-row">
          <span class="lbl">Nipp:</span>
          <input type="text" class="meta-val" style="flex:0 0 80px;" id="inpPpkaNipp-${shiftId}" placeholder="NIPP" value="${escapeAttr(data.ppka.nipp)}">
        </div>
      </div>
    </div>

    <table class="main-table">
      <colgroup>
        <col class="col-kereta"><col class="col-role"><col class="col-nama"><col class="col-nipp"><col class="col-rowactions">
      </colgroup>
      <tbody id="blockTbody-${shiftId}"></tbody>
    </table>
    <div class="add-block-row">
      <button type="button" class="ghost small" id="btnAddBlock-${shiftId}">+ Tambah Baris Kereta</button>
    </div>
    <div class="footer-hint">Klik nama untuk mengetik manual atau pilih dari saran pegawai &middot; gunakan Generate di bawah untuk isi otomatis.</div>
  `;

  renderCatatan(shiftId);
  renderBlocks(shiftId);
  wireSheetEvents(shiftId);
}

function renderCatatan(shiftId){
  const data = state.shiftData[shiftId];
  const wrap = document.getElementById(`catatanBlock-${shiftId}`);
  wrap.innerHTML = data.catatan.map((c,idx)=>`
    <div class="catatan-line" data-idx="${idx}">
      <span class="dash">-</span>
      <input type="text" class="catatan-val" value="${escapeAttr(c)}" data-idx="${idx}">
      <button type="button" class="tiny ghost" data-action="delcat" data-idx="${idx}" title="Hapus baris catatan">&times;</button>
    </div>
  `).join("") + `
    <div class="catatan-add-row">
      <button type="button" class="tiny ghost" id="btnAddCatatan-${shiftId}">+ Tambah catatan</button>
    </div>
  `;
  wrap.querySelectorAll(".catatan-val").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      data.catatan[+inp.dataset.idx] = inp.value;
      saveLocal();
    });
  });
  wrap.querySelectorAll("[data-action='delcat']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      data.catatan.splice(+btn.dataset.idx, 1);
      saveLocal();
      renderCatatan(shiftId);
    });
  });
  const btnAdd = document.getElementById(`btnAddCatatan-${shiftId}`);
  if(btnAdd) btnAdd.addEventListener("click", ()=>{
    data.catatan.push("");
    saveLocal();
    renderCatatan(shiftId);
  });
}


/* ======================================================================
   RENDER BLOK BARIS KERETA (dinamis: tambah/hapus baris & role)
   ====================================================================== */
function renderBlocks(shiftId){
  const data = state.shiftData[shiftId];
  const tbody = document.getElementById(`blockTbody-${shiftId}`);

  let html = "";
  data.blocks.forEach((block, bIdx)=>{
    block.roles.forEach((r, rIdx)=>{
      const isFirst = rIdx === 0;
      html += `<tr data-block="${block.id}" data-role-idx="${rIdx}">`;
      if(isFirst){
        html += `<td class="cell-kereta" rowspan="${block.roles.length}">
          <input type="text" class="kereta-input" data-block="${block.id}" data-field="kereta"
                 value="${escapeAttr(block.kereta)}" placeholder="no. kereta">
        </td>`;
      }
      html += `<td class="cell-role">
        <select class="role-select" data-block="${block.id}" data-role-idx="${rIdx}">
          <option value="MAS" ${r.role==="MAS"?"selected":""}>MAS</option>
          <option value="KDR" ${r.role==="KDR"?"selected":""}>KDR</option>
          <option value="ASMAS" ${r.role==="ASMAS"?"selected":""}>ASMAS</option>
        </select>
      </td>`;
      html += `<td class="cell-nama">
        <span class="name-combo" style="width:100%;">
          <input type="text" class="name-input" data-block="${block.id}" data-role-idx="${rIdx}"
                 value="${escapeAttr(r.nama)}" placeholder="Nama" autocomplete="off">
          <div class="suggest-list" data-sug-for="${block.id}-${rIdx}"></div>
        </span>
      </td>`;
      html += `<td class="cell-nipp">
        <input type="text" class="nipp-input" data-block="${block.id}" data-role-idx="${rIdx}"
               value="${escapeAttr(r.nipp)}" placeholder="NIPP">
      </td>`;
      html += `<td class="col-rowactions">
        <div class="row-btn-group">
          ${isFirst ? `<button type="button" class="tiny ghost" data-action="addrole" data-block="${block.id}" title="Tambah baris role pada kereta ini">+role</button>` : ""}
          ${block.roles.length>1 ? `<button type="button" class="tiny ghost" data-action="delrole" data-block="${block.id}" data-role-idx="${rIdx}" title="Hapus baris role ini">&times;role</button>` : ""}
          ${isFirst ? `<button type="button" class="tiny ghost" data-action="delblock" data-block="${block.id}" title="Hapus seluruh baris kereta ini">&times;kereta</button>` : ""}
        </div>
      </td>`;
      html += `</tr>`;
    });
  });

  tbody.innerHTML = html || `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px;">Belum ada baris kereta.</td></tr>`;

  wireBlockEvents(shiftId);
}

function findBlock(shiftId, blockId){
  return state.shiftData[shiftId].blocks.find(b=>b.id===blockId);
}

function wireBlockEvents(shiftId){
  const tbody = document.getElementById(`blockTbody-${shiftId}`);

  tbody.querySelectorAll(".kereta-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const b = findBlock(shiftId, inp.dataset.block);
      if(b) b.kereta = inp.value;
      saveLocal();
      renderMapping(shiftId);
    });
  });

  tbody.querySelectorAll(".role-select").forEach(sel=>{
    sel.addEventListener("change", ()=>{
      const b = findBlock(shiftId, sel.dataset.block);
      if(b) b.roles[+sel.dataset.roleIdx].role = sel.value;
      saveLocal();
      renderMapping(shiftId);
    });
  });

  tbody.querySelectorAll(".name-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const b = findBlock(shiftId, inp.dataset.block);
      if(b) b.roles[+inp.dataset.roleIdx].nama = inp.value.toUpperCase();
      saveLocal();
      showNameSuggestions(shiftId, inp, `${inp.dataset.block}-${inp.dataset.roleIdx}`, (val)=>{
        const blk = findBlock(shiftId, inp.dataset.block);
        if(blk) blk.roles[+inp.dataset.roleIdx].nama = val.nama;
        if(blk) blk.roles[+inp.dataset.roleIdx].nipp = val.nipp;
        saveLocal();
        renderBlocks(shiftId);
      });
    });
    inp.addEventListener("blur", ()=>{ setTimeout(()=>closeSuggestList(`${inp.dataset.block}-${inp.dataset.roleIdx}`), 150); });
  });

  tbody.querySelectorAll(".nipp-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const b = findBlock(shiftId, inp.dataset.block);
      if(b) b.roles[+inp.dataset.roleIdx].nipp = inp.value;
      saveLocal();
    });
  });

  tbody.querySelectorAll("[data-action='addrole']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const b = findBlock(shiftId, btn.dataset.block);
      if(b) b.roles.push({ role:"KDR", nama:"", nipp:"" });
      saveLocal();
      renderBlocks(shiftId);
      renderMapping(shiftId);
    });
  });

  tbody.querySelectorAll("[data-action='delrole']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const b = findBlock(shiftId, btn.dataset.block);
      if(b) b.roles.splice(+btn.dataset.roleIdx, 1);
      saveLocal();
      renderBlocks(shiftId);
      renderMapping(shiftId);
    });
  });

  tbody.querySelectorAll("[data-action='delblock']").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(!confirm("Hapus seluruh baris kereta ini?")) return;
      const data = state.shiftData[shiftId];
      data.blocks = data.blocks.filter(b=>b.id !== btn.dataset.block);
      delete data.mapping[btn.dataset.block];
      saveLocal();
      renderBlocks(shiftId);
      renderMapping(shiftId);
    });
  });
}


/* ======================================================================
   RENDER MAPPING RUMUS (kereta+role -> nomor KA kedatangan asal)
   ====================================================================== */
function renderMapping(shiftId){
  const data = state.shiftData[shiftId];
  const wrap = document.getElementById(`mappingWrap-${shiftId}`);
  if(!wrap) return;

  const rows = [];
  data.blocks.forEach(block=>{
    block.roles.forEach((r, rIdx)=>{
      rows.push({ blockId:block.id, kereta: block.kereta || "(kosong)", role:r.role, rIdx });
    });
  });

  if(rows.length === 0){
    wrap.innerHTML = `<div class="mapping-empty">Belum ada baris kereta untuk dipetakan. Tambahkan dulu di lembar atas.</div>`;
    return;
  }

  if(!data.mapping) data.mapping = {};

  wrap.innerHTML = `
    <table class="mapping-table">
      <thead>
        <tr><th style="width:18%;">Kereta</th><th style="width:14%;">Role</th><th style="width:8%;"></th><th style="width:24%;">KA Kedatangan Asal</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${rows.map(row=>{
          const key = `${row.blockId}-${row.rIdx}`;
          const mapVal = (data.mapping[row.blockId] && data.mapping[row.blockId][row.rIdx]) || "";
          return `<tr>
            <td class="row-kereta">${escapeHtml(row.kereta)}</td>
            <td>${escapeHtml(row.role)}</td>
            <td class="arrow-col">&larr;</td>
            <td><input type="text" class="map-input" data-key="${escapeAttr(key)}" placeholder="cth: 279" value="${escapeAttr(mapVal)}"></td>
            <td class="match-status" data-status-for="${escapeAttr(key)}">&mdash;</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll(".map-input").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const [blockId, rIdxStr] = splitMapKey(inp.dataset.key);
      if(!data.mapping[blockId]) data.mapping[blockId] = {};
      data.mapping[blockId][rIdxStr] = inp.value.trim();
      saveLocal();
    });
  });
}
function splitMapKey(key){
  const idx = key.lastIndexOf("-");
  return [ key.slice(0, idx), key.slice(idx+1) ];
}


/* ======================================================================
   KONEKSI GOOGLE SPREADSHEET (gviz/tq) -- daftar kru per KA kedatangan
   ====================================================================== */
let sheetCache = { key:null, data:null, rawCols:null, rawRows:null };

function sheetCacheKey(){ return `${state.sheetId}::${state.sheetTab}`; }

function cellVal(cell){
  if(!cell) return "";
  if(cell.v === null || cell.v === undefined){
    return (cell.f !== null && cell.f !== undefined) ? String(cell.f).trim() : "";
  }
  if(cell.f !== undefined && cell.f !== null && cell.f !== "") return String(cell.f).trim();
  return String(cell.v).trim();
}

async function fetchGvizJSON(){
  if(!state.sheetId || !state.sheetTab){
    throw new Error("Spreadsheet ID dan nama tab belum diisi.");
  }
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.sheetId)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(state.sheetTab)}`;
  const res = await fetch(url);
  const text = await res.text();
  if(!res.ok || text.trim().startsWith("<")){
    throw new Error(`Gagal mengambil sheet (HTTP ${res.status}). Pastikan spreadsheet di-share "Anyone with the link" dan nama tab benar.`);
  }
  // gviz membungkus JSON dengan prefix non-JSON, ambil bagian {...}
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  const jsonStr = match ? match[1] : text;
  const data = JSON.parse(jsonStr);
  if(data.status === "error"){
    const msg = (data.errors && data.errors[0] && data.errors[0].detailed_message) || "Sheet/tab tidak ditemukan.";
    throw new Error(msg);
  }
  return data;
}

/* Deteksi kolom dari label header (cols[].label), lalu kelompokkan baris
   menjadi blok per KA kedatangan: baris header (TANGGAL+NO KA terisi) lalu
   baris berikutnya = kru, sampai header KA baru berikutnya. */
function parseKruSheet(gvizData){
  const cols = (gvizData.table && gvizData.table.cols) || [];
  const grows = (gvizData.table && gvizData.table.rows) || [];

  function findCol(keywords){
    for(let i=0;i<cols.length;i++){
      const lbl = (cols[i].label || "").toUpperCase().trim();
      if(keywords.some(k=>lbl.includes(k))) return i;
    }
    return -1;
  }
  const cTgl = findCol(["TANGGAL","TGL"]);
  const cStn = findCol(["STASIUN","STN"]);
  const cKa  = findCol(["NO KA","NOKA","NO_KA"]);
  const cNipp = findCol(["NIPP"]);
  const cNama = findCol(["NAMA"]);
  const cJab  = findCol(["JABATAN"]);

  const detected = { cTgl, cStn, cKa, cNipp, cNama, cJab };

  if(cKa < 0 || cNama < 0){
    const err = new Error("Kolom 'NO KA' dan/atau 'NAMA' tidak terdeteksi pada header sheet. Cek nama tab/header, atau pakai tombol Debug.");
    err.detected = detected;
    throw err;
  }

  const blocks = []; // [{ noKA, tanggal, stn, kru:[{nipp,nama,jabatan}] }]
  let cur = null;

  grows.forEach((grow)=>{
    const cells = grow.c || [];
    const get = i => i>=0 ? cellVal(cells[i]) : "";

    const tanggal = get(cTgl);
    const stn = get(cStn);
    const noKARaw = get(cKa);
    const nama = get(cNama);
    const nipp = cNipp>=0 ? get(cNipp) : "";
    const jabatan = cJab>=0 ? get(cJab) : "";

    const isHeader = noKARaw && noKARaw.toUpperCase() !== "NO KA";

    if(isHeader){
      if(cur) blocks.push(cur);
      cur = {
        noKA: noKARaw.toUpperCase().replace(/\s+/g,""),
        tanggal: tanggal || "",
        stn: stn || "",
        kru: []
      };
      if(nama){
        cur.kru.push({ nipp, nama: nama.toUpperCase(), jabatan: jabatan.toUpperCase() });
      }
    } else if(cur && nama){
      cur.kru.push({ nipp, nama: nama.toUpperCase(), jabatan: jabatan.toUpperCase() });
    }
  });
  if(cur) blocks.push(cur);

  return { blocks, detected };
}

async function loadSheetData(force){
  const key = sheetCacheKey();
  if(!force && sheetCache.key === key && sheetCache.data){
    return sheetCache.data;
  }
  const gvizData = await fetchGvizJSON();
  const parsed = parseKruSheet(gvizData);
  sheetCache = { key, data: parsed, rawCols: gvizData.table.cols, rawRows: gvizData.table.rows };
  return parsed;
}

function findKruByNoKA(parsed, noKA){
  const target = String(noKA).trim().toUpperCase().replace(/\s+/g,"");
  if(!target) return null;
  return parsed.blocks.find(b=>b.noKA === target) || null;
}

/* Cari nama dengan jabatan yang cocok (MASINIS utk MAS, KONDEKTUR utk KDR/ASMAS)
   di dalam satu blok KA. Jika tidak ketemu by jabatan, fallback ke kru pertama
   yang belum dipakai. */
function pickKruForRole(kruBlock, role, usedIdx){
  if(!kruBlock) return null;
  const wantMasinis = role === "MAS";
  let idx = kruBlock.kru.findIndex((k,i)=>{
    if(usedIdx.has(i)) return false;
    const j = k.jabatan || "";
    if(wantMasinis) return j.includes("MASINIS") && !j.includes("ASISTEN");
    return j.includes("KONDEKTUR") || j.includes("ASISTEN");
  });
  if(idx < 0){
    idx = kruBlock.kru.findIndex((k,i)=>!usedIdx.has(i));
  }
  if(idx < 0) return null;
  usedIdx.add(idx);
  return kruBlock.kru[idx];
}


/* ======================================================================
   GENERATE -- isi otomatis nama & NIPP berdasarkan mapping rumus
   ====================================================================== */
async function runGenerate(shiftId){
  const data = state.shiftData[shiftId];
  const btn = document.getElementById(`btnGenerate-${shiftId}`);
  btn.disabled = true;
  const oldLabel = btn.textContent;
  btn.textContent = "Mengambil data...";
  try{
    const parsed = await loadSheetData(false);
    let filled = 0, missing = [];

    data.blocks.forEach(block=>{
      const usedIdx = new Set();
      const mapRow = data.mapping[block.id] || {};
      block.roles.forEach((r, rIdx)=>{
        const noKA = mapRow[rIdx];
        if(!noKA) return;
        const kruBlock = findKruByNoKA(parsed, noKA);
        if(!kruBlock){
          missing.push(`Kereta ${block.kereta||'?'} (${r.role}): KA ${noKA} tidak ditemukan di sheet`);
          return;
        }
        const kru = pickKruForRole(kruBlock, r.role, usedIdx);
        if(!kru){
          missing.push(`Kereta ${block.kereta||'?'} (${r.role}): KA ${noKA} tidak punya kru tersisa`);
          return;
        }
        r.nama = kru.nama;
        r.nipp = kru.nipp;
        filled++;
      });
    });

    saveLocal();
    renderBlocks(shiftId);
    updateConnStatus(shiftId, true);

    let msg = `${filled} kolom terisi otomatis.`;
    if(missing.length){
      msg += ` ${missing.length} gagal -- bisa diisi manual.`;
      toast(msg, "error");
      console.warn("Generate -- daftar gagal:\n" + missing.join("\n"));
    } else if(filled === 0){
      toast("Tidak ada rumus mapping yang terisi. Isi kolom 'KA Kedatangan Asal' di bawah lembar dulu.", "error");
    } else {
      toast(msg, "success");
    }
  }catch(err){
    toast("Generate gagal: " + err.message + " -- silakan isi nama secara manual.", "error");
    updateConnStatus(shiftId, false, err.message);
  }finally{
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

/* ======================================================================
   AUTOCOMPLETE NAMA (dropdown saran dari hasil sheet yang sudah dimuat)
   ====================================================================== */
function allKnownNames(){
  if(!sheetCache.data) return [];
  const seen = new Map();
  sheetCache.data.blocks.forEach(b=>{
    b.kru.forEach(k=>{
      if(k.nama && !seen.has(k.nama)) seen.set(k.nama, k.nipp || "");
    });
  });
  return [...seen.entries()].map(([nama,nipp])=>({nama,nipp}));
}

function closeSuggestList(key){
  const list = document.querySelector(`[data-sug-for="${key}"]`) || document.getElementById(`sug${key}`);
  if(list) list.classList.remove("open");
}

function showNameSuggestions(shiftId, inputEl, key, onPick){
  const list = inputEl.parentElement.querySelector(".suggest-list");
  if(!list) return;
  const q = inputEl.value.trim().toUpperCase();
  const names = allKnownNames();
  const matches = q ? names.filter(n=>n.nama.includes(q)) : names.slice(0, 8);
  if(matches.length === 0 || names.length === 0){
    list.classList.remove("open");
    list.innerHTML = "";
    return;
  }
  list.innerHTML = matches.slice(0,8).map(m=>`
    <div class="suggest-item" data-nama="${escapeAttr(m.nama)}" data-nipp="${escapeAttr(m.nipp)}">
      <span>${escapeHtml(m.nama)}</span><span class="suggest-nipp">${escapeHtml(m.nipp)}</span>
    </div>
  `).join("");
  list.classList.add("open");
  list.querySelectorAll(".suggest-item").forEach(item=>{
    item.addEventListener("mousedown", (e)=>{
      e.preventDefault();
      onPick({ nama:item.dataset.nama, nipp:item.dataset.nipp });
      list.classList.remove("open");
    });
  });
}

/* ======================================================================
   DEBUG VIEWER -- tampilkan hasil ekstraksi mentah utk verifikasi kolom
   ====================================================================== */
async function openDebugView(shiftId){
  try{
    const parsed = await loadSheetData(true);
    const win = window.open("", "_blank");
    const det = parsed.detected;
    let html = `<html><head><title>Debug Sheet LAPKA</title><style>
      body{font-family:monospace;font-size:12px;padding:16px;background:#fafafa;}
      h2{font-size:14px;} table{border-collapse:collapse;width:100%;margin-bottom:18px;}
      td,th{border:1px solid #ccc;padding:4px 6px;font-size:11px;}
      th{background:#eee;} .blockhead{background:#fde9e9;font-weight:bold;}
    </style></head><body>`;
    html += `<h2>Kolom terdeteksi</h2><pre>${escapeHtml(JSON.stringify(det, null, 2))}</pre>`;
    html += `<h2>Blok KA terdeteksi (${parsed.blocks.length})</h2>`;
    parsed.blocks.forEach(b=>{
      html += `<table><tr class="blockhead"><th>NO KA</th><th>${escapeHtml(b.noKA)}</th><th>Tanggal</th><th>${escapeHtml(b.tanggal)}</th><th>Stasiun</th><th>${escapeHtml(b.stn)}</th></tr>`;
      html += `<tr><th>NIPP</th><th>NAMA</th><th>JABATAN</th></tr>`;
      b.kru.forEach(k=>{
        html += `<tr><td>${escapeHtml(k.nipp)}</td><td>${escapeHtml(k.nama)}</td><td>${escapeHtml(k.jabatan)}</td></tr>`;
      });
      html += `</table>`;
    });
    html += `</body></html>`;
    win.document.write(html);
    win.document.close();
  }catch(err){
    toast("Debug gagal: " + err.message, "error");
  }
}


/* ======================================================================
   STATUS KONEKSI
   ====================================================================== */
function updateConnStatus(shiftId, ok, errMsg){
  const dot = document.getElementById(`connDot-${shiftId}`);
  const msg = document.getElementById(`connMsg-${shiftId}`);
  if(!dot || !msg) return;
  if(ok === true){
    dot.className = "status-dot connected";
    msg.textContent = `Terhubung. ${sheetCache.data ? sheetCache.data.blocks.length : 0} blok KA termuat dari sheet.`;
  } else if(ok === false){
    dot.className = "status-dot error";
    msg.textContent = errMsg || "Gagal terhubung ke spreadsheet.";
  } else {
    dot.className = "status-dot";
    msg.textContent = state.sheetId && state.sheetTab ? "Belum dites. Klik \"Tes Koneksi\"." : "Belum diisi Spreadsheet ID & nama tab.";
  }
}

async function testConnection(shiftId){
  const dot = document.getElementById(`connDot-${shiftId}`);
  const msg = document.getElementById(`connMsg-${shiftId}`);
  dot.className = "status-dot checking";
  msg.textContent = "Menghubungkan...";
  try{
    const parsed = await loadSheetData(true);
    updateConnStatus(shiftId, true);
    toast(`Berhasil terhubung -- ${parsed.blocks.length} blok KA terdeteksi.`, "success");
    // refresh status di panel lain juga (sheetId/tab sama untuk semua shift)
    SHIFTS.forEach(s=>{ if(s.id !== shiftId) updateConnStatus(s.id, true); });
  }catch(err){
    updateConnStatus(shiftId, false, err.message);
    toast("Tes koneksi gagal: " + err.message, "error");
  }
}

/* ======================================================================
   WIRE EVENTS PER PANEL (config card, meta sheet, nomor surat, tanggal, print)
   ====================================================================== */
function wirePanelEvents(shiftId){
  const data = state.shiftData[shiftId];

  // --- config card: sheet id / tab (shared di seluruh state, sinkron ke semua shift) ---
  const inpId = document.getElementById(`inpSheetId-${shiftId}`);
  const inpTab = document.getElementById(`inpSheetTab-${shiftId}`);
  inpId.addEventListener("input", ()=>{ state.sheetId = inpId.value.trim(); saveLocal(); });
  inpTab.addEventListener("input", ()=>{ state.sheetTab = inpTab.value.trim(); saveLocal(); });

  document.getElementById(`btnTestConn-${shiftId}`).addEventListener("click", ()=>testConnection(shiftId));
  document.getElementById(`btnDebug-${shiftId}`).addEventListener("click", ()=>openDebugView(shiftId));
  document.getElementById(`btnGenerate-${shiftId}`).addEventListener("click", ()=>runGenerate(shiftId));
  document.getElementById(`btnClearNames-${shiftId}`).addEventListener("click", ()=>{
    if(!confirm("Kosongkan semua nama & NIPP pada lembar ini?")) return;
    data.blocks.forEach(b=>b.roles.forEach(r=>{ r.nama=""; r.nipp=""; }));
    saveLocal();
    renderBlocks(shiftId);
  });

  // Elemen-elemen DI DALAM kotak sheet (nomor surat, jam, tanggal, TTD, tambah baris, print)
  // di-wire dari dalam renderSheet() itu sendiri (lihat wireSheetEvents), karena innerHTML
  // sheet bisa di-render ulang sewaktu-waktu (mis. saat memilih nama dari saran).
}

function wireSheetEvents(shiftId){
  const data = state.shiftData[shiftId];

  // --- nomor surat / kode stasiun ---
  const inpNo = document.getElementById(`inpNoSurat-${shiftId}`);
  inpNo.addEventListener("input", ()=>{ data.noSurat = inpNo.value; saveLocal(); });

  const inpKode = document.getElementById(`inpKodeStasiun-${shiftId}`);
  const inpStasiunLine = document.getElementById(`inpStasiunLine-${shiftId}`);
  inpKode.addEventListener("input", ()=>{
    data.kodeStasiun = inpKode.value.toUpperCase();
    inpStasiunLine.value = data.kodeStasiun;
    saveLocal();
  });
  inpStasiunLine.addEventListener("input", ()=>{
    data.kodeStasiun = inpStasiunLine.value.toUpperCase();
    inpKode.value = data.kodeStasiun;
    saveLocal();
  });

  // --- jam ---
  document.getElementById(`inpJamMulai-${shiftId}`).addEventListener("input", (e)=>{ data.jamMulai = e.target.value; saveLocal(); });
  document.getElementById(`inpJamSelesai-${shiftId}`).addEventListener("input", (e)=>{ data.jamSelesai = e.target.value; saveLocal(); });

  // --- tanggal (shared utk semua shift) ---
  document.getElementById(`btnDateBack-${shiftId}`).addEventListener("click", ()=>{
    state.tanggal = addDaysISO(state.tanggal, -1);
    saveLocal();
    SHIFTS.forEach(s=>{ if(document.getElementById(`dateDisplay-${s.id}`)) updateDateDisplay(s.id); });
  });
  document.getElementById(`btnDateFwd-${shiftId}`).addEventListener("click", ()=>{
    state.tanggal = addDaysISO(state.tanggal, 1);
    saveLocal();
    SHIFTS.forEach(s=>{ if(document.getElementById(`dateDisplay-${s.id}`)) updateDateDisplay(s.id); });
  });

  // --- masinis / asisten / ppka ---
  // Nama & NIPP masinis ditampilkan ulang juga di blok TTD kiri (read-only) --
  // update langsung elemen itu saat mengetik, tanpa re-render seluruh sheet (supaya fokus tidak hilang).
  const inpMasNama = document.getElementById(`inpMasinisNama-${shiftId}`);
  const signNamaEl = document.getElementById(`inpSignMasinisNama-${shiftId}`);
  inpMasNama.addEventListener("input", ()=>{
    data.masinis.nama = inpMasNama.value.toUpperCase();
    saveLocal();
    if(signNamaEl) signNamaEl.value = data.masinis.nama;
    showNameSuggestions(shiftId, inpMasNama, "sugMasinis", (val)=>{
      data.masinis.nama = val.nama;
      data.masinis.nipp = val.nipp;
      saveLocal();
      renderSheet(shiftId);
    });
  });
  inpMasNama.addEventListener("blur", ()=>{ setTimeout(()=>closeSuggestList("sugMasinis"), 150); });

  document.getElementById(`inpMasinisNipp-${shiftId}`).addEventListener("input", (e)=>{
    data.masinis.nipp = e.target.value;
    saveLocal();
    const nippDisplay = document.querySelector(`#sheetEl-${shiftId} .sign-left .sign-name-row:last-child span:last-child`);
    if(nippDisplay) nippDisplay.textContent = data.masinis.nipp || "\u2014";
  });

  wireNameField(shiftId, "inpAsistenNama", "sugAsisten", data.asisten, null, shiftId);
  document.getElementById(`inpAsistenNipp-${shiftId}`).addEventListener("input", (e)=>{ data.asisten.nipp = e.target.value; saveLocal(); });

  wireNameField(shiftId, "inpPpkaNama", "sugPpka", data.ppka, null, shiftId);
  document.getElementById(`inpPpkaNipp-${shiftId}`).addEventListener("input", (e)=>{ data.ppka.nipp = e.target.value; saveLocal(); });

  // --- tambah baris kereta ---
  document.getElementById(`btnAddBlock-${shiftId}`).addEventListener("click", ()=>{
    data.blocks.push(makeBlock("", [ {role:"MAS", nama:"", nipp:""}, {role:"KDR", nama:"", nipp:""} ]));
    saveLocal();
    renderBlocks(shiftId);
    renderMapping(shiftId);
  });

  // --- print ---
  document.getElementById(`btnPrint-${shiftId}`).addEventListener("click", ()=>{
    window.print();
  });
}

function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function wireNameField(shiftId, inputId, sugId, targetObj, onPick, _shiftId){
  const inp = document.getElementById(`${inputId}-${shiftId}`);
  if(!inp) return;
  inp.addEventListener("input", ()=>{
    targetObj.nama = inp.value.toUpperCase();
    saveLocal();
    showNameSuggestions(shiftId, inp, sugId, (val)=>{
      targetObj.nama = val.nama;
      targetObj.nipp = val.nipp;
      saveLocal();
      renderSheet(shiftId);
      if(onPick) onPick(val);
    });
  });
  inp.addEventListener("blur", ()=>{ setTimeout(()=>closeSuggestList(sugId), 150); });
}

function updateDateDisplay(shiftId){
  const el = document.getElementById(`dateDisplay-${shiftId}`);
  if(el) el.textContent = formatTglDDMMYYYY(state.tanggal);
  const bt = document.getElementById(`bulanTahun-${shiftId}`);
  if(bt) bt.textContent = formatBulanTahun(state.tanggal);
}

/* ======================================================================
   TAB: INPUT PEGAWAI
   Diadaptasi dari index_input_pegawai.html -- data {jabatan:[], orang:[]}
   disimpan ke repo GitHub terpisah (inputpegawai/data.json) lewat token
   yang disimpan di localStorage browser (TIDAK pernah ditulis ke file ini).
   Ini berfungsi sebagai daftar pegawai master/cadangan -- independen dari
   sumber data Spreadsheet yang dipakai tombol Generate di 3 tab LAPKA.
   ====================================================================== */
const PG_REPO_OWNER = "catkaujungtimur";
const PG_REPO_NAME = "inputpegawai";
const PG_DATA_PATH = "data.json";
const PG_LS_TOKEN_KEY = "inputpegawai_pat_v1";
const PG_LS_DATA_KEY = "inputpegawai_localdata_v1";

let pgState = { jabatan: ["PLR","PLR DIPO","SCHOWING","MASINIS","KONDEKTUR","PPKA"], orang: [] };
let pgSha = null;
let pgDirty = false;
let pgInited = false;

function pgEscapeHtml(s){ return escapeHtml(s); }
function pgEscapeAttr(s){ return escapeAttr(s); }
function pgToast(msg, type){ toast(msg, type); }
function pgGetToken(){ return localStorage.getItem(PG_LS_TOKEN_KEY) || ""; }
function pgSaveLocalData(){ try{ localStorage.setItem(PG_LS_DATA_KEY, JSON.stringify(pgState)); }catch(e){} }
function pgLoadLocalData(){
  try{
    const raw = localStorage.getItem(PG_LS_DATA_KEY);
    if(raw) pgState = JSON.parse(raw);
  }catch(e){}
}
function pgMarkDirty(){ pgDirty = true; pgUpdateStatusBar(); }

function pgUpdateStatusBar(){
  const dot = document.getElementById("pgStatusDot");
  const msg = document.getElementById("pgStatusMsg");
  if(!dot || !msg) return;
  const token = pgGetToken();
  if(!token){
    dot.className = "pg-status-dot";
    msg.textContent = "Belum ada token GitHub -- data hanya tersimpan di browser ini sampai token diatur.";
    return;
  }
  if(pgDirty){
    dot.className = "pg-status-dot error";
    msg.textContent = "Ada perubahan yang belum disimpan ke GitHub. Klik \"Simpan ke GitHub\" di bawah.";
    return;
  }
  dot.className = "pg-status-dot connected";
  msg.textContent = "Token tersedia. Data sinkron dengan GitHub.";
}

/* ---------------------------------------------------------------------
   RENDER SHELL (sekali saja saat pertama kali tab dibuka)
--------------------------------------------------------------------- */
function pegawaiInitOnce(){
  if(pgInited) return;
  pgInited = true;
  pgLoadLocalData();
  pgRenderShell();
  pgUpdateStatusBar();
  pgLoadFromGithub();
}

function pgRenderShell(){
  const panel = document.getElementById("panelPegawai");
  panel.innerHTML = `
    <div class="panel-wrap">
      <div class="pg-wrap">

        <div class="pg-status-bar" id="pgStatusBarEl">
          <span class="pg-status-dot" id="pgStatusDot"></span>
          <span class="pg-msg" id="pgStatusMsg">Memeriksa token tersimpan&hellip;</span>
          <button class="pg-linklike" id="pgBtnTokenSettings" type="button">Atur token</button>
        </div>

        <div class="pg-card" id="pgTokenCard" style="display:none;">
          <h2>Token GitHub</h2>
          <p class="pg-hint">
            Token disimpan di browser kamu sendiri (localStorage), tidak dikirim ke server manapun selain langsung ke GitHub.
            Dibutuhkan supaya halaman ini bisa menyimpan perubahan ke repo <code>${PG_REPO_NAME}</code>.
            Jangan pernah menempelkan token ke file ini atau ke tempat lain yang bisa dibaca orang lain.
          </p>
          <div class="pg-token-row">
            <input type="password" id="pgInpToken" placeholder="github_pat_...">
            <button id="pgBtnSaveToken" type="button">Simpan token</button>
            <button id="pgBtnClearToken" type="button" class="pg-ghost">Hapus token</button>
          </div>
          <details class="help">
            <summary>Cara membuat token</summary>
            <div class="help-body">
              1. GitHub &rarr; foto profil &rarr; <b>Settings</b> &rarr; <b>Developer settings</b> &rarr; <b>Personal access tokens</b> &rarr; <b>Fine-grained tokens</b> &rarr; <b>Generate new token</b>.<br>
              2. <b>Repository access</b>: pilih <i>Only select repositories</i> &rarr; pilih repo <code>${PG_REPO_NAME}</code>.<br>
              3. <b>Permissions</b> &rarr; <b>Repository permissions</b> &rarr; cari <b>Contents</b> &rarr; ubah ke <b>Read and write</b>.<br>
              4. <b>Generate token</b>, lalu copy token-nya (hanya tampil sekali) dan paste di kolom atas.
            </div>
          </details>
        </div>

        <div class="pg-card">
          <h2>Tambah Satu Data</h2>
          <p class="pg-hint">Isi salah satu dulu (NIPP atau Nama), sisanya bisa menyusul &mdash; lalu lengkapi jabatan dan simpan.</p>
          <div class="pg-form-grid">
            <div>
              <label class="pg-field-label">NIPP</label>
              <input type="text" id="pgInpNipp" placeholder="contoh: 12345" inputmode="numeric">
            </div>
            <div>
              <label class="pg-field-label">Nama</label>
              <input type="text" id="pgInpNama" placeholder="contoh: PSEUDO EMPEROR" style="text-transform:uppercase;">
            </div>
            <div>
              <label class="pg-field-label">Jabatan</label>
              <div class="pg-jabatan-row">
                <select id="pgInpJabatan"></select>
                <button type="button" class="pg-ghost pg-small" id="pgBtnTambahJabatan" title="Tambah jabatan baru">+ Jabatan</button>
              </div>
            </div>
            <div>
              <button type="button" id="pgBtnTambahSatu">Tambah</button>
            </div>
          </div>
        </div>

        <div class="pg-card">
          <h2>Input Massal</h2>
          <p class="pg-hint">
            Paste banyak baris sekaligus, format <b>NIPP</b>&nbsp;[tab/koma]&nbsp;<b>NAMA</b>&nbsp;[tab/koma]&nbsp;<b>JABATAN</b> per baris
            (bisa langsung copy-paste dari Excel/Spreadsheet, atau pisahkan dengan koma). Baris pertama boleh berupa header (NIPP, NAMA, JABATAN) &mdash; akan otomatis dilewati.
            Jabatan yang belum dikenal otomatis ditambahkan ke daftar jabatan.
          </p>
          <textarea id="pgInpMassal" rows="8" placeholder="NIPP&#9;NAMA&#9;JABATAN"></textarea>
          <div class="pg-actions-row">
            <button type="button" id="pgBtnProsesMassal">Proses &amp; Tambahkan</button>
            <span class="pg-count-pill" id="pgMassalPreviewCount"></span>
          </div>
        </div>

        <div class="pg-card">
          <h2 class="pg-collapsible-head" id="pgDaftarDataHead">
            <span class="pg-collapse-arrow" id="pgDaftarDataArrow">&#9656;</span> Daftar Data <span class="pg-count-pill" id="pgTotalCount"></span>
          </h2>
          <div id="pgDaftarDataBody" style="display:none;">
            <div class="pg-search-row">
              <input type="text" id="pgFilterText" placeholder="Cari nama atau NIPP...">
              <select id="pgFilterJabatan"><option value="">Semua jabatan</option></select>
            </div>
            <div id="pgTableWrap"></div>
            <div class="pg-actions-row">
              <button type="button" class="pg-danger pg-ghost" id="pgBtnHapusSemua">Hapus semua data</button>
            </div>
          </div>
        </div>

        <div class="pg-card">
          <h2>Export / Import (cadangan pribadi)</h2>
          <p class="pg-hint">
            Simpan salinan data ke file di perangkatmu sebagai jaring pengaman pribadi &mdash; berguna kalau suatu saat
            data di GitHub perlu dipulihkan. Ini terpisah dari "Simpan ke GitHub" di bawah; export/import TIDAK otomatis
            mengirim apapun ke GitHub.
          </p>
          <div class="pg-actions-row">
            <button type="button" id="pgBtnExport" class="pg-ghost">Export ke file JSON</button>
            <button type="button" id="pgBtnImportTrigger" class="pg-ghost">Import dari file JSON</button>
            <input type="file" id="pgFileImport" accept=".json" style="display:none;">
          </div>
        </div>

        <div class="pg-card">
          <h2>Simpan ke GitHub</h2>
          <p class="pg-hint">Perubahan di atas baru tersimpan di browser ini. Klik tombol di bawah untuk mengirim (commit) ke repo <code>${PG_REPO_NAME}</code>.</p>
          <div class="pg-actions-row">
            <button type="button" id="pgBtnSimpanGithub" class="pg-success">Simpan ke GitHub</button>
            <button type="button" id="pgBtnMuatUlang" class="pg-ghost">Muat ulang dari GitHub</button>
          </div>
        </div>

      </div>
    </div>
  `;

  pgRenderJabatanOptions();
  pgRenderTable();
  pgWireEvents();
}

/* ---------------------------------------------------------------------
   JABATAN
--------------------------------------------------------------------- */
function pgRenderJabatanOptions(){
  const sel = document.getElementById("pgInpJabatan");
  const prev = sel.value;
  sel.innerHTML = pgState.jabatan.map(j=>`<option value="${pgEscapeAttr(j)}">${pgEscapeHtml(j)}</option>`).join("");
  if(pgState.jabatan.includes(prev)) sel.value = prev;

  const filterSel = document.getElementById("pgFilterJabatan");
  const prevFilter = filterSel.value;
  filterSel.innerHTML = `<option value="">Semua jabatan</option>` +
    pgState.jabatan.map(j=>`<option value="${pgEscapeAttr(j)}">${pgEscapeHtml(j)}</option>`).join("");
  filterSel.value = prevFilter;
}

/* ---------------------------------------------------------------------
   INPUT MASSAL
--------------------------------------------------------------------- */
function pgParseMassalLine(line){
  let parts = line.split("\t").map(s=>s.trim());
  if(parts.length < 3) parts = line.split(",").map(s=>s.trim());
  if(parts.length < 3) return null;
  const [nipp, nama, jabatan] = parts;
  if(!nipp && !nama) return null;
  return { nipp: nipp.trim(), nama: nama.trim().toUpperCase(), jabatan: jabatan.trim().toUpperCase() };
}
function pgIsHeaderLine(parsed){
  const s = (parsed.nipp + parsed.nama + parsed.jabatan).toUpperCase();
  return s.includes("NIPP") && s.includes("NAMA");
}

/* ---------------------------------------------------------------------
   TABEL
--------------------------------------------------------------------- */
function pgRenderTable(){
  const wrap = document.getElementById("pgTableWrap");
  if(!wrap) return;
  const filterText = document.getElementById("pgFilterText").value.trim().toUpperCase();
  const filterJabatan = document.getElementById("pgFilterJabatan").value;

  const rows = pgState.orang
    .map((o, idx)=>({ ...o, idx }))
    .filter(o=>{
      if(filterJabatan && o.jabatan !== filterJabatan) return false;
      if(filterText){
        const hay = (o.nipp + " " + o.nama).toUpperCase();
        if(!hay.includes(filterText)) return false;
      }
      return true;
    })
    .sort((a,b)=> a.nama.localeCompare(b.nama));

  document.getElementById("pgTotalCount").textContent = `(${pgState.orang.length} total)`;

  if(rows.length === 0){
    wrap.innerHTML = `<div class="pg-empty-state">Belum ada data yang cocok. Tambahkan lewat form di atas.</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="pg-data">
      <thead><tr><th style="width:110px;">NIPP</th><th>Nama</th><th style="width:140px;">Jabatan</th><th style="width:90px;"></th></tr></thead>
      <tbody>
        ${rows.map(o => `
          <tr data-idx="${o.idx}">
            <td class="pg-nipp">${pgEscapeHtml(o.nipp) || "<span style='color:var(--muted)'>&mdash;</span>"}</td>
            <td>${pgEscapeHtml(o.nama) || "<span style='color:var(--muted)'>&mdash;</span>"}</td>
            <td><span class="pg-badge">${pgEscapeHtml(o.jabatan)}</span></td>
            <td class="pg-col-actions">
              <button class="pg-ghost pg-small" data-pgaction="edit" data-idx="${o.idx}">Edit</button>
              <button class="pg-danger pg-ghost pg-small" data-pgaction="del" data-idx="${o.idx}">Hapus</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* ---------------------------------------------------------------------
   EVENTS (dipasang sekali saat shell pertama kali dirender)
--------------------------------------------------------------------- */
function pgWireEvents(){
  document.getElementById("pgBtnTokenSettings").addEventListener("click", ()=>{
    const card = document.getElementById("pgTokenCard");
    card.style.display = card.style.display === "none" ? "block" : "none";
  });
  document.getElementById("pgBtnSaveToken").addEventListener("click", ()=>{
    const v = document.getElementById("pgInpToken").value.trim();
    if(!v){ pgToast("Token kosong, tidak disimpan.", "error"); return; }
    localStorage.setItem(PG_LS_TOKEN_KEY, v);
    document.getElementById("pgInpToken").value = "";
    pgToast("Token disimpan di browser ini.", "success");
    pgUpdateStatusBar();
    pgLoadFromGithub();
  });
  document.getElementById("pgBtnClearToken").addEventListener("click", ()=>{
    localStorage.removeItem(PG_LS_TOKEN_KEY);
    pgToast("Token dihapus.");
    pgUpdateStatusBar();
  });

  document.getElementById("pgBtnTambahJabatan").addEventListener("click", ()=>{
    const nama = prompt("Nama jabatan baru:");
    if(!nama) return;
    const trimmed = nama.trim().toUpperCase();
    if(!trimmed) return;
    if(pgState.jabatan.includes(trimmed)){ pgToast("Jabatan itu sudah ada."); return; }
    pgState.jabatan.push(trimmed);
    pgRenderJabatanOptions();
    document.getElementById("pgInpJabatan").value = trimmed;
    pgSaveLocalData();
    pgMarkDirty();
    pgToast(`Jabatan "${trimmed}" ditambahkan.`, "success");
  });

  document.getElementById("pgBtnTambahSatu").addEventListener("click", ()=>{
    const nipp = document.getElementById("pgInpNipp").value.trim();
    const nama = document.getElementById("pgInpNama").value.trim().toUpperCase();
    const jabatan = document.getElementById("pgInpJabatan").value;
    if(!nipp && !nama){ pgToast("Isi NIPP atau Nama dulu.", "error"); return; }
    if(!jabatan){ pgToast("Pilih jabatan dulu.", "error"); return; }

    const dup = pgState.orang.find(o => (nipp && o.nipp === nipp));
    if(dup){
      if(!confirm(`NIPP ${nipp} sudah terdaftar atas nama ${dup.nama} (${dup.jabatan}). Timpa data ini?`)) return;
      dup.nama = nama || dup.nama;
      dup.jabatan = jabatan;
    } else {
      pgState.orang.push({ nipp, nama, jabatan });
    }
    document.getElementById("pgInpNipp").value = "";
    document.getElementById("pgInpNama").value = "";
    pgSaveLocalData();
    pgMarkDirty();
    pgRenderTable();
    pgToast("Ditambahkan.", "success");
  });

  document.getElementById("pgInpMassal").addEventListener("input", ()=>{
    const lines = document.getElementById("pgInpMassal").value.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
    document.getElementById("pgMassalPreviewCount").textContent = lines.length > 0 ? `${lines.length} baris terdeteksi` : "";
  });
  document.getElementById("pgBtnProsesMassal").addEventListener("click", ()=>{
    const raw = document.getElementById("pgInpMassal").value;
    const lines = raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
    if(lines.length === 0){ pgToast("Tidak ada baris untuk diproses.", "error"); return; }

    let added = 0, updated = 0, skipped = 0, jabatanBaru = [];
    lines.forEach((line, idx)=>{
      const parsed = pgParseMassalLine(line);
      if(!parsed){ skipped++; return; }
      if(idx === 0 && pgIsHeaderLine(parsed)){ return; }
      if(!parsed.nipp && !parsed.nama){ skipped++; return; }

      if(parsed.jabatan && !pgState.jabatan.includes(parsed.jabatan)){
        pgState.jabatan.push(parsed.jabatan);
        jabatanBaru.push(parsed.jabatan);
      }

      const existing = parsed.nipp ? pgState.orang.find(o => o.nipp === parsed.nipp) : null;
      if(existing){
        existing.nama = parsed.nama || existing.nama;
        existing.jabatan = parsed.jabatan || existing.jabatan;
        updated++;
      } else {
        pgState.orang.push(parsed);
        added++;
      }
    });

    pgRenderJabatanOptions();
    pgRenderTable();
    pgSaveLocalData();
    pgMarkDirty();
    document.getElementById("pgInpMassal").value = "";
    document.getElementById("pgMassalPreviewCount").textContent = "";

    let msg = `${added} data ditambahkan, ${updated} diperbarui`;
    if(skipped) msg += `, ${skipped} baris dilewati (format tidak dikenali)`;
    if(jabatanBaru.length) msg += `. Jabatan baru: ${jabatanBaru.join(", ")}`;
    pgToast(msg, "success");
  });

  document.getElementById("pgFilterText").addEventListener("input", pgRenderTable);
  document.getElementById("pgFilterJabatan").addEventListener("change", pgRenderTable);

  document.getElementById("pgTableWrap").addEventListener("click", e=>{
    const btn = e.target.closest("button[data-pgaction]");
    if(!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const o = pgState.orang[idx];
    if(!o) return;

    if(btn.dataset.pgaction === "del"){
      if(!confirm(`Hapus data ${o.nama || o.nipp}?`)) return;
      pgState.orang.splice(idx, 1);
      pgSaveLocalData();
      pgMarkDirty();
      pgRenderTable();
      pgToast("Data dihapus.");
      return;
    }

    if(btn.dataset.pgaction === "edit"){
      const newNipp = prompt("NIPP:", o.nipp) ?? o.nipp;
      const newNama = (prompt("Nama:", o.nama) ?? o.nama).toUpperCase();
      const newJabatan = (prompt(`Jabatan (${pgState.jabatan.join(", ")}):`, o.jabatan) ?? o.jabatan).toUpperCase();
      o.nipp = newNipp.trim();
      o.nama = newNama.trim();
      o.jabatan = newJabatan.trim();
      if(o.jabatan && !pgState.jabatan.includes(o.jabatan)){
        pgState.jabatan.push(o.jabatan);
        pgRenderJabatanOptions();
      }
      pgSaveLocalData();
      pgMarkDirty();
      pgRenderTable();
      pgToast("Data diperbarui.", "success");
    }
  });

  document.getElementById("pgBtnHapusSemua").addEventListener("click", ()=>{
    if(pgState.orang.length === 0) return;
    if(!confirm(`Hapus SEMUA ${pgState.orang.length} data? Tindakan ini tidak bisa dibatalkan kecuali kamu belum menyimpan ke GitHub.`)) return;
    pgState.orang = [];
    pgSaveLocalData();
    pgMarkDirty();
    pgRenderTable();
    pgToast("Semua data dihapus dari tampilan lokal.");
  });

  document.getElementById("pgDaftarDataHead").addEventListener("click", ()=>{
    const body = document.getElementById("pgDaftarDataBody");
    const arrow = document.getElementById("pgDaftarDataArrow");
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    arrow.innerHTML = isOpen ? "&#9656;" : "&#9662;";
  });

  document.getElementById("pgBtnExport").addEventListener("click", pgExportToFile);
  document.getElementById("pgBtnImportTrigger").addEventListener("click", ()=>{
    document.getElementById("pgFileImport").click();
  });
  document.getElementById("pgFileImport").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    pgImportFromFile(file);
    e.target.value = "";
  });

  document.getElementById("pgBtnSimpanGithub").addEventListener("click", pgSaveToGithub);
  document.getElementById("pgBtnMuatUlang").addEventListener("click", ()=>{
    if(pgDirty && !confirm("Ada perubahan lokal yang belum disimpan ke GitHub. Muat ulang akan menimpa perubahan itu. Lanjutkan?")) return;
    pgLoadFromGithub();
  });
}

/* ---------------------------------------------------------------------
   EXPORT / IMPORT JSON (cadangan pribadi)
--------------------------------------------------------------------- */
function pgExportToFile(){
  const blob = new Blob([JSON.stringify(pgState, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  a.href = url;
  a.download = `data-pegawai_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  pgToast("File JSON diunduh.", "success");
}
function pgImportFromFile(file){
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const parsed = JSON.parse(ev.target.result);
      if(!parsed || !Array.isArray(parsed.orang)){ throw new Error("format tidak sesuai (tidak ada 'orang')"); }
      if(!confirm(`Import akan MENGGANTI seluruh data yang sedang tampil (${pgState.orang.length} data) dengan isi file ini (${parsed.orang.length} data). Perubahan ini belum tersimpan ke GitHub sampai kamu klik "Simpan ke GitHub". Lanjutkan?`)) return;
      pgState = {
        jabatan: Array.isArray(parsed.jabatan) && parsed.jabatan.length ? parsed.jabatan : ["PLR","PLR DIPO","SCHOWING","MASINIS","KONDEKTUR","PPKA"],
        orang: parsed.orang
      };
      pgSaveLocalData();
      pgRenderJabatanOptions();
      pgRenderTable();
      pgMarkDirty();
      pgToast(`${parsed.orang.length} data berhasil di-import dari file. Klik "Simpan ke GitHub" untuk menyimpannya secara permanen.`, "success");
    }catch(err){
      pgToast("Gagal membaca file JSON: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

/* ---------------------------------------------------------------------
   GITHUB API
--------------------------------------------------------------------- */
async function pgLoadFromGithub(){
  const token = pgGetToken();
  const url = `https://api.github.com/repos/${PG_REPO_OWNER}/${PG_REPO_NAME}/contents/${PG_DATA_PATH}`;
  try{
    const res = await fetch(url, {
      headers: token ? { "Authorization": `Bearer ${token}`, "Accept":"application/vnd.github+json" } : { "Accept":"application/vnd.github+json" }
    });
    if(res.status === 404){
      pgToast("data.json belum ada di repo -- akan dibuat saat pertama kali Simpan ke GitHub.", "");
      pgSha = null;
      return;
    }
    if(!res.ok){
      pgToast(`Gagal memuat dari GitHub (${res.status}). Memakai data lokal.`, "error");
      return;
    }
    const json = await res.json();
    pgSha = json.sha;
    const content = decodeURIComponent(escape(atob(json.content)));
    const parsed = JSON.parse(content);
    if(parsed && Array.isArray(parsed.orang)){
      pgState = parsed;
      pgDirty = false;
      pgSaveLocalData();
      pgRenderJabatanOptions();
      pgRenderTable();
      pgUpdateStatusBar();
      pgToast("Data dimuat dari GitHub.", "success");
    }
  }catch(e){
    pgToast("Gagal terhubung ke GitHub. Memakai data lokal (browser ini).", "error");
  }
}

async function pgSaveToGithub(){
  const token = pgGetToken();
  if(!token){
    pgToast("Belum ada token GitHub. Klik \"Atur token\" dulu.", "error");
    document.getElementById("pgTokenCard").style.display = "block";
    return;
  }
  const btn = document.getElementById("pgBtnSimpanGithub");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  try{
    const url = `https://api.github.com/repos/${PG_REPO_OWNER}/${PG_REPO_NAME}/contents/${PG_DATA_PATH}`;
    const body = {
      message: `Update data pegawai (${new Date().toISOString()})`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(pgState, null, 2)))),
    };
    if(pgSha) body.sha = pgSha;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if(!res.ok){
      const errJson = await res.json().catch(()=>({}));
      throw new Error(errJson.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    pgSha = json.content ? json.content.sha : pgSha;
    pgDirty = false;
    pgUpdateStatusBar();
    pgToast("Tersimpan ke GitHub.", "success");
  }catch(e){
    pgToast("Gagal menyimpan ke GitHub: " + e.message, "error");
  }finally{
    btn.disabled = false;
    btn.textContent = "Simpan ke GitHub";
  }
}

/* ======================================================================
   INIT
   ====================================================================== */
loadLocal();
renderTabBar();
updatePanelVisibility();
