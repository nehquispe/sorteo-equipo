const SUITS = [
  { id: "hearts", name: "Corazones", symbol: "♥", color: "red", bg: "#fff4f4" },
  { id: "diamonds", name: "Diamantes", symbol: "♦", color: "red", bg: "#fff5f5" },
  { id: "clubs", name: "Tréboles", symbol: "♣", color: "black", bg: "#f7f7fa" },
  { id: "spades", name: "Espadas", symbol: "♠", color: "black", bg: "#f3f3f6" },
];

const sample18 = ["Julio", "Marco", "Ana", "Lucía", "Carlos", "Elena", "Diego", "Paola", "Miguel", "Rosa", "Luis", "Sofía", "Jorge", "Carmen", "Pedro", "Valeria", "Andrés", "Diana"];
const STEPS = ["Participantes", "Organizar grupos", "Asignar cartas", "Equipos finales"];
let state = loadState();
let dragId = null;
let holdTimer = null;
let selectedPeople = new Set();

function initialState() {
  return { size: 18, step: 1, people: [], groups: Array.from({ length: 6 }, () => []), assignments: {} };
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("sorteo-equipos-v1"));
    if (saved && [12, 18, 24].includes(saved.size)) return saved;
  } catch (_) {}
  return initialState();
}
function save() { localStorage.setItem("sorteo-equipos-v1", JSON.stringify(state)); }
function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function targetPerGroup() { return state.size / 6; }
function activeSuits() {
  if (state.size === 12) return [SUITS[0], SUITS[2]];
  return SUITS.slice(0, targetPerGroup());
}
function rankLabel(groupIndex) { return groupIndex === 0 ? "A" : String(groupIndex + 1); }
function person(id) { return state.people.find(p => p.id === id); }
function groupOf(id) { return state.groups.findIndex(g => g.includes(id)); }
function allGrouped() { return state.people.length === state.size && state.groups.every(g => g.length === targetPerGroup()); }
function allAssigned() { return allGrouped() && state.people.every(p => state.assignments[p.id]); }

function render() {
  renderNav();
  const app = document.querySelector("#app");
  app.innerHTML = state.step === 1 ? participantsView() : state.step === 2 ? groupsView() : state.step === 3 ? cardsView() : finalView();
  bindCommon();
  if (state.step === 1) bindParticipants();
  if (state.step === 2) bindGroups();
  if (state.step === 3) bindCards();
  if (state.step === 4) bindFinal();
  save();
}

function renderNav() {
  const counts = [`${state.people.length}/${state.size} registrados`, `${state.groups.filter(g => g.length).length} grupos`, `${Object.keys(state.assignments).length}/${state.size} cartas`, `${activeSuits().length} equipos`];
  const icons = ["♙", "▦", "▣", "♧"];
  document.querySelector("#stepsNav").innerHTML = STEPS.map((name, i) => `
    <button class="step-link ${state.step === i + 1 ? "active" : ""}" data-step="${i + 1}" ${i + 1 > maxReachableStep() ? "disabled" : ""}>
      <span class="step-icon">${icons[i]}</span><span><strong>${i + 1}. ${name}</strong><small>${counts[i]}</small></span>
    </button>`).join("");
}
function maxReachableStep() { return allAssigned() ? 4 : allGrouped() ? 3 : state.people.length === state.size ? 2 : 1; }
function pageHead(step, title, subtitle) { return `<header class="page-head"><div class="kicker">PASO ${step} DE 4</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></header>`; }

function participantsView() {
  return `${pageHead(1, "Agrega participantes", `Registra exactamente ${state.size} nombres para comenzar.`)}
    <div class="panel">
      <div class="toolbar push">
        <div class="segmented" aria-label="Cantidad de participantes">
          <button data-size="12" class="${state.size === 12 ? "active" : ""}">12 personas</button>
          <button data-size="18" class="${state.size === 18 ? "active" : ""}">18 personas</button>
          <button data-size="24" class="${state.size === 24 ? "active" : ""}">24 personas</button>
        </div>
        <button class="ghost" id="samplesBtn">Usar nombres de prueba</button>
      </div>
      <form class="name-entry" id="nameForm"><input id="nameInput" maxlength="40" autocomplete="off" placeholder="Escribe un nombre" ${state.people.length >= state.size ? "disabled" : ""}><button class="primary" ${state.people.length >= state.size ? "disabled" : ""}>Agregar</button></form>
      <div class="countline"><span>Participantes registrados</span><strong>${state.people.length} de ${state.size}</strong></div>
      <div class="progress"><i style="width:${state.people.length / state.size * 100}%"></i></div>
      <div class="names-grid">${state.people.map(p => `<div class="person-chip"><span>${escapeHtml(p.name)}</span><button data-remove="${p.id}" aria-label="Eliminar ${escapeHtml(p.name)}">×</button></div>`).join("")}</div>
      <div class="bottom-actions"><span></span><button class="primary" id="toGroups" ${state.people.length !== state.size ? "disabled" : ""}>Organizar grupos →</button></div>
    </div>`;
}

function groupsView() {
  const assigned = new Set(state.groups.flat());
  const free = state.people.filter(p => !assigned.has(p.id));
  return `${pageHead(2, "Organiza los grupos", `Forma 6 grupos de ${targetPerGroup()} personas. Toca hasta ${targetPerGroup()} nombres para moverlos juntos.`)}
    <div class="toolbar push"><button class="ghost" data-back="1">← Participantes</button><button class="secondary" id="randomGroups">Distribuir al azar</button></div>
    <div class="selection-bar ${selectedPeople.size ? "active" : ""}">
      <div><strong>${selectedPeople.size} de ${targetPerGroup()} seleccionados</strong><small>Toca los nombres que deseas mover juntos.</small></div>
      <div class="selection-actions"><button class="ghost small" id="clearSelection" ${!selectedPeople.size ? "disabled" : ""}>Limpiar</button><button class="primary small" id="moveSelection" ${!selectedPeople.size ? "disabled" : ""}>Mover selección</button></div>
    </div>
    <div class="unassigned" data-group="free"><div class="group-title"><strong>Sin asignar</strong><span class="badge">${free.length}</span></div><p class="hint">Toca para seleccionar, arrastra uno o mantén presionado.</p><div class="unassigned-list">${free.map(personRow).join("") || '<span class="hint">Todos los participantes están organizados.</span>'}</div></div>
    <div class="groups-layout">${state.groups.map((g, i) => groupCard(g, i)).join("")}</div>
    <div class="bottom-actions"><button class="ghost" data-back="1">← Volver</button><button class="primary" id="toCards" ${!allGrouped() ? "disabled" : ""}>Asignar cartas →</button></div>`;
}
function groupCard(ids, i) {
  return `<article class="group-card ${ids.length === targetPerGroup() ? "full" : ""}" data-group="${i}"><div class="group-title"><strong>Grupo ${i + 1}</strong><span class="badge">${ids.length}/${targetPerGroup()}</span></div>${ids.map(personRow).join("")}</article>`;
}
function personRow(pOrId, options = {}) {
  const p = typeof pOrId === "string" ? person(pOrId) : pOrId;
  const suit = state.assignments[p.id] ? SUITS.find(s => s.id === state.assignments[p.id]) : null;
  const groupIndex = groupOf(p.id);
  const selectable = state.step === 2 && !options.static;
  return `<div class="person-row ${selectable && selectedPeople.has(p.id) ? "selected" : ""}" data-person="${p.id}" draggable="${options.static ? "false" : "true"}">
    ${options.rank ? `<span class="rank">${rankLabel(groupIndex)}</span>` : `<span class="avatar">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</span>`}
    <span class="person-name">${escapeHtml(p.name)}</span>${selectable ? `<span class="select-mark">${selectedPeople.has(p.id) ? "✓" : ""}</span>` : ""}${suit ? `<span class="suit ${suit.color}">${suit.symbol}</span>` : ""}
  </div>`;
}

function cardsView() {
  return `${pageHead(3, "Asigna las cartas", `Cada grupo usa la misma carta y ${targetPerGroup()} palos distintos. Mantén presionado un nombre para elegir o cambiar su palo.`)}
    <div class="toolbar push"><button class="ghost" data-back="2">← Editar grupos</button><button class="secondary" id="randomCards">Sortear cartas</button></div>
    <div class="groups-layout cards-stage">${state.groups.map((ids, i) => `<article class="group-card"><div class="group-title"><strong>Grupo ${i + 1} · Carta ${rankLabel(i)}</strong><span class="badge">${ids.filter(id => state.assignments[id]).length}/${targetPerGroup()}</span></div><p class="hint">Mantén presionado para asignar.</p>${ids.map(id => personRow(id, { rank: true })).join("")}</article>`).join("")}</div>
    <div class="bottom-actions"><button class="ghost" data-back="2">← Volver</button><button class="primary" id="toFinal" ${!allAssigned() ? "disabled" : ""}>Ver equipos →</button></div>`;
}

function finalView() {
  return `${pageHead(4, "Equipos finales", "Cada equipo reúne a quienes recibieron el mismo palo, uno por cada grupo.")}
    <div class="toolbar push"><button class="ghost" data-back="3">← Editar cartas</button><div class="toolbar"><button class="secondary" id="downloadJpg">↓ Exportar JPG</button><button class="primary" id="shareJpg">↗ Compartir</button></div></div>
    <div class="final-grid" style="--team-count:${activeSuits().length}">${activeSuits().map((suit, i) => teamCard(suit, i)).join("")}</div>
    <div class="bottom-actions"><button class="ghost" data-back="3">← Editar cartas</button><span class="success">✓ Equipos listos</span></div>`;
}
function teamCard(suit, i) {
  const ids = state.groups.map(g => g.find(id => state.assignments[id] === suit.id)).filter(Boolean);
  return `<article class="team-card"><div class="team-head" style="--team-bg:${suit.bg}"><div><small>EQUIPO ${i + 1}</small><h2>${suit.name}</h2></div><span class="suit-box suit ${suit.color}">${suit.symbol}</span></div><div class="team-list">${ids.map(id => personRow(id, { rank: true, static: true })).join("")}</div><div class="team-foot">6 INTEGRANTES · GRUPOS 1–6</div></article>`;
}

function bindCommon() {
  document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => { state.step = Number(b.dataset.back); render(); });
  document.querySelectorAll(".step-link:not(:disabled)").forEach(b => b.onclick = () => { state.step = Number(b.dataset.step); render(); });
}
function bindParticipants() {
  document.querySelectorAll("[data-size]").forEach(b => b.onclick = () => changeSize(Number(b.dataset.size)));
  document.querySelector("#nameForm").onsubmit = e => { e.preventDefault(); addName(); };
  document.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => removePerson(b.dataset.remove));
  document.querySelector("#samplesBtn").onclick = fillSamples;
  document.querySelector("#toGroups").onclick = () => { state.step = 2; render(); };
}
function bindGroups() {
  document.querySelector("#randomGroups").onclick = randomGroups;
  document.querySelector("#toCards").onclick = () => { state.step = 3; render(); };
  bindDraggablePeople((id) => openGroupPicker(id));
  document.querySelector("#moveSelection").onclick = openSelectionGroupPicker;
  document.querySelector("#clearSelection").onclick = () => { selectedPeople.clear(); render(); };
  document.querySelectorAll(".person-row").forEach(row => row.onclick = () => {
    if (row.dataset.holdFired === "true") { row.dataset.holdFired = "false"; return; }
    togglePersonSelection(row.dataset.person);
  });
  document.querySelectorAll("[data-group]").forEach(zone => {
    zone.ondragover = e => { e.preventDefault(); zone.classList.add("dragover"); };
    zone.ondragleave = () => zone.classList.remove("dragover");
    zone.ondrop = e => {
      e.preventDefault(); zone.classList.remove("dragover");
      if (selectedPeople.has(dragId) && selectedPeople.size > 1) movePeople([...selectedPeople], zone.dataset.group);
      else movePerson(dragId, zone.dataset.group);
    };
  });
}
function bindCards() {
  document.querySelector("#randomCards").onclick = randomCards;
  document.querySelector("#toFinal").onclick = () => { state.step = 4; render(); };
  bindDraggablePeople((id) => openSuitPicker(id), false);
  document.querySelectorAll(".person-row").forEach(row => row.onclick = () => openSuitPicker(row.dataset.person));
}
function bindFinal() {
  document.querySelector("#downloadJpg").onclick = async () => downloadBlob(await createJpg(), "equipos-sorteo.jpg");
  document.querySelector("#shareJpg").onclick = shareJpg;
}
function bindDraggablePeople(onHold, draggable = true) {
  document.querySelectorAll(".person-row").forEach(row => {
    row.draggable = draggable;
    row.ondragstart = () => { dragId = row.dataset.person; };
    const start = () => { row.dataset.holdFired = "false"; clearTimeout(holdTimer); holdTimer = setTimeout(() => { row.dataset.holdFired = "true"; onHold(row.dataset.person); }, 520); };
    const cancel = () => clearTimeout(holdTimer);
    row.addEventListener("pointerdown", start); row.addEventListener("pointerup", cancel); row.addEventListener("pointerleave", cancel); row.addEventListener("pointercancel", cancel);
    row.oncontextmenu = e => { e.preventDefault(); onHold(row.dataset.person); };
  });
}

function changeSize(size) {
  if (state.size === size) return;

  const previousSize = state.size;
  state.size = size;

  if (size < previousSize) {
    const removedIds = new Set(state.people.slice(size).map(p => p.id));
    state.people = state.people.slice(0, size);

    const overflowIds = [];
    state.groups = state.groups.map(group => {
      const remaining = group.filter(id => !removedIds.has(id));
      overflowIds.push(...remaining.slice(targetPerGroup()));
      return remaining.slice(0, targetPerGroup());
    });

    [...removedIds, ...overflowIds].forEach(id => delete state.assignments[id]);
    const allowedSuits = new Set(activeSuits().map(suit => suit.id));
    state.people.forEach(({ id }) => {
      if (state.assignments[id] && !allowedSuits.has(state.assignments[id])) delete state.assignments[id];
    });
    selectedPeople = new Set([...selectedPeople].filter(id => state.people.some(p => p.id === id)));
    render();
    toast(removedIds.size ? `Se conservaron los primeros ${size} participantes` : `Modo de ${size} participantes activado`);
    return;
  }

  render();
  toast(`Ahora puedes registrar hasta ${size} participantes`);
}
function addName() {
  const input = document.querySelector("#nameInput"); const name = input.value.trim();
  if (!name || state.people.length >= state.size) return;
  state.people.push({ id: uid(), name }); input.value = ""; render();
}
function removePerson(id) {
  state.people = state.people.filter(p => p.id !== id);
  state.groups = state.groups.map(g => g.filter(x => x !== id)); delete state.assignments[id]; render();
}
function fillSamples() {
  const sample24 = [...sample18, "Renzo", "Patricia", "Óscar", "Gabriela", "Raúl", "Natalia"];
  const source = sample24.slice(0, state.size);
  state.people = source.map(name => ({ id: uid(), name })); state.groups = Array.from({ length: 6 }, () => []); state.assignments = {}; render();
}
function randomGroups() {
  const shuffled = shuffle(state.people.map(p => p.id));
  state.groups = Array.from({ length: 6 }, (_, i) => shuffled.slice(i * targetPerGroup(), (i + 1) * targetPerGroup()));
  state.assignments = {}; selectedPeople.clear(); render(); toast("Grupos distribuidos al azar");
}
function togglePersonSelection(id) {
  if (selectedPeople.has(id)) selectedPeople.delete(id);
  else if (selectedPeople.size < targetPerGroup()) selectedPeople.add(id);
  else return toast(`Puedes seleccionar como máximo ${targetPerGroup()} personas`);
  render();
}
function movePeople(ids, destination) {
  if (!ids.length) return;
  if (destination !== "free") {
    const to = Number(destination);
    const remaining = state.groups[to].filter(id => !ids.includes(id));
    if (remaining.length + ids.length > targetPerGroup()) return toast("No hay suficiente espacio en ese grupo");
    state.groups = state.groups.map(g => g.filter(id => !ids.includes(id)));
    state.groups[to] = [...remaining, ...ids];
  } else {
    state.groups = state.groups.map(g => g.filter(id => !ids.includes(id)));
  }
  ids.forEach(id => delete state.assignments[id]);
  selectedPeople.clear(); render();
}
function movePerson(id, destination) {
  if (!id) return;
  const from = groupOf(id);
  if (destination !== "free") {
    const to = Number(destination);
    if (state.groups[to].length >= targetPerGroup() && !state.groups[to].includes(id)) return toast("Ese grupo ya está completo");
    if (from >= 0) state.groups[from] = state.groups[from].filter(x => x !== id);
    if (!state.groups[to].includes(id)) state.groups[to].push(id);
  } else if (from >= 0) state.groups[from] = state.groups[from].filter(x => x !== id);
  delete state.assignments[id]; render();
}
function openGroupPicker(id) {
  const p = person(id); const options = state.groups
    .map((g, i) => ({ group: g, index: i }))
    .filter(({ group }) => group.length < targetPerGroup())
    .map(({ group, index }) => ({ label: `Grupo ${index + 1}`, meta: `${group.length}/${targetPerGroup()} ocupados`, status: group.length === 0 ? "empty" : "partial", action: () => movePerson(id, index) }));
  if (groupOf(id) >= 0) options.push({ label: "Quitar del grupo", action: () => movePerson(id, "free") });
  openModal(`Asignar a ${p.name}`, "Elige uno de los grupos disponibles.", options);
}
function openSelectionGroupPicker() {
  const ids = [...selectedPeople];
  if (!ids.length) return;
  const options = state.groups
    .map((g, i) => ({ group: g, index: i }))
    .filter(({ group }) => group.length < targetPerGroup())
    .map(({ group, index }) => {
      const remaining = group.filter(id => !selectedPeople.has(id));
      return { label: `Grupo ${index + 1}`, meta: `${group.length}/${targetPerGroup()} ocupados`, status: group.length === 0 ? "empty" : "partial", disabled: remaining.length + ids.length > targetPerGroup(), action: () => movePeople(ids, index) };
    });
  if (ids.some(id => groupOf(id) >= 0)) options.push({ label: "Dejar sin asignar", action: () => movePeople(ids, "free") });
  openModal(`Mover ${ids.length} ${ids.length === 1 ? "persona" : "personas"}`, "Elige el grupo al que irán juntas.", options);
}
function randomCards() {
  state.groups.forEach(ids => shuffle(activeSuits().map(s => s.id)).forEach((suit, i) => state.assignments[ids[i]] = suit));
  render(); toast("Cartas sorteadas correctamente");
}
function openSuitPicker(id) {
  const gi = groupOf(id); if (gi < 0) return;
  const usedByOthers = new Set(state.groups[gi].filter(x => x !== id).map(x => state.assignments[x]).filter(Boolean));
  const options = activeSuits().map(s => ({ label: s.name, symbol: s.symbol, tone: s.color, disabled: usedByOthers.has(s.id), action: () => { state.assignments[id] = s.id; render(); } }));
  if (state.assignments[id]) options.push({ label: "Deshacer selección", action: () => { delete state.assignments[id]; render(); } });
  openModal(`${person(id).name} · Carta ${rankLabel(gi)}`, "Selecciona uno de los palos disponibles.", options);
}

function openModal(title, text, options) {
  const modal = document.querySelector("#modal");
  document.querySelector("#modalTitle").textContent = title; document.querySelector("#modalText").textContent = text;
  document.querySelector("#modalOptions").innerHTML = options.map((o, i) => `<button class="option-btn" data-option="${i}" ${o.disabled ? "disabled" : ""}><span class="option-label">${o.symbol ? `<b class="option-symbol ${o.tone || ""}">${o.symbol}</b>` : ""}<span>${o.label}</span></span>${o.meta ? `<span class="option-meta"><small>${o.meta}</small>${o.status ? `<i class="status-dot ${o.status}" aria-label="${o.status === "empty" ? "Grupo vacío" : "Grupo parcialmente ocupado"}"></i>` : ""}</span>` : ""}</button>`).join("");
  modal.hidden = false;
  document.querySelectorAll("[data-option]").forEach(b => b.onclick = () => { const o = options[Number(b.dataset.option)]; closeModal(); o.action(); });
}
function closeModal() { document.querySelector("#modal").hidden = true; }
document.querySelector("#modalCancel").onclick = closeModal;
document.querySelector("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
document.querySelector("#resetBtn").onclick = () => { if (confirm("¿Deseas borrar la sesión actual y comenzar de nuevo?")) { state = initialState(); render(); } };

function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); }

async function createJpg() {
  const scale = 2, width = 1200, padding = 50, gap = 18, headerH = 105, rowH = 54;
  const suits = activeSuits(), cols = suits.length === 3 ? 3 : 2, rows = Math.ceil(suits.length / cols);
  const cardW = (width - padding * 2 - gap * (cols - 1)) / cols, cardH = 112 + rowH * 6 + 34;
  const height = padding + headerH + rows * cardH + (rows - 1) * gap + padding;
  const canvas = document.createElement("canvas"); canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext("2d"); ctx.scale(scale, scale); ctx.fillStyle = "#f7f8fb"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#161827"; ctx.font = "700 34px system-ui"; ctx.fillText("Equipos finales", padding, padding + 34);
  ctx.fillStyle = "#767b8c"; ctx.font = "16px system-ui"; ctx.fillText("Sorteo de Grupos · 6 integrantes por equipo", padding, padding + 64);
  suits.forEach((suit, index) => {
    const col = index % cols, row = Math.floor(index / cols), x = padding + col * (cardW + gap), y = padding + headerH + row * (cardH + gap);
    roundRect(ctx, x, y, cardW, cardH, 18, "#ffffff", "#dfe2e9");
    ctx.save(); ctx.beginPath(); roundedPath(ctx, x, y, cardW, 92, 18); ctx.clip(); ctx.fillStyle = suit.bg; ctx.fillRect(x, y, cardW, 92); ctx.restore();
    ctx.fillStyle = "#999daa"; ctx.font = "700 11px system-ui"; ctx.fillText(`EQUIPO ${index + 1}`, x + 20, y + 27);
    ctx.fillStyle = "#161827"; ctx.font = "700 22px system-ui"; ctx.fillText(suit.name, x + 20, y + 60);
    ctx.fillStyle = suit.color === "red" ? "#df4848" : "#202331"; ctx.font = "32px serif"; ctx.textAlign = "right"; ctx.fillText(suit.symbol, x + cardW - 23, y + 60); ctx.textAlign = "left";
    const ids = state.groups.map(g => g.find(id => state.assignments[id] === suit.id));
    ids.forEach((id, i) => {
      const ry = y + 105 + i * rowH; roundRect(ctx, x + 14, ry, cardW - 28, 43, 10, "#ffffff", "#e3e5eb");
      roundRect(ctx, x + 24, ry + 8, 28, 27, 7, "#202331"); ctx.fillStyle = "#ffffff"; ctx.font = "700 12px system-ui"; ctx.textAlign = "center"; ctx.fillText(rankLabel(i), x + 38, ry + 26); ctx.textAlign = "left";
      ctx.fillStyle = "#252735"; ctx.font = "15px system-ui"; ctx.fillText(person(id).name, x + 64, ry + 26);
      ctx.fillStyle = suit.color === "red" ? "#df4848" : "#202331"; ctx.font = "20px serif"; ctx.textAlign = "right"; ctx.fillText(suit.symbol, x + cardW - 28, ry + 27); ctx.textAlign = "left";
    });
    ctx.fillStyle = "#9da1ae"; ctx.font = "700 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("6 INTEGRANTES · GRUPOS 1–6", x + cardW / 2, y + cardH - 15); ctx.textAlign = "left";
  });
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .94));
}
function roundedPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function roundRect(ctx, x, y, w, h, r, fill, stroke) { roundedPath(ctx, x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function downloadBlob(blob, filename) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Imagen JPG descargada"); }
async function shareJpg() {
  const blob = await createJpg(); const file = new File([blob], "equipos-sorteo.jpg", { type: "image/jpeg" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title: "Equipos del sorteo", text: "Distribución final de equipos", files: [file] }); }
    else { downloadBlob(blob, file.name); toast("Imagen descargada. Ya puedes enviarla por WhatsApp."); }
  } catch (error) { if (error.name !== "AbortError") downloadBlob(blob, file.name); }
}

render();
