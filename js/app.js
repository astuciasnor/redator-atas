const STORAGE_KEY = "fepesca_ata_state";
const STORAGE_VERSION = 2;
const DEFAULT_THEME = "light";
const PENDING_TOAST_KEY = "fepesca_pending_toast";
const DEFAULT_TIPO_REUNIAO = "reunião ordinária";
const DEFAULT_COLEGIADO = "Conselho Deliberativo da Faculdade de Engenharia de Pesca";
const DEFAULT_LOGOS = {
    ufpa: "img/logo_ufpa.png",
    iecos: "img/logo_iecos.png",
    fepesca: "img/logo_fepesca_final.png",
};
const MEMBER_RENAMES = {
    "Eduardo": "Carlos Eduardo Rangel de Andrade",
    "Ivan": "Ivan Lucas Fernandes Matos",
    "Representante dos Técnicos da FEPESCA": "Breno Portilho de Sousa Maia",
};
const REQUIRED_MEMBERS = [
    { nome: "Rafael Anaisce das Chagas", funcao: "Prof. Dr." },
    { nome: "Ana Luiza Borges Guedes", funcao: "Representante Discente" },
    { nome: "Breno Portilho de Sousa Maia", funcao: "Representante dos Técnicos" },
];

const byId = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").trim();
const sortAlphaPT = (arr) => arr.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
const safeLower = (value) => esc(value).toLowerCase();
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

let membrosOriginais = [];
let membrosExtras = [];
let pautas = [];
let informes = [];
let logos = { ...DEFAULT_LOGOS };
let ataSincronizada = true;
let browserSlides = [];
let currentSlide = 0;

const LOGO_FIELDS = [
    { key: "fepesca", inputId: "logoFepescaUpload", previewId: "logoFepescaPreview", placeholderId: "logoFepescaPlaceholder", docImgId: "docLogoFepesca", docSlotId: "docLogoFepescaSlot" },
    { key: "ufpa", inputId: "logoUfpaUpload", previewId: "logoUfpaPreview", placeholderId: "logoUfpaPlaceholder", docImgId: "docLogoUfpa", docSlotId: "docLogoUfpaSlot" },
    { key: "iecos", inputId: "logoIecosUpload", previewId: "logoIecosPreview", placeholderId: "logoIecosPlaceholder", docImgId: "docLogoIecos", docSlotId: "docLogoIecosSlot" },
];

const META_IDS = [
    "tipoReuniao",
    "numeroAta",
    "tituloReuniao",
    "dataReuniao",
    "horaInicio",
    "horaFim",
    "localReuniao",
    "presidente",
    "redigidaPor",
    "formatoAta",
];

const EMAIL_IDS = [
    "emailSaudacao",
    "emailOrgao",
    "emailLink",
    "emailAssinatura",
    "emailCargo",
];

document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupGlobalListeners();

    membrosOriginais = normalizarMembrosBase(await getMembrosList());

    restaurarEstado();
    renderTabelaMembros();
    renderAllItems();
    renderLogoPreview();
    updateThemeButton();
    updateThemeMeta();
    updateChips();
    sincronizarAtaSePossivel(true);
    showPendingToast();
});

function setupTabs() {
    document.querySelectorAll(".tabbtn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.tab;
            document.querySelectorAll(".tabbtn").forEach((item) => item.classList.remove("active"));
            document.querySelectorAll(".tabcontent").forEach((item) => item.classList.remove("active"));
            btn.classList.add("active");
            const tab = byId(id);
            if (tab) tab.classList.add("active");
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

function on(id, eventName, handler) {
    const element = byId(id);
    if (element) element.addEventListener(eventName, handler);
}

function setupGlobalListeners() {
    on("btnNovaReuniao", "click", () => {
        if (confirm("Tem certeza que deseja apagar todos os dados e iniciar uma nova reunião? Essa ação não pode ser desfeita.")) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    });

    on("btnExportarSessao", "click", exportarSessaoJSON);
    on("btnImportarSessao", "change", importarSessaoJSON);
    on("btnToggleTema", "click", toggleTheme);
    on("btnLimpar", "click", limparMarcacoes);
    on("btnAdicionar", "click", addNovoMembro);
    on("novoNome", "keydown", (event) => { if (event.key === "Enter") addNovoMembro(); });
    on("novaFuncao", "keydown", (event) => { if (event.key === "Enter") addNovoMembro(); });

    on("btnAddPauta", "click", () => {
        pautas.push({ id: Date.now(), title: "Nova pauta", text: "" });
        renderPautas();
        sincronizarAtaSePossivel();
        salvarEstado();
    });

    on("btnAddInforme", "click", () => {
        informes.push({ id: Date.now(), title: "Novo informe", text: "" });
        renderInformes();
        sincronizarAtaSePossivel();
        salvarEstado();
    });

    on("btnGerarAta", "click", () => {
        const out = byId("saidaAta");
        if (!out) return;
        out.value = gerarTextoAta();
        ataSincronizada = true;
        updateAtaStatus();
        renderAtaPreview();
        salvarEstado();
        out.focus();
        out.select();
    });

    on("btnCopiarAta", "click", async () => {
        await copiarTexto(getTextoAtualAta(), "Texto da ata copiado.");
    });

    on("btnBaixarAtaDOCX", "click", exportarAtaDOCX);
    on("btnCSV", "click", exportarCSVPresencas);

    on("saidaAta", "input", () => {
        ataSincronizada = false;
        updateAtaStatus();
        renderAtaPreview();
        salvarEstado();
    });

    on("btnGerarEmail", "click", () => {
        const text = gerarTextoEmail();
        byId("saidaEmail").value = text;
        const orgao = esc(byId("emailOrgao").value) || "Colegiado";
        const data = formatDateBR(byId("dataReuniao").value);
        byId("saidaAssuntoEmail").value = `Convocação de Reunião: ${orgao} - ${data}`;
        salvarEstado();
    });

    on("btnCopiarEmail", "click", async () => {
        const out = byId("saidaEmail");
        if (!out || !esc(out.value)) {
            alert("Gere o e-mail primeiro.");
            return;
        }
        await copiarTexto(out.value, "Texto do e-mail copiado.");
    });

    on("saidaAssuntoEmail", "click", async (event) => {
        const value = esc(event.target.value);
        if (!value) return;
        await copiarTexto(value, "Assunto copiado.");
    });

    on("btnBaixarPPTX", "click", exportarPPTX);
    on("btnModoTelaCheia", "click", iniciarTelaCheia);
    on("btnSairTelaCheia", "click", sairTelaCheia);
    on("btnSlideNext", "click", nextSlide);
    on("btnSlidePrev", "click", prevSlide);

    document.addEventListener("keydown", (event) => {
        const fs = byId("fullscreenSlides");
        if (!fs || fs.style.display !== "flex") return;
        if (event.key === "Escape") sairTelaCheia();
        if (event.key === "ArrowRight" || event.key === " ") prevOrNextSlide(1);
        if (event.key === "ArrowLeft") prevOrNextSlide(-1);
    });

    META_IDS.forEach((id) => {
        on(id, "input", handleEstruturaChange);
        on(id, "change", handleEstruturaChange);
    });

    EMAIL_IDS.forEach((id) => {
        on(id, "input", salvarEstado);
        on(id, "change", salvarEstado);
    });

    on("transcricaoAudio", "input", salvarEstado);
    on("saidaEmail", "input", salvarEstado);
    on("saidaAssuntoEmail", "input", salvarEstado);

    LOGO_FIELDS.forEach(({ inputId, key }) => {
        on(inputId, "change", (event) => handleLogoUpload(event, key));
    });

    on("busca", "input", (event) => {
        const query = safeLower(event.target.value);
        document.querySelectorAll("#tabela tbody tr").forEach((row) => {
            const name = safeLower(row.querySelector(".name")?.textContent);
            const role = safeLower(row.querySelector(".role")?.textContent);
            row.style.display = (!query || name.includes(query) || role.includes(query)) ? "" : "none";
        });
    });
}

function handleEstruturaChange() {
    updateChips();
    sincronizarAtaSePossivel();
    salvarEstado();
}

function toggleTheme() {
    const current = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", current);
    updateThemeButton();
    updateThemeMeta();
    salvarEstado();
}

function updateThemeButton() {
    const btn = byId("btnToggleTema");
    if (!btn) return;
    btn.textContent = document.body.getAttribute("data-theme") === "dark"
        ? "☀️ Tema Claro"
        : "🌙 Tema Escuro";
}

function updateThemeMeta() {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) return;
    metaTheme.setAttribute("content", document.body.getAttribute("data-theme") === "dark" ? "#08111f" : "#f8fafc");
}

function exportarSessaoJSON() {
    salvarEstado();
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
        alert("Nenhum dado para salvar.");
        return;
    }

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${buildSessionFileBase()}_enviado-${formatTimestampNow()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Backup da sessão preparado em JSON.", "success");
}

function importarSessaoJSON(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const parsed = JSON.parse(loadEvent.target.result);
            if (!parsed || !parsed.meta) {
                throw new Error("Arquivo inválido");
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            sessionStorage.setItem(PENDING_TOAST_KEY, "Sessão importada com sucesso.");
            location.reload();
        } catch (error) {
            alert("Não foi possível importar o arquivo selecionado.");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

function limparMarcacoes() {
    if (!confirm("Limpar marcações de presença e ausência? Os participantes extras serão mantidos.")) {
        return;
    }
    [...membrosOriginais, ...membrosExtras].forEach((membro) => {
        membro.status = "";
        membro.motivo = "";
    });
    renderTabelaMembros();
    sincronizarAtaSePossivel();
    salvarEstado();
}

function renderTabelaMembros() {
    const tbody = byId("tbody-membros");
    if (!tbody) return;
    tbody.innerHTML = "";

    const todos = [...membrosOriginais, ...membrosExtras]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

    todos.forEach((membro, index) => {
        const idUnico = `membro_${index}`;
        const isPresente = membro.status === "presente";
        const isAusente = membro.status === "ausente";
        const disableMotivo = !isAusente;
        const isExtra = membrosExtras.includes(membro);

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>
        <div class="name">${escapeHtml(membro.nome)}</div>
        <div class="role">${escapeHtml(membro.funcao || "—")} ${isExtra ? '<span style="color:var(--brand);font-weight:700">[Extra]</span>' : ""}</div>
      </td>
      <td>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="${idUnico}" value="presente" ${isPresente ? "checked" : ""}> P
          </label>
          <label class="radio-label" style="color:var(--danger)">
            <input type="radio" name="${idUnico}" value="ausente" ${isAusente ? "checked" : ""}> A
          </label>
        </div>
      </td>
      <td>
        <input class="motivo" type="text" placeholder="Apenas se ausente..." value="${escapeHtml(membro.motivo || "")}" ${disableMotivo ? "disabled" : ""}>
      </td>
      <td style="text-align:center; display:flex; gap:6px; justify-content:center;">
        <button class="btn edit small btnEditarMembro" title="Editar participante">✏️</button>
        <button class="btn danger small btnExcluirMembro" title="Remover participante">X</button>
      </td>
    `;
        tbody.appendChild(tr);

        const radios = tr.querySelectorAll(`input[name="${idUnico}"]`);
        const motivoInput = tr.querySelector(".motivo");
        const btnExcluir = tr.querySelector(".btnExcluirMembro");
        const btnEditar = tr.querySelector(".btnEditarMembro");

        btnEditar.addEventListener("click", () => {
            const novoNome = prompt("Editar nome do participante:", membro.nome);
            if (novoNome === null || !esc(novoNome)) return;
            const novaFuncao = prompt("Editar função do participante:", membro.funcao || "—");
            if (novaFuncao === null) return;
            membro.nome = esc(novoNome);
            membro.funcao = esc(novaFuncao) || "—";
            renderTabelaMembros();
            sincronizarAtaSePossivel();
            salvarEstado();
        });

        btnExcluir.addEventListener("click", () => {
            if (!confirm(`Remover \"${membro.nome}\" da lista de presenças desta reunião?`)) return;
            if (isExtra) {
                membrosExtras = membrosExtras.filter((item) => item !== membro);
            } else {
                membrosOriginais = membrosOriginais.filter((item) => item !== membro);
            }
            renderTabelaMembros();
            sincronizarAtaSePossivel();
            salvarEstado();
        });

        radios.forEach((radio) => {
            radio.addEventListener("change", () => {
                membro.status = radio.value;
                if (radio.value === "ausente") {
                    motivoInput.disabled = false;
                    motivoInput.focus();
                } else {
                    motivoInput.disabled = true;
                    motivoInput.value = "";
                    membro.motivo = "";
                }
                sincronizarAtaSePossivel();
                salvarEstado();
            });
        });

        motivoInput.addEventListener("input", (event) => {
            membro.motivo = esc(event.target.value);
            sincronizarAtaSePossivel();
            salvarEstado();
        });
    });
}

function addNovoMembro() {
    const nome = esc(byId("novoNome")?.value);
    const funcao = esc(byId("novaFuncao")?.value) || "—";
    if (!nome) return;

    const existe = [...membrosOriginais, ...membrosExtras]
        .some((membro) => membro.nome.toLowerCase() === nome.toLowerCase());
    if (existe) {
        alert("Este participante já está na lista.");
        return;
    }

    membrosExtras.push({ nome, funcao, status: "presente", motivo: "" });
    byId("novoNome").value = "";
    byId("novaFuncao").value = "";
    renderTabelaMembros();
    sincronizarAtaSePossivel();
    salvarEstado();
    byId("novoNome").focus();
}

function criarItemHTML(item, tipo, index) {
    const isPauta = tipo === "pauta";
    const color = isPauta ? "var(--brand)" : "var(--warn)";
    const bg = isPauta ? "rgba(15,76,129,.10)" : "rgba(202,138,4,.12)";

    return `
    <div class="item" data-id="${item.id}">
      <div class="itemhead">
        <div class="item-title-wrapper">
          <span class="badgeItem" style="background:${bg}; color:${color}; border:1px solid ${color};">
            ${isPauta ? "Pauta" : "Informe"} ${index + 1}
          </span>
          <textarea class="itemtitle editar-titulo" rows="2" placeholder="Digite o título...">${escapeHtml(item.title)}</textarea>
        </div>
        <div class="item-actions" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn small btnTransformar" title="${isPauta ? "Transformar em Informe" : "Transformar em Pauta"}">↳ ${isPauta ? "P/ Informe" : "P/ Pauta"}</button>
          <button class="btn small btnMover" title="Mover para cima" data-dir="-1">↑</button>
          <button class="btn small btnMover" title="Mover para baixo" data-dir="1">↓</button>
          <button class="btn danger small btnExcluir">Excluir</button>
        </div>
      </div>
      <div class="item-body">
         <textarea class="editar-texto" placeholder="O que foi discutido, informado ou deliberado?">${escapeHtml(item.text)}</textarea>
      </div>
    </div>
  `;
}

function bindItemEvents(container, arrayOrigem) {
    const items = container.querySelectorAll(".item");
    items.forEach((div, index) => {
        const obj = arrayOrigem[index];
        div.querySelector(".editar-titulo").addEventListener("input", (event) => {
            obj.title = esc(event.target.value);
            sincronizarAtaSePossivel();
            salvarEstado();
        });
        div.querySelector(".editar-texto").addEventListener("input", (event) => {
            obj.text = esc(event.target.value);
            sincronizarAtaSePossivel();
            salvarEstado();
        });

        div.querySelector(".btnExcluir").addEventListener("click", () => {
            if (!confirm(`Excluir \"${obj.title || (arrayOrigem === pautas ? "pauta" : "informe")}\"?`)) return;
            arrayOrigem.splice(index, 1);
            renderAllItems();
            sincronizarAtaSePossivel();
            salvarEstado();
        });

        div.querySelectorAll(".btnMover").forEach((btn) => {
            btn.addEventListener("click", () => {
                const dir = Number(btn.dataset.dir);
                if (index + dir < 0 || index + dir >= arrayOrigem.length) return;
                const current = arrayOrigem[index];
                arrayOrigem[index] = arrayOrigem[index + dir];
                arrayOrigem[index + dir] = current;
                renderAllItems();
                sincronizarAtaSePossivel();
                salvarEstado();
            });
        });

        div.querySelector(".btnTransformar").addEventListener("click", () => {
            const destino = arrayOrigem === pautas ? informes : pautas;
            destino.push(obj);
            arrayOrigem.splice(index, 1);
            renderAllItems();
            sincronizarAtaSePossivel();
            salvarEstado();
        });
    });
}

function renderAllItems() {
    renderPautas();
    renderInformes();
}

function renderPautas() {
    const container = byId("pautas-container");
    if (!container) return;
    if (pautas.length === 0) {
        container.innerHTML = '<p class="helper">Nenhuma pauta adicionada.</p>';
        return;
    }
    container.innerHTML = pautas.map((item, index) => criarItemHTML(item, "pauta", index)).join("");
    bindItemEvents(container, pautas);
}

function renderInformes() {
    const container = byId("informes-container");
    if (!container) return;
    if (informes.length === 0) {
        container.innerHTML = '<p class="helper">Nenhum informe adicionado.</p>';
        return;
    }
    container.innerHTML = informes.map((item, index) => criarItemHTML(item, "informe", index)).join("");
    bindItemEvents(container, informes);
}

function collectAttendance() {
    const presentes = [];
    const ausJust = [];
    const ausSem = [];

    const todos = [...membrosOriginais, ...membrosExtras]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

    todos.forEach((membro) => {
        const nomeFmt = membro.funcao && membro.funcao !== "—"
            ? `${membro.nome} (${membro.funcao})`
            : membro.nome;
        if (membro.status === "presente") presentes.push(nomeFmt);
        if (membro.status === "ausente") {
            if (membro.motivo) ausJust.push(`${nomeFmt} — ${membro.motivo}`);
            else ausSem.push(nomeFmt);
        }
    });

    return { presentes, ausJust, ausSem };
}

function formatDateBR(iso) {
    if (!iso) return "___/___/____";
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
}

function obterMesExtenso(month) {
    const meses = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    return meses[Number(month) - 1] || "";
}

function getTipoReuniaoAta() {
    const raw = safeLower(byId("tipoReuniao")?.value);
    if (!raw || raw === "reunião ordinária do colegiado") return DEFAULT_TIPO_REUNIAO;
    return raw;
}

function getColegiadoAta() {
    const raw = esc(byId("tituloReuniao")?.value);
    if (!raw || safeLower(raw) === "reunião fepesca") return DEFAULT_COLEGIADO;
    return raw;
}

function normalizarFuncaoMembro(funcao) {
    const raw = esc(funcao);
    if (raw === "Prof.") return "Prof. Dr.";
    if (raw === "Profa.") return "Profa. Dra.";
    return raw;
}

function normalizarMembro(membro) {
    const nomeOriginal = esc(membro?.nome);
    const nome = MEMBER_RENAMES[nomeOriginal] || nomeOriginal;
    let funcao = normalizarFuncaoMembro(membro?.funcao);

    if (nome === "Carlos Eduardo Rangel de Andrade") funcao = "Prof. Dr.";
    if (nome === "Ivan Lucas Fernandes Matos") funcao = "Representante Discente";
    if (nome === "Rafael Anaisce das Chagas") funcao = "Prof. Dr.";
    if (nome === "Breno Portilho de Sousa Maia") funcao = "Representante dos Técnicos";

    return {
        ...membro,
        nome,
        funcao: funcao || "—",
    };
}

function normalizarMembrosBase(lista) {
    const vistos = new Set();
    const normalizados = [];

    (Array.isArray(lista) ? lista : []).forEach((membro) => {
        const normalizado = normalizarMembro(membro);
        const chave = safeLower(normalizado.nome);
        if (!chave || vistos.has(chave)) return;
        vistos.add(chave);
        normalizados.push(normalizado);
    });

    REQUIRED_MEMBERS.forEach((membro) => {
        const chave = safeLower(membro.nome);
        if (vistos.has(chave)) return;
        vistos.add(chave);
        normalizados.push({ ...membro, status: "", motivo: "" });
    });

    return normalizados;
}

function formatDateLonga(iso) {
    if (!iso) return "___ de ________ de ____";
    const [year, month, day] = iso.split("-");
    return `${day} de ${obterMesExtenso(month)} de ${year}`;
}

function finalizarFrase(texto) {
    const cleaned = esc(texto);
    if (!cleaned) return "";
    return /[.!?…:]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function gerarTituloFormalAta() {
    const tipo = getTipoReuniaoAta();
    const colegiado = getColegiadoAta();
    return `Ata da ${tipo} do ${colegiado}, do Instituto de Estudos Costeiros, realizada no dia ${formatDateLonga(byId("dataReuniao")?.value)}.`;
}

function gerarTextoAta() {
    const formato = byId("formatoAta")?.value || "institucional";
    return formato === "resumida" ? gerarAtaInstitucional(true) : gerarAtaInstitucional(false);
}

function gerarAtaInstitucional(isResumida) {
    const tipo = getTipoReuniaoAta();
    const numero = esc(byId("numeroAta")?.value) || "__/____";
    const colegiado = getColegiadoAta();
    const local = esc(byId("localReuniao")?.value) || "local não informado";
    const presidente = esc(byId("presidente")?.value) || "presidência não informada";
    const redigidaPor = esc(byId("redigidaPor")?.value) || "redator não informado";
    const horaInicio = esc(byId("horaInicio")?.value) || "__:__";
    const horaFim = esc(byId("horaFim")?.value) || "__:__";
    const dataISO = esc(byId("dataReuniao")?.value);
    const [ano = "____", mesStr = "__", dia = "__"] = dataISO ? dataISO.split("-") : [];
    const mesExtenso = dataISO ? obterMesExtenso(mesStr) : "________";
    const { presentes, ausJust, ausSem } = collectAttendance();

    const paragraphs = [];
    const presencasTexto = presentes.length ? presentes.join(", ") : "sem registro de presença";

    paragraphs.push(
        `Aos ${dia} dias do mês de ${mesExtenso} de ${ano}, às ${horaInicio}, no(a) ${local}, realizou-se a ${tipo} do ${colegiado}, do Instituto de Estudos Costeiros, sob a presidência de ${presidente}. Estiveram presentes ${presencasTexto}.`
    );

    if (ausJust.length || ausSem.length) {
        const blocosAusencia = [];
        if (ausJust.length) blocosAusencia.push(`justificaram ausência ${ausJust.join(", ")}`);
        if (ausSem.length) blocosAusencia.push(`não justificaram ausência ${ausSem.join(", ")}`);
        paragraphs.push(`Quanto às ausências, ${blocosAusencia.join("; ")}.`);
    }

    if (informes.length > 0) {
        const corpoInformes = informes.map((item) => {
            if (isResumida || !esc(item.text)) return finalizarFrase(item.title);
            return finalizarFrase(`${item.title}: ${item.text}`);
        }).join(" ");
        paragraphs.push(`Nos informes, registrou-se o seguinte: ${corpoInformes}`);
    }

    if (pautas.length > 0) {
        if (pautas.length === 1) {
            paragraphs.push(`Pauta única. ${finalizarFrase(pautas[0].title)}`);
        } else {
            const listaPautas = pautas.map((item, index) => `${index + 1}) ${finalizarFrase(item.title)}`).join(" ");
            paragraphs.push(`Constaram da ordem do dia as seguintes pautas: ${listaPautas}`);
        }

        const discussoes = pautas.map((item) => {
            if (isResumida) {
                return `Em relação à pauta \"${item.title}\", registrou-se discussão e encaminhamento em plenário.`;
            }
            if (!esc(item.text)) {
                return `Em relação à pauta \"${item.title}\", registrou-se a discussão correspondente, sem detalhamento adicional nesta redação.`;
            }
            return `Em relação à pauta \"${item.title}\", ${finalizarFrase(item.text)}`;
        }).join(" ");
        paragraphs.push(discussoes);
    } else {
        paragraphs.push("Não constaram itens de pauta para deliberação nesta sessão.");
    }

    paragraphs.push(`Nada mais havendo a tratar, a reunião foi encerrada às ${horaFim}. Eu, ${redigidaPor}, lavrei a presente ata, de número ${numero}, que, após lida e aprovada, seguirá para os trâmites institucionais de assinatura.`);

    return paragraphs.filter(Boolean).join("\n\n");
}

function getTextoAtualAta() {
    const out = byId("saidaAta");
    if (!out) return gerarTextoAta();
    return esc(out.value) ? out.value : gerarTextoAta();
}

function sincronizarAtaSePossivel(force = false) {
    const out = byId("saidaAta");
    if (!out) return;

    if (force) {
        if (ataSincronizada || !esc(out.value)) {
            out.value = gerarTextoAta();
        }
    } else if (ataSincronizada || !esc(out.value)) {
        out.value = gerarTextoAta();
        ataSincronizada = true;
    }

    updateAtaStatus();
    renderAtaPreview();
}

function updateAtaStatus() {
    const status = byId("statusAta");
    const out = byId("saidaAta");
    if (!status || !out) return;
    if (!esc(out.value)) {
        status.textContent = "Aguardando texto";
        return;
    }
    status.textContent = ataSincronizada ? "Sincronizada" : "Edição manual";
}

function renderAtaPreview() {
    const titulo = byId("tituloDocumentoAta");
    const corpo = byId("documentoAtaTexto");
    if (!titulo || !corpo) return;

    titulo.textContent = gerarTituloFormalAta();
    const paragraphs = getTextoAtualAta()
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);
    corpo.innerHTML = paragraphs.join("");
    renderLogoPreview();
}

function updateChips() {
    const dataISO = byId("dataReuniao")?.value;
    const horaInicio = esc(byId("horaInicio")?.value) || "__:__";
    const horaFim = esc(byId("horaFim")?.value) || "__:__";
    const numero = esc(byId("numeroAta")?.value) || "sem número";
    byId("chipData").textContent = `📅 ${formatDateBR(dataISO)} | 🕒 ${horaInicio}-${horaFim} | Ata ${numero}`;
}

function handleLogoUpload(event, key) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
        alert("A imagem está grande demais. Use um arquivo menor para não comprometer o salvamento da sessão.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        logos[key] = String(loadEvent.target.result || "");
        renderLogoPreview();
        salvarEstado();
    };
    reader.readAsDataURL(file);
}

function renderLogoPreview() {
    LOGO_FIELDS.forEach(({ key, previewId, placeholderId, docImgId, docSlotId }) => {
        const source = logos[key] || "";
        const previewImg = byId(previewId);
        const previewPlaceholder = byId(placeholderId);
        const docImg = byId(docImgId);
        const docSlot = byId(docSlotId);
        const docPlaceholder = docSlot?.querySelector(".empty-logo");

        if (previewImg) {
            previewImg.src = source;
            previewImg.style.display = source ? "block" : "none";
        }
        if (previewPlaceholder) {
            previewPlaceholder.style.display = source ? "none" : "inline-flex";
        }
        if (docImg) {
            docImg.src = source;
            docImg.style.display = source ? "block" : "none";
        }
        if (docPlaceholder) {
            docPlaceholder.style.display = source ? "none" : "inline-flex";
        }
    });
}

function gerarTextoEmail() {
    const saudacao = esc(byId("emailSaudacao")?.value) || "Prezadas e prezados,";
    const orgao = esc(byId("emailOrgao")?.value) || "Colegiado";
    const tipo = safeLower(byId("tipoReuniao")?.value) || "reunião";
    const local = esc(byId("localReuniao")?.value) || "local não informado";
    const hora = esc(byId("horaInicio")?.value) || "--:--";
    const linkStr = esc(byId("emailLink")?.value);
    const nomeAss = esc(byId("emailAssinatura")?.value) || "—";
    const cargoAss = esc(byId("emailCargo")?.value) || "—";
    const dataTexto = formatDateLonga(byId("dataReuniao")?.value);
    const trechoLink = linkStr ? ` e por meio do link: ${linkStr}.` : ".";

    let listaPautas = "Nenhuma pauta específica foi agendada até o momento.\n";
    if (pautas.length > 0) {
        listaPautas = "A pauta prevista para a reunião é a seguinte:\n\n";
        pautas.forEach((item, index) => {
            listaPautas += `${index + 1}. ${item.title}\n`;
        });
    }

    let listaInformes = "";
    if (informes.length > 0) {
        listaInformes = "\nInformes:\n\n";
        informes.forEach((item, index) => {
            listaInformes += `${index + 1}. ${item.title}\n`;
        });
    }

    let email = `${saudacao}\n\n`;
    email += `Encaminho a convocação para a ${tipo} do ${orgao}, que será realizada no dia ${dataTexto}, às ${hora}, no(a) ${local}${trechoLink}\n\n`;
    email += listaPautas;
    email += listaInformes;
    email += `\nConto com a participação de todas e todos.\n\n`;
    email += `Atenciosamente,\n${nomeAss}\n${cargoAss}`;
    return email;
}

function exportarCSVPresencas() {
    const rows = [["Participante", "Função", "Presença", "Motivo"]];
    [...membrosOriginais, ...membrosExtras]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
        .forEach((item) => {
            rows.push([
                item.nome,
                item.funcao || "—",
                item.status || "",
                item.motivo || "",
            ]);
        });

    const csv = rows
        .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";"))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Presencas_FEPESCA_${buildMeetingToken()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function exportarAtaDOCX() {
    const DOCX = window.docx;
    if (!DOCX || typeof saveAs !== "function") {
        alert("A biblioteca de exportação DOCX não foi carregada corretamente.");
        return;
    }

    try {
        const doc = await buildAtaDocxDocument(DOCX);
        const blob = await DOCX.Packer.toBlob(doc);
        saveAs(blob, `${buildDocxFileName()}.docx`);
    } catch (error) {
        console.error(error);
        alert("Não foi possível gerar o arquivo DOCX.");
    }
}

async function buildAtaDocxDocument(DOCX) {
    const numero = esc(byId("numeroAta")?.value) || "__/____";
    const children = [];

    children.push(await criarTabelaLogosDOCX(DOCX));

    [
        "UNIVERSIDADE FEDERAL DO PARÁ",
        "INSTITUTO DE ESTUDOS COSTEIROS",
        "FACULDADE DE ENGENHARIA DE PESCA",
        `ATA Nº ${numero}`,
    ].forEach((line, index) => {
        children.push(new DOCX.Paragraph({
            alignment: DOCX.AlignmentType.CENTER,
            spacing: { after: index === 3 ? 240 : 80 },
            children: [
                new DOCX.TextRun({
                    text: line,
                    bold: true,
                    size: index === 3 ? 22 : 24,
                }),
            ],
        }));
    });

    children.push(new DOCX.Paragraph({
        spacing: { after: 320 },
        children: [
            new DOCX.TextRun({
                text: gerarTituloFormalAta(),
                bold: true,
                size: 24,
            }),
        ],
    }));

    getTextoAtualAta().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).forEach((block) => {
        children.push(new DOCX.Paragraph({
            alignment: DOCX.AlignmentType.JUSTIFIED,
            spacing: { after: 240, line: 440 },
            indent: { firstLine: 720 },
            children: criarTextRunsDOCX(DOCX, block),
        }));
    });

    return new DOCX.Document({
        creator: "FEPESCA",
        title: `Ata ${numero}`,
        description: "Ata institucional da FEPESCA",
        styles: {
            default: {
                document: {
                    run: {
                        font: "Times New Roman",
                        size: 24,
                        color: "000000",
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1134,
                            right: 1134,
                            bottom: 1134,
                            left: 1134,
                        },
                    },
                },
                children,
            },
        ],
    });
}

async function criarTabelaLogosDOCX(DOCX) {
    const noBorder = {
        top: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: DOCX.BorderStyle.NONE, size: 0, color: "FFFFFF" },
    };

    const cells = await Promise.all([
        criarLogoCellDOCX(DOCX, logos.fepesca, "FEPESCA", noBorder),
        criarLogoCellDOCX(DOCX, logos.ufpa, "UFPA", noBorder),
        criarLogoCellDOCX(DOCX, logos.iecos, "IECOS", noBorder),
    ]);

    return new DOCX.Table({
        width: { size: 100, type: DOCX.WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
            new DOCX.TableRow({
                children: cells,
            }),
        ],
    });
}

async function criarLogoCellDOCX(DOCX, src, fallbackText, borders) {
    const children = [];
    const imageRun = src ? await criarImageRunDOCX(DOCX, src, 92, 92) : null;

    if (imageRun) {
        children.push(new DOCX.Paragraph({
            alignment: DOCX.AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [imageRun],
        }));
    } else {
        children.push(new DOCX.Paragraph({
            alignment: DOCX.AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
                new DOCX.TextRun({
                    text: fallbackText,
                    bold: true,
                    color: "0F4C81",
                }),
            ],
        }));
    }

    return new DOCX.TableCell({
        borders,
        width: { size: 33, type: DOCX.WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 40, right: 40 },
        children,
    });
}

async function criarImageRunDOCX(DOCX, src, width, height) {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    return new DOCX.ImageRun({
        data: new Uint8Array(arrayBuffer),
        type: inferImageType(src),
        transformation: { width, height },
    });
}

function inferImageType(src) {
    const lower = src.toLowerCase();
    if (lower.includes("image/svg") || lower.endsWith(".svg")) return "svg";
    if (lower.includes("image/jpeg") || lower.includes("image/jpg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
    if (lower.includes("image/gif") || lower.endsWith(".gif")) return "gif";
    if (lower.includes("image/bmp") || lower.endsWith(".bmp")) return "bmp";
    return "png";
}

function criarTextRunsDOCX(DOCX, text) {
    const lines = String(text).split("\n");
    const runs = [];
    lines.forEach((line, index) => {
        runs.push(new DOCX.TextRun({ text: line }));
        if (index < lines.length - 1) {
            runs.push(new DOCX.TextRun({ text: "", break: 1 }));
        }
    });
    return runs;
}

async function copiarTexto(texto, mensagemSucesso) {
    try {
        await navigator.clipboard.writeText(texto);
        showToast(mensagemSucesso, "success");
    } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        showToast(mensagemSucesso, "success");
    }
}

function showPendingToast() {
    const message = sessionStorage.getItem(PENDING_TOAST_KEY);
    if (!message) return;
    sessionStorage.removeItem(PENDING_TOAST_KEY);
    showToast(message, "success");
}

function showToast(message, type = "info") {
    const region = byId("toastRegion");
    if (!region || !esc(message)) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    region.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    window.setTimeout(() => {
        toast.classList.remove("show");
        window.setTimeout(() => toast.remove(), 220);
    }, 2600);
}

async function exportarPPTX() {
    const btn = byId("btnBaixarPPTX");
    const loader = byId("loadingPPTX");
    if (btn) btn.disabled = true;
    if (loader) loader.style.display = "block";

    try {
        await gerarArquivoPPTX();
    } catch (error) {
        console.error(error);
        alert("Erro ao gerar o arquivo PPTX.");
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.style.display = "none";
    }
}

async function gerarArquivoPPTX() {
    if (typeof pptxgen === "undefined") {
        throw new Error("pptxgen não disponível");
    }

    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";

    const tipo = esc(byId("tipoReuniao")?.value) || "Reunião Ordinária";
    const data = formatDateBR(byId("dataReuniao")?.value);

    const slideCapa = pres.addSlide();
    slideCapa.background = { color: "0F172A" };
    slideCapa.addText(tipo.toUpperCase(), { x: 1, y: 2.2, w: 8, h: 1, fontSize: 32, bold: true, color: "FFFFFF", align: "center", fontFace: "Segoe UI" });
    slideCapa.addText(`DATA: ${data}`, { x: 1, y: 3.2, w: 8, h: 1, fontSize: 18, color: "94A3B8", align: "center", fontFace: "Segoe UI" });

    if (pautas.length > 0) {
        const titleSlide = pres.addSlide();
        titleSlide.background = { color: "1E293B" };
        titleSlide.addText("PAUTAS DA REUNIÃO", { x: 0.7, y: 2.5, w: 8.6, h: 0.8, fontSize: 32, bold: true, color: "0EA5E9", align: "center" });

        pautas.forEach((item, index) => {
            const slide = pres.addSlide();
            slide.addText(`Pauta ${index + 1}`, { x: 0.5, y: 0.5, w: 9, h: 0.4, fontSize: 16, color: "0EA5E9", bold: true });
            slide.addText(item.title, { x: 0.5, y: 1.1, w: 9, h: 1.6, fontSize: 24, bold: true, color: "1E293B", valign: "top" });
            if (item.text) {
                slide.addText(item.text, { x: 0.5, y: 3.1, w: 9, h: 2, fontSize: 16, color: "475569", valign: "top" });
            }
        });
    }

    if (informes.length > 0) {
        const titleSlide = pres.addSlide();
        titleSlide.background = { color: "1E293B" };
        titleSlide.addText("INFORMES", { x: 1, y: 2.5, w: 8, h: 0.8, fontSize: 32, bold: true, color: "10B981", align: "center" });

        informes.forEach((item, index) => {
            const slide = pres.addSlide();
            slide.addText(`Informe ${index + 1}`, { x: 0.5, y: 0.5, w: 9, h: 0.4, fontSize: 16, color: "10B981", bold: true });
            slide.addText(item.title, { x: 0.5, y: 1.1, w: 9, h: 1.6, fontSize: 24, bold: true, color: "1E293B", valign: "top" });
            if (item.text) {
                slide.addText(item.text, { x: 0.5, y: 3.1, w: 9, h: 2, fontSize: 16, color: "475569", valign: "top" });
            }
        });
    }

    await pres.writeFile({ fileName: `Apresentacao_FEPESCA_${formatDateBR(byId("dataReuniao")?.value).replace(/\//g, "-")}.pptx` });
}

function montarArraySlides() {
    browserSlides = [];
    const tipo = esc(byId("tipoReuniao")?.value) || "Reunião";
    const data = formatDateBR(byId("dataReuniao")?.value);

    browserSlides.push(`
        <h1 style="font-size: 58px; margin-bottom: 20px; color: #fff;">${escapeHtml(tipo.toUpperCase())}</h1>
        <h3 style="font-size: 28px; color: #94a3b8; font-weight: normal;">${escapeHtml(data)}</h3>
    `);

    if (pautas.length > 0) {
        browserSlides.push('<h1 style="font-size: 64px; color: #38bdf8;">PAUTAS</h1>');
        pautas.forEach((item, index) => {
            let html = `<div style="text-align:left; width:100%;"><span style="display:inline-block; padding:8px 16px; background:#0284c7; color:#fff; border-radius:999px; font-weight:bold; font-size:20px; margin-bottom:24px;">Pauta ${index + 1}</span><h2 style="font-size:44px; color:#f1f5f9; line-height:1.3; margin-top:0;">${escapeHtml(item.title)}</h2>`;
            if (item.text) html += `<p style="font-size:26px; color:#cbd5e1; line-height:1.5; margin-top:36px; border-left:4px solid #475569; padding-left:20px;">${escapeHtml(item.text)}</p>`;
            html += "</div>";
            browserSlides.push(html);
        });
    }

    if (informes.length > 0) {
        browserSlides.push('<h1 style="font-size: 64px; color: #10b981;">INFORMES</h1>');
        informes.forEach((item, index) => {
            let html = `<div style="text-align:left; width:100%;"><span style="display:inline-block; padding:8px 16px; background:#059669; color:#fff; border-radius:999px; font-weight:bold; font-size:20px; margin-bottom:24px;">Informe ${index + 1}</span><h2 style="font-size:44px; color:#f1f5f9; line-height:1.3; margin-top:0;">${escapeHtml(item.title)}</h2>`;
            if (item.text) html += `<p style="font-size:26px; color:#cbd5e1; line-height:1.5; margin-top:36px; border-left:4px solid #475569; padding-left:20px;">${escapeHtml(item.text)}</p>`;
            html += "</div>";
            browserSlides.push(html);
        });
    }

    browserSlides.push('<h1 style="font-size: 58px; color: #475569;">FIM DA REUNIÃO</h1><p style="font-size: 24px; color: #64748b; margin-top: 20px;">Obrigado pela presença de todos.</p>');
}

function iniciarTelaCheia() {
    montarArraySlides();
    if (browserSlides.length === 0) return;
    currentSlide = 0;
    const fs = byId("fullscreenSlides");
    fs.style.display = "flex";
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
    }
    renderCurrentSlide();
}

function sairTelaCheia() {
    const fs = byId("fullscreenSlides");
    if (fs) fs.style.display = "none";
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
    }
}

function renderCurrentSlide() {
    byId("slideContent").innerHTML = browserSlides[currentSlide];
    byId("slideCounter").textContent = `${currentSlide + 1} / ${browserSlides.length}`;
}

function prevOrNextSlide(dir) {
    currentSlide += dir;
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide >= browserSlides.length) currentSlide = browserSlides.length - 1;
    renderCurrentSlide();
}

function nextSlide() { prevOrNextSlide(1); }
function prevSlide() { prevOrNextSlide(-1); }

function salvarEstado() {
    const state = {
        version: STORAGE_VERSION,
        meta: {
            tipo: byId("tipoReuniao")?.value || "",
            numero: byId("numeroAta")?.value || "",
            titulo: byId("tituloReuniao")?.value || "",
            data: byId("dataReuniao")?.value || "",
            horaIni: byId("horaInicio")?.value || "",
            horaFim: byId("horaFim")?.value || "",
            local: byId("localReuniao")?.value || "",
            presida: byId("presidente")?.value || "",
            redator: byId("redigidaPor")?.value || "",
            formato: byId("formatoAta")?.value || "institucional",
            saida: byId("saidaAta")?.value || "",
            ataSincronizada,
            transcricao: byId("transcricaoAudio")?.value || "",
            eSaudacao: byId("emailSaudacao")?.value || "",
            eOrgao: byId("emailOrgao")?.value || "",
            eLink: byId("emailLink")?.value || "",
            eAss: byId("emailAssinatura")?.value || "",
            eCargo: byId("emailCargo")?.value || "",
            eSaidaEmail: byId("saidaEmail")?.value || "",
            eSaidaAssunto: byId("saidaAssuntoEmail")?.value || "",
        },
        tema: document.body.getAttribute("data-theme") || DEFAULT_THEME,
        logos,
        membrosOriginais,
        membrosExtras,
        pautas,
        informes,
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn("Falha ao salvar estado", error);
        alert("Não foi possível salvar a sessão localmente. Verifique se a transcrição ou as logos estão muito grandes.");
    }
}

function restaurarEstado() {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
        setHoje();
        setPautasPadrao();
        setInformesPadrao();
        document.body.setAttribute("data-theme", DEFAULT_THEME);
        return;
    }

    try {
        const state = JSON.parse(rawState);
        if (state.meta) {
            const tipoRestaurado = safeLower(state.meta.tipo);
            byId("tipoReuniao").value = (!tipoRestaurado || tipoRestaurado === "reunião ordinária do colegiado")
                ? DEFAULT_TIPO_REUNIAO
                : state.meta.tipo;
            byId("numeroAta").value = state.meta.numero || "01/2026";
            const tituloRestaurado = esc(state.meta.titulo);
            byId("tituloReuniao").value = (!tituloRestaurado || safeLower(tituloRestaurado) === "reunião fepesca")
                ? DEFAULT_COLEGIADO
                : tituloRestaurado;
            byId("dataReuniao").value = state.meta.data || "";
            byId("horaInicio").value = state.meta.horaIni || "09:00";
            byId("horaFim").value = state.meta.horaFim || "11:00";
            byId("localReuniao").value = state.meta.local || "Sala 03 - Bloco I";
            byId("presidente").value = state.meta.presida || "Prof. Dr. Carlos Alberto Martins Cordeiro";
            byId("redigidaPor").value = state.meta.redator || "Prof. Dr. Evaldo Martins da Silva";
            byId("formatoAta").value = state.meta.formato === "topicos" ? "institucional" : (state.meta.formato || "institucional");
            byId("saidaAta").value = state.meta.saida || "";
            ataSincronizada = typeof state.meta.ataSincronizada === "boolean"
                ? state.meta.ataSincronizada
                : !esc(state.meta.saida);
            byId("transcricaoAudio").value = state.meta.transcricao || "";

            byId("emailSaudacao").value = state.meta.eSaudacao || "Prezadas e prezados,";
            byId("emailOrgao").value = state.meta.eOrgao || "Colegiado da Faculdade de Engenharia de Pesca";
            byId("emailLink").value = state.meta.eLink || "";
            byId("emailAssinatura").value = state.meta.eAss || "Prof. Dr. Carlos Alberto Martins Cordeiro";
            byId("emailCargo").value = state.meta.eCargo || "Diretor da Faculdade de Engenharia de Pesca";
            byId("saidaEmail").value = state.meta.eSaidaEmail || "";
            byId("saidaAssuntoEmail").value = state.meta.eSaidaAssunto || "";
        }

        document.body.setAttribute("data-theme", state.tema || DEFAULT_THEME);
        logos = {
            ufpa: state.logos?.ufpa || DEFAULT_LOGOS.ufpa,
            iecos: state.logos?.iecos || DEFAULT_LOGOS.iecos,
            fepesca: state.logos?.fepesca || DEFAULT_LOGOS.fepesca,
        };
        membrosOriginais = normalizarMembrosBase(Array.isArray(state.membrosOriginais) ? state.membrosOriginais : membrosOriginais);
        membrosExtras = Array.isArray(state.membrosExtras) ? state.membrosExtras : [];
        pautas = Array.isArray(state.pautas) ? state.pautas : [];
        informes = Array.isArray(state.informes) ? state.informes : [];

        if (!byId("dataReuniao").value) setHoje();
        if (!Array.isArray(state.pautas)) setPautasPadrao();
        if (!Array.isArray(state.informes)) setInformesPadrao();
    } catch (error) {
        console.warn("Falha ao recuperar o estado salvo.", error);
        logos = { ...DEFAULT_LOGOS };
        setHoje();
        setPautasPadrao();
        setInformesPadrao();
        document.body.setAttribute("data-theme", DEFAULT_THEME);
    }
}

function setHoje() {
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    byId("dataReuniao").value = iso;
}

function setPautasPadrao() {
    pautas = [
        { id: 1, title: "Discussão de documento para orientações da recepção de encomendas na Secretaria Integrada do IECOS", text: "" },
        { id: 2, title: "Evolução do preenchimento das ementas do novo PPC", text: "" },
        { id: 3, title: "Apresentação de resultados da enquete sobre aprendizagem e oferta das disciplinas", text: "" },
        { id: 4, title: "Reuniões de alinhamento do bloco de oferta entre docentes", text: "" },
    ];
}

function setInformesPadrao() {
    informes = [
        { id: 1, title: "Semana Pedagógica do IECOS", text: "" },
        { id: 2, title: "Semana do Calouro", text: "" },
        { id: 3, title: "Inauguração do novo espaço do LAGECO", text: "" },
        { id: 4, title: "Sessão de posse da nova coordenação do campus", text: "" },
    ];
}

function sanitizeFilePart(value) {
    return esc(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "sem-registro";
}

function buildMeetingToken() {
    const numero = sanitizeFilePart(byId("numeroAta")?.value || "ata");
    const data = esc(byId("dataReuniao")?.value) || "sem-data";
    return `${numero}_${data}`;
}

function buildDocxFileName() {
    return `Ata_FEPESCA_${buildMeetingToken()}`;
}

function buildSessionFileBase() {
    return `Sessao_FEPESCA_${buildMeetingToken()}`;
}

function formatTimestampNow() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}_${hh}h${min}`;
}
