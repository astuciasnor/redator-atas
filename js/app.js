const STORAGE_KEY = "fepesca_ata_state";
const STORAGE_VERSION = 2;
const DEFAULT_THEME = "light";
const PENDING_TOAST_KEY = "fepesca_pending_toast";
const CONTRIBUTION_KIND = "fepesca-section-contribution";
const CONTRIBUTION_VERSION = 1;
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
    { nome: "Nils Edvin Asp Neto", funcao: "Prof. Dr." },
    { nome: "Rafael Anaisce das Chagas", funcao: "Prof. Dr." },
    { nome: "Ana Luiza Borges Guedes", funcao: "Representante Discente" },
    { nome: "Breno Portilho de Sousa Maia", funcao: "Representante dos Técnicos" },
];

const byId = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").trim();
const sortAlphaPT = (arr) => arr.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
const safeLower = (value) => esc(value).toLowerCase();
const NAME_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);
const FAMILY_SUFFIXES = new Set(["filho", "junior", "júnior", "neto", "sobrinho"]);
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
let mergeBases = { pautas: [], informes: [] };

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

const TELEGRAPHIC_PLACEHOLDERS = {
    pauta: [
        "F: Roberta | propõe revisar fluxo",
        "A: Carlos Cordeiro | sugere ouvir a secretaria",
        "D: aprovada revisão parcial",
        "V: aprovado por unanimidade",
        "E: elaborar nova minuta",
        "R: coordenação",
        "P: próxima reunião",
    ].join("\n"),
    informe: [
        "AP: Roberta | informou previsão de visita técnica",
        "C: Nils | verificar disponibilidade de transporte",
        "E: confirmar logística, se necessário",
        "R: coordenação",
        "P: até 20/05",
    ].join("\n"),
};

const TELEGRAPHIC_LEGENDS = {
    pauta: {
        title: "Siglas da pauta",
        note: "Exemplo de nome identificador: Roberta, Carlos Cordeiro, Rafael Chagas, Nils.",
        items: [
            ["F:", "fala principal de um docente"],
            ["A:", "adendo, complemento ou observação adicional"],
            ["D:", "deliberação final da pauta"],
            ["V:", "resultado da votação, se houver"],
            ["E:", "encaminhamento prático definido pelo grupo"],
            ["R:", "responsável pelo encaminhamento"],
            ["P:", "prazo ou marco temporal"],
        ],
    },
    informe: {
        title: "Siglas do informe",
        note: "Se o informe for só comunicacional, basta AP e, se necessário, um ou dois complementos.",
        items: [
            ["AP:", "apresentação principal do informe"],
            ["C:", "complemento ou observação adicional"],
            ["E:", "encaminhamento, se o informe gerar ação"],
            ["R:", "responsável pelo encaminhamento"],
            ["P:", "prazo ou data de retorno"],
        ],
    },
};

const TELEGRAPHIC_SPEAKER_CODES = new Set(["F", "A", "AP", "C"]);

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
    on("btnExportarPautasTXT", "click", () => exportarTextoTelegraficoSecao("pautas"));
    on("btnExportarPautas", "click", () => exportarContribuicaoSecao("pautas"));
    on("btnMesclarPautas", "click", () => byId("inputMergePautas")?.click());
    on("inputMergePautas", "change", (event) => importarContribuicaoSecao(event, "pautas"));
    on("btnLimparPautas", "click", () => limparSecaoTelegráfica("pautas"));
    on("btnExportarInformesTXT", "click", () => exportarTextoTelegraficoSecao("informes"));
    on("btnExportarInformes", "click", () => exportarContribuicaoSecao("informes"));
    on("btnMesclarInformes", "click", () => byId("inputMergeInformes")?.click());
    on("inputMergeInformes", "change", (event) => importarContribuicaoSecao(event, "informes"));
    on("btnLimparInformes", "click", () => limparSecaoTelegráfica("informes"));
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

    on("btnCopiarPromptIA", "click", async () => {
        await copiarTexto(gerarPromptIAAta(), "Prompt para IA copiado.");
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
            const identifier = safeLower(row.querySelector(".member-identificador")?.value);
            const role = safeLower(row.querySelector(".role")?.textContent);
            row.style.display = (!query || name.includes(query) || identifier.includes(query) || role.includes(query)) ? "" : "none";
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

function exportarContribuicaoSecao(section) {
    if (!hasMeetingIdentity()) {
        alert("Preencha número da ata e data antes de exportar contribuições.");
        return;
    }

    const items = cloneSectionItems(getSectionItems(section));
    if (items.length === 0) {
        alert(`Nenhum item em ${getSectionLabel(section)} para exportar.`);
        return;
    }

    const contribution = buildSectionContribution(section);
    const blob = new Blob([JSON.stringify(contribution, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildSectionContributionFileName(section);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Contribuição de ${getSectionLabel(section)} preparada em JSON.`, "success");
}

function importarContribuicaoSecao(event, expectedSection) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const parsed = JSON.parse(loadEvent.target.result);
            const result = processarContribuicaoSecao(parsed, expectedSection);
            const resumo = formatarResumoMescla(expectedSection, result);
            showToast(ataSincronizada ? resumo : `${resumo} Revise a ata manual.`, "success");
        } catch (error) {
            alert(error.message || "Não foi possível mesclar o arquivo selecionado.");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

function processarContribuicaoSecao(payload, expectedSection) {
    if (!hasMeetingIdentity()) {
        throw new Error("Preencha número da ata e data antes de mesclar contribuições.");
    }

    validarContribuicaoSecao(payload, expectedSection);
    const result = mesclarContribuicaoSecao(payload, expectedSection);

    if (result.changed) {
        if (expectedSection === "pautas") renderPautas();
        if (expectedSection === "informes") renderInformes();
        sincronizarAtaSePossivel();
        salvarEstado();
    }

    return result;
}

function validarContribuicaoSecao(payload, expectedSection) {
    if (!payload || payload.kind !== CONTRIBUTION_KIND) {
        throw new Error("Arquivo de contribuição inválido.");
    }

    if (payload.version !== CONTRIBUTION_VERSION) {
        throw new Error("Esta contribuição foi gerada em uma versão incompatível.");
    }

    if (payload.section !== expectedSection) {
        throw new Error(`Este arquivo é de ${getSectionLabel(payload.section)}, não de ${getSectionLabel(expectedSection)}.`);
    }

    if (!Array.isArray(payload.items) || !Array.isArray(payload.baseItems)) {
        throw new Error("A contribuição está incompleta ou corrompida.");
    }

    if (payload.meetingKey !== buildMeetingKey()) {
        throw new Error("Esta contribuição pertence a outra reunião. Confira número da ata e data antes de mesclar.");
    }
}

function mesclarContribuicaoSecao(payload, section) {
    const currentItems = cloneSectionItems(getSectionItems(section));
    const incomingItems = cloneSectionItems(payload.items);
    const baseItems = cloneSectionItems(payload.baseItems);
    const baseMap = new Map(baseItems.map((item) => [String(item.id), item]));

    const result = {
        added: 0,
        updated: 0,
        conflicts: 0,
        unchanged: 0,
        changed: false,
    };

    incomingItems.forEach((incomingItem) => {
        const itemId = String(incomingItem.id);
        const currentIndex = currentItems.findIndex((item) => String(item.id) === itemId);
        const currentItem = currentIndex >= 0 ? currentItems[currentIndex] : null;
        const baseItem = baseMap.get(itemId);

        if (!currentItem) {
            currentItems.push({ ...incomingItem });
            result.added += 1;
            result.changed = true;
            return;
        }

        if (isSameSectionItem(currentItem, incomingItem)) {
            result.unchanged += 1;
            return;
        }

        if (!baseItem) {
            result.conflicts += 1;
            if (confirmMergeConflict(section, currentItem, incomingItem)) {
                currentItems[currentIndex] = { ...incomingItem };
                result.updated += 1;
                result.changed = true;
            }
            return;
        }

        const localChanged = !isSameSectionItem(currentItem, baseItem);
        const incomingChanged = !isSameSectionItem(incomingItem, baseItem);

        if (!localChanged && incomingChanged) {
            currentItems[currentIndex] = { ...incomingItem };
            result.updated += 1;
            result.changed = true;
            return;
        }

        if (localChanged && !incomingChanged) {
            result.unchanged += 1;
            return;
        }

        if (!localChanged && !incomingChanged) {
            result.unchanged += 1;
            return;
        }

        result.conflicts += 1;
        if (confirmMergeConflict(section, currentItem, incomingItem)) {
            currentItems[currentIndex] = { ...incomingItem };
            result.updated += 1;
            result.changed = true;
        }
    });

    setSectionItems(section, currentItems);
    mergeBases[section] = cloneSectionItems(currentItems);
    return result;
}

function confirmMergeConflict(section, currentItem, incomingItem) {
    const singular = getSectionSingularLabel(section);
    const atual = truncateText(currentItem.title || "Sem título", 90);
    const importado = truncateText(incomingItem.title || "Sem título", 90);
    return confirm(
        `Conflito em ${singular}.\n\nAtual: ${atual}\nImportado: ${importado}\n\nOK = usar versão importada\nCancelar = manter versão atual.`
    );
}

function formatarResumoMescla(section, result) {
    const partes = [];
    if (result.added) partes.push(`${result.added} novo(s)`);
    if (result.updated) partes.push(`${result.updated} atualizado(s)`);
    if (result.conflicts) partes.push(`${result.conflicts} conflito(s) revisado(s)`);
    if (!partes.length) partes.push("sem alterações");
    return `${getSectionLabel(section)} mesclados: ${partes.join(", ")}.`;
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

function getTodosMembros() {
    return [...membrosOriginais, ...membrosExtras];
}

function getFirstRelevantNamePart(nome) {
    const partes = esc(nome).split(/\s+/).filter(Boolean);
    const semConectores = partes.filter((parte) => !NAME_CONNECTORS.has(safeLower(parte)));
    return semConectores[0] || partes[0] || "";
}

function buildBaseIdentifierOptions(nome) {
    const nomeLimpo = esc(nome);
    const partes = nomeLimpo.split(/\s+/).filter(Boolean);
    const semConectores = partes.filter((parte) => !NAME_CONNECTORS.has(safeLower(parte)));
    const primeiroNome = semConectores[0] || partes[0] || "";
    const sobrenomeCurto = extrairSobrenomeCurto(partes);
    const ultimoNome = semConectores[semConectores.length - 1] || partes[partes.length - 1] || "";
    const opcoes = [];

    [
        primeiroNome,
        primeiroNome && ultimoNome && `${primeiroNome} ${ultimoNome}`,
        primeiroNome && sobrenomeCurto && `${primeiroNome} ${sobrenomeCurto}`,
        ultimoNome,
        nomeLimpo,
    ].forEach((opcao) => {
        const texto = esc(opcao);
        if (!texto || opcoes.some((item) => safeLower(item) === safeLower(texto))) return;
        opcoes.push(texto);
    });

    return opcoes;
}

function sugerirIdentificadorMembro(membro, todos = getTodosMembros()) {
    const nome = esc(membro?.nome);
    const opcoes = buildBaseIdentifierOptions(nome);
    const primeiroNome = opcoes[0] || nome;
    const repeticoesPrimeiroNome = todos.filter((item) => safeLower(getFirstRelevantNamePart(item?.nome)) === safeLower(primeiroNome)).length;
    if (repeticoesPrimeiroNome <= 1) return primeiroNome;
    return opcoes.find((opcao) => opcao.includes(" ")) || nome;
}

function garantirIdentificadoresMembros() {
    const todos = getTodosMembros();
    todos.forEach((membro) => {
        if (!esc(membro.identificador)) {
            membro.identificador = sugerirIdentificadorMembro(membro, todos);
        }
    });
}

function buildIdentifierOptionsForMember(membro, todos = getTodosMembros()) {
    const opcoes = [];
    [
        esc(membro.identificador),
        sugerirIdentificadorMembro(membro, todos),
        ...buildBaseIdentifierOptions(membro.nome),
    ].forEach((opcao) => {
        const texto = esc(opcao);
        if (!texto || opcoes.some((item) => safeLower(item) === safeLower(texto))) return;
        opcoes.push(texto);
    });
    return opcoes;
}

function identificadorEmUso(valor, membroAtual) {
    const alvo = safeLower(valor);
    if (!alvo) return false;
    return getTodosMembros().some((membro) => membro !== membroAtual && safeLower(membro.identificador) === alvo);
}

function getMemberIdentifierEntries() {
    garantirIdentificadoresMembros();
    return getTodosMembros()
        .map((membro) => ({
            nome: esc(membro.nome),
            identificador: esc(membro.identificador),
            funcao: esc(membro.funcao),
        }))
        .filter((item) => item.nome && item.identificador)
        .sort((a, b) => a.identificador.localeCompare(b.identificador, "pt-BR", { sensitivity: "base" }));
}

function encontrarMembroPorReferencia(referencia) {
    const alvo = safeLower(referencia);
    if (!alvo) return null;
    return getTodosMembros().find((membro) => safeLower(membro.identificador) === alvo || safeLower(membro.nome) === alvo) || null;
}

function resolverNomeCompletoPorReferencia(referencia) {
    return encontrarMembroPorReferencia(referencia)?.nome || esc(referencia);
}

function renderTabelaMembros() {
    const tbody = byId("tbody-membros");
    if (!tbody) return;
    tbody.innerHTML = "";

    garantirIdentificadoresMembros();

    const todos = [...membrosOriginais, ...membrosExtras]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

    todos.forEach((membro, index) => {
        const idUnico = `membro_${index}`;
        const isPresente = membro.status === "presente";
        const isAusente = membro.status === "ausente";
        const disableMotivo = !isAusente;
        const isExtra = membrosExtras.includes(membro);
                const identifierOptions = buildIdentifierOptionsForMember(membro, todos);

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>
        <div class="name">${escapeHtml(membro.nome)}</div>
        <div class="role">${escapeHtml(membro.funcao || "—")} ${isExtra ? '<span style="color:var(--brand);font-weight:700">[Extra]</span>' : ""}</div>
      </td>
            <td>
                <select class="member-identificador" aria-label="Identificador do participante">
                    ${identifierOptions.map((opcao) => `<option value="${escapeHtml(opcao)}" ${safeLower(opcao) === safeLower(membro.identificador) ? "selected" : ""}>${escapeHtml(opcao)}</option>`).join("")}
                </select>
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
        const identificadorSelect = tr.querySelector(".member-identificador");
        const btnExcluir = tr.querySelector(".btnExcluirMembro");
        const btnEditar = tr.querySelector(".btnEditarMembro");

        identificadorSelect.addEventListener("change", (event) => {
            const novoValor = esc(event.target.value);
            if (!novoValor) return;
            if (identificadorEmUso(novoValor, membro)) {
                alert("Este identificador já está em uso por outro participante. Escolha outro para manter o autocomplete sem ambiguidades.");
                event.target.value = membro.identificador;
                return;
            }
            membro.identificador = novoValor;
            sincronizarAtaSePossivel();
            salvarEstado();
        });

        btnEditar.addEventListener("click", () => {
            const novoNome = prompt("Editar nome do participante:", membro.nome);
            if (novoNome === null || !esc(novoNome)) return;
            const novaFuncao = prompt("Editar função do participante:", membro.funcao || "—");
            if (novaFuncao === null) return;
            membro.nome = esc(novoNome);
            membro.funcao = esc(novaFuncao) || "—";
            if (!esc(membro.identificador)) {
                membro.identificador = sugerirIdentificadorMembro(membro, todos);
            }
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

    membrosExtras.push({ nome, funcao, identificador: "", status: "presente", motivo: "" });
    garantirIdentificadoresMembros();
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
    const placeholder = getItemTextPlaceholder(tipo);
    const helper = isPauta
        ? "Use uma linha por fala, adendo, deliberação, votação ou encaminhamento. O nome pode ser só o identificador do docente."
        : "Use AP para a apresentação principal e C para complementos. Só registre E, R e P se o informe gerar ação.";

    return `
    <div class="item" data-id="${item.id}">
      <div class="itemhead">
        <div class="item-title-wrapper">
                    <details class="item-legend-menu">
                        <summary class="badgeItem item-badge-toggle" style="background:${bg}; color:${color}; border:1px solid ${color};">
                            ${isPauta ? "Pauta" : "Informe"} ${index + 1}
                        </summary>
                        ${buildLegendDropdownHTML(tipo)}
                    </details>
          <textarea class="itemtitle editar-titulo" rows="2" placeholder="Digite o título...">${escapeHtml(item.title)}</textarea>
        </div>
        <div class="item-actions">
          <button class="btn small btnTransformar" title="${isPauta ? "Transformar em Informe" : "Transformar em Pauta"}">↳ ${isPauta ? "P/ Informe" : "P/ Pauta"}</button>
          <button class="btn small btnMover" title="Mover para cima" data-dir="-1">↑</button>
          <button class="btn small btnMover" title="Mover para baixo" data-dir="1">↓</button>
          <button class="btn danger small btnExcluir">Excluir</button>
        </div>
      </div>
      <div class="item-body">
        <span class="item-label">Texto telegráfico</span>
        <textarea class="editar-texto" rows="8" placeholder="${escapeHtml(placeholder)}">${escapeHtml(item.text)}</textarea>
        <div class="item-autocomplete" hidden></div>
        <p class="item-helper">${helper}</p>
      </div>
    </div>
  `;
}

function getItemTextPlaceholder(tipo) {
    return TELEGRAPHIC_PLACEHOLDERS[tipo] || "";
}

function buildLegendDropdownHTML(tipo) {
        const legend = TELEGRAPHIC_LEGENDS[tipo] || TELEGRAPHIC_LEGENDS.pauta;
        return `
            <div class="item-legend-dropdown">
                <strong class="item-legend-title">${escapeHtml(legend.title)}</strong>
                <ul class="telegraphic-legend">
                    ${legend.items.map(([code, text]) => `<li><span class="legend-code">${escapeHtml(code)}</span><span class="legend-text">${escapeHtml(text)}</span></li>`).join("")}
                </ul>
                <p class="helper item-legend-note">${escapeHtml(legend.note)}</p>
            </div>
        `;
}

function getTelegraphicAutocompleteContext(textarea) {
    const value = String(textarea?.value ?? "");
    const cursor = Number(textarea?.selectionStart ?? value.length);
    const lineStart = value.lastIndexOf("\n", Math.max(cursor - 1, 0)) + 1;
    const nextBreak = value.indexOf("\n", cursor);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lineFull = value.slice(lineStart, lineEnd);
    const cursorInLine = cursor - lineStart;
    const pipeIndex = lineFull.indexOf("|");
    if (pipeIndex >= 0 && cursorInLine > pipeIndex) return null;

    const prefix = value.slice(lineStart, cursor);
    const match = prefix.match(/^\s*([A-Za-z]{1,3})\s*:\s*([^|\n]*)$/);
    if (!match) return null;

    const codigo = match[1].toUpperCase();
    if (!TELEGRAPHIC_SPEAKER_CODES.has(codigo)) return null;

    return {
        lineStart,
        lineEnd,
        cursor,
        codigo,
        typedIdentifier: esc(match[2]),
    };
}

function getAutocompleteIdentifierSuggestions(typedIdentifier) {
    const query = safeLower(typedIdentifier);
    if (query.length < 3) return [];
    const tokenPattern = query ? new RegExp(`(^|\\s)${escapeRegExp(query)}`, "i") : null;
    return getMemberIdentifierEntries()
        .filter((item) => {
            if (!query) return true;
            return safeLower(item.identificador).startsWith(query)
                || (tokenPattern ? tokenPattern.test(item.nome) : false);
        })
        .sort((a, b) => {
            const aStarts = safeLower(a.identificador).startsWith(query) ? 0 : 1;
            const bStarts = safeLower(b.identificador).startsWith(query) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.identificador.localeCompare(b.identificador, "pt-BR", { sensitivity: "base" });
        })
        .slice(0, 6);
}

function renderTelegraphicAutocomplete(textarea, container) {
    const context = getTelegraphicAutocompleteContext(textarea);
    if (!context || !container) {
        if (container) {
            container.hidden = true;
            container.innerHTML = "";
        }
        return [];
    }

    const suggestions = getAutocompleteIdentifierSuggestions(context.typedIdentifier);
    if (!suggestions.length) {
        container.hidden = true;
        container.innerHTML = "";
        return [];
    }

    container.hidden = false;
    container.innerHTML = suggestions.map((item, index) => `
        <button type="button" class="autocomplete-option" data-index="${index}">
            <strong>${escapeHtml(item.identificador)}</strong>
            <span>${escapeHtml(item.nome)}</span>
        </button>
    `).join("");
    return suggestions;
}

function aplicarSugestaoIdentificador(textarea, suggestion) {
    const context = getTelegraphicAutocompleteContext(textarea);
    if (!context || !suggestion) return false;

    const value = String(textarea.value ?? "");
    const before = value.slice(0, context.lineStart);
    const afterLine = value.slice(context.lineEnd);
    const linhaAtual = value.slice(context.lineStart, context.lineEnd);
    const pipeIndex = linhaAtual.indexOf("|");
    const existingContent = pipeIndex >= 0 ? esc(linhaAtual.slice(pipeIndex + 1)) : "";
    const prefix = `${context.codigo}: ${suggestion.identificador} | `;
    const novaLinha = existingContent ? `${prefix}${existingContent}` : prefix;

    textarea.value = `${before}${novaLinha}${afterLine}`;
    const nextCursor = before.length + prefix.length;
    textarea.setSelectionRange(nextCursor, nextCursor);
    return true;
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
        const textArea = div.querySelector(".editar-texto");
        const autocompleteBox = div.querySelector(".item-autocomplete");
        let currentSuggestions = [];

        const syncText = () => {
            obj.text = esc(textArea.value);
            sincronizarAtaSePossivel();
            salvarEstado();
        };

        const refreshAutocomplete = () => {
            currentSuggestions = renderTelegraphicAutocomplete(textArea, autocompleteBox);
            autocompleteBox.querySelectorAll(".autocomplete-option").forEach((button) => {
                button.addEventListener("mousedown", (event) => event.preventDefault());
                button.addEventListener("click", () => {
                    const suggestion = currentSuggestions[Number(button.dataset.index)];
                    if (!aplicarSugestaoIdentificador(textArea, suggestion)) return;
                    autocompleteBox.hidden = true;
                    autocompleteBox.innerHTML = "";
                    syncText();
                    textArea.focus();
                });
            });
        };

        textArea.addEventListener("input", () => {
            refreshAutocomplete();
            syncText();
        });

        textArea.addEventListener("click", refreshAutocomplete);
        textArea.addEventListener("focus", refreshAutocomplete);

        textArea.addEventListener("blur", () => {
            window.setTimeout(() => {
                autocompleteBox.hidden = true;
                autocompleteBox.innerHTML = "";
            }, 120);
        });

        textArea.addEventListener("keydown", (event) => {
            if (event.key === "Tab") {
                const suggestion = renderTelegraphicAutocomplete(textArea, autocompleteBox)[0];
                if (!suggestion) return;
                event.preventDefault();
                if (!aplicarSugestaoIdentificador(textArea, suggestion)) return;
                autocompleteBox.hidden = true;
                autocompleteBox.innerHTML = "";
                syncText();
            }
            if (event.key === "Escape") {
                autocompleteBox.hidden = true;
                autocompleteBox.innerHTML = "";
            }
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

function getSectionItems(section) {
    return section === "informes" ? informes : pautas;
}

function setSectionItems(section, items) {
    if (section === "informes") {
        informes = items;
        return;
    }
    pautas = items;
}

function limparSecaoTelegráfica(section) {
    const label = getSectionLabel(section);
    const items = getSectionItems(section);
    if (!items.length) {
        alert(`Não há itens em ${label} para limpar.`);
        return;
    }

    if (!confirm(`Limpar todos os itens de ${label}? Esta ação remove títulos e textos desta seção.`)) {
        return;
    }

    setSectionItems(section, []);
    mergeBases[section] = [];
    if (section === "informes") renderInformes();
    else renderPautas();
    sincronizarAtaSePossivel();
    salvarEstado();
}

function cloneSectionItems(items) {
    const baseId = Date.now();
    return (Array.isArray(items) ? items : []).map((item, index) => ({
        id: item?.id ?? `${baseId}-${index}`,
        title: esc(item?.title),
        text: esc(item?.text),
    }));
}

function restoreSectionBases(state) {
    mergeBases = {
        pautas: Array.isArray(state?.mergeBases?.pautas) ? cloneSectionItems(state.mergeBases.pautas) : cloneSectionItems(pautas),
        informes: Array.isArray(state?.mergeBases?.informes) ? cloneSectionItems(state.mergeBases.informes) : cloneSectionItems(informes),
    };
}

function isSameSectionItem(left, right) {
    return esc(left?.title) === esc(right?.title)
        && esc(left?.text) === esc(right?.text);
}

function hasMeetingIdentity() {
    return Boolean(esc(byId("numeroAta")?.value) && esc(byId("dataReuniao")?.value));
}

function buildMeetingKey(meta = {}) {
    const numero = sanitizeFilePart(meta.numero ?? byId("numeroAta")?.value ?? "ata");
    const data = esc(meta.data ?? byId("dataReuniao")?.value) || "sem-data";
    return `${numero}__${data}`;
}

function buildSectionContribution(section) {
    return {
        kind: CONTRIBUTION_KIND,
        version: CONTRIBUTION_VERSION,
        section,
        meetingKey: buildMeetingKey(),
        meta: {
            numero: esc(byId("numeroAta")?.value),
            data: esc(byId("dataReuniao")?.value),
            titulo: esc(byId("tituloReuniao")?.value),
        },
        exportedAt: new Date().toISOString(),
        baseItems: cloneSectionItems(mergeBases[section]),
        items: cloneSectionItems(getSectionItems(section)),
    };
}

function buildSectionContributionFileName(section) {
    return `Contribuicao_${getSectionLabel(section)}_FEPESCA_${buildMeetingToken()}_enviado-${formatTimestampNow()}.json`;
}

function buildSectionTextFileName(section) {
    return `Texto_Telegrafico_${getSectionLabel(section)}_FEPESCA_${buildMeetingToken()}.txt`;
}

function getSectionLabel(section) {
    return section === "informes" ? "Informes" : "Pautas";
}

function getSectionSingularLabel(section) {
    return section === "informes" ? "informe" : "pauta";
}

function buildIdentifierMapText() {
    const entries = getMemberIdentifierEntries();
    if (!entries.length) return "Identificadores:\n- sem mapeamento registrado";
    return `Identificadores:\n${entries.map((item) => `- ${item.identificador} = ${item.nome}`).join("\n")}`;
}

function buildSectionTelegraphicText(section) {
    const items = getSectionItems(section);
    const label = getSectionLabel(section).toUpperCase();
    const heading = esc(byId("tituloReuniao")?.value) || DEFAULT_COLEGIADO;
    const data = formatDateLonga(byId("dataReuniao")?.value);
    const numero = esc(byId("numeroAta")?.value) || "__/____";

    const blocos = items.map((item, index) => {
        const titulo = esc(item.title) || `${getSectionSingularLabel(section)} ${index + 1}`;
        const corpo = esc(item.text) || "[sem texto telegráfico]";
        return `${index + 1}. ${titulo}\n${corpo}`;
    });

    return [
        `${label} - ${heading}`,
        `Ata: ${numero}`,
        `Data: ${data}`,
        "",
        buildIdentifierMapText(),
        "",
        blocos.join("\n\n"),
    ].join("\n");
}

function exportarTextoTelegraficoSecao(section) {
    const items = getSectionItems(section);
    if (!items.length) {
        alert(`Nenhum item em ${getSectionLabel(section)} para exportar em texto.`);
        return;
    }

    const blob = new Blob([buildSectionTelegraphicText(section)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildSectionTextFileName(section);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Texto telegráfico de ${getSectionLabel(section)} exportado em .txt.`, "success");
}

function splitTelegraphicLines(texto) {
    return String(texto ?? "")
        .split(/\r?\n/)
        .map((line) => esc(line))
        .filter(Boolean);
}

function splitSpeakerAndContent(texto) {
    const [speakerPart, ...contentParts] = String(texto ?? "").split("|");
    return {
        speaker: esc(speakerPart),
        content: esc(contentParts.join("|")),
    };
}

function formatarLinhaTelegráficaParaAta(linha, tipo) {
    const match = linha.match(/^([A-Za-z]{1,3})\s*:\s*(.+)$/);
    if (!match) return linha;

    const codigo = match[1].toUpperCase();
    const conteudo = esc(match[2]);
    const { speaker, content } = splitSpeakerAndContent(conteudo);
    const speakerName = resolverNomeCompletoPorReferencia(speaker);

    if (tipo === "pauta") {
        if (codigo === "F") return speaker && content ? `registrou-se fala de ${speakerName}: ${content}` : conteudo;
        if (codigo === "A") return speaker && content ? `registrou-se adendo de ${speakerName}: ${content}` : conteudo;
        if (codigo === "D") return `deliberação: ${conteudo}`;
        if (codigo === "V") return `votação: ${conteudo}`;
        if (codigo === "E") return `encaminhamento: ${conteudo}`;
        if (codigo === "R") return `responsável: ${conteudo}`;
        if (codigo === "P") return `prazo: ${conteudo}`;
    }

    if (tipo === "informe") {
        if (codigo === "AP") return speaker && content ? `apresentação de ${speakerName}: ${content}` : conteudo;
        if (codigo === "C") return speaker && content ? `complemento de ${speakerName}: ${content}` : conteudo;
        if (codigo === "E") return `encaminhamento: ${conteudo}`;
        if (codigo === "R") return `responsável: ${conteudo}`;
        if (codigo === "P") return `prazo: ${conteudo}`;
    }

    return linha;
}

function formatarTextoTelegraficoParaAta(texto, tipo) {
    const linhas = splitTelegraphicLines(texto);
    if (!linhas.length) return "";
    return linhas
        .map((linha) => formatarLinhaTelegráficaParaAta(linha, tipo))
        .filter(Boolean)
        .join("; ");
}

function buildPromptSectionIA(section) {
    const label = getSectionLabel(section);
    const items = getSectionItems(section);
    if (!items.length) return `${label}:\n- Nenhum item registrado.`;

    const blocos = items.map((item, index) => {
        const linhas = splitTelegraphicLines(item.text);
        const header = `${index + 1}. ${esc(item.title) || `${getSectionSingularLabel(section)} ${index + 1}`}`;
        const body = linhas.length
            ? linhas.map((linha) => `   - ${linha}`).join("\n")
            : "   - sem tópicos telegráficos adicionais";
        return `${header}\n${body}`;
    });

    return `${label}:\n${blocos.join("\n\n")}`;
}

function gerarPromptIAAta() {
    const tipo = getTipoReuniaoAta();
    const colegiado = getColegiadoAta();
    const numero = esc(byId("numeroAta")?.value) || "__/____";
    const data = formatDateLonga(byId("dataReuniao")?.value);
    const local = esc(byId("localReuniao")?.value) || "local não informado";
    const presidente = esc(byId("presidente")?.value) || "presidência não informada";

    return [
        `Use o DOCX anexado como documento-base desta ${tipo} do ${colegiado}.`,
        "",
        "Objetivo:",
        "- transformar os tópicos telegráficos abaixo em texto institucional claro, coeso e conciso;",
        "- preservar fielmente o conteúdo factual da reunião;",
        "- aproveitar os nomes completos e o contexto institucional que já constam no DOCX.",
        "",
        "Regras obrigatórias:",
        "- Não invente fatos, falas, deliberações, votações, responsáveis ou prazos.",
        "- Considere que os identificadores curtos dos docentes correspondem aos nomes completos presentes no DOCX e na lista de presença.",
        "- Na primeira menção de cada docente, use o nome completo.",
        "- Nas menções seguintes, use Prof. ou Profa. + primeiro nome + sobrenome.",
        "- Preserve a ordem das falas quando isso ajudar a manter o sentido da discussão.",
        "- Se não houver votação, não invente votação.",
        "- Se não houver responsável ou prazo, não acrescente.",
        "- Converta os tópicos em linguagem acadêmica e administrativa, com boa fluidez e sem excesso de repetição.",
        "",
        "Identificação rápida da reunião:",
        `- Ata: ${numero}`,
        `- Data: ${data}`,
        `- Local: ${local}`,
        `- Presidência: ${presidente}`,
        "",
        buildIdentifierMapText(),
        "",
        buildPromptSectionIA("pautas"),
        "",
        buildPromptSectionIA("informes"),
    ].join("\n");
}

function renderPromptIA() {
    const out = byId("saidaPromptIA");
    if (!out) return;
    out.value = gerarPromptIAAta();
}

function truncateText(value, maxLength = 90) {
    const text = esc(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
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
    if (nome === "Nils Edvin Asp Neto") funcao = "Prof. Dr.";
    if (nome === "Rafael Anaisce das Chagas") funcao = "Prof. Dr.";
    if (nome === "Breno Portilho de Sousa Maia") funcao = "Representante dos Técnicos";

    return {
        ...membro,
        nome,
        identificador: esc(membro?.identificador),
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
        normalizados.push({ ...membro, identificador: "", status: "", motivo: "" });
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
            const textoInforme = formatarTextoTelegraficoParaAta(item.text, "informe");
            if (isResumida || !textoInforme) return finalizarFrase(item.title);
            return finalizarFrase(`${item.title}: ${textoInforme}`);
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
            const textoPauta = formatarTextoTelegraficoParaAta(item.text, "pauta");
            if (!textoPauta) {
                return `Em relação à pauta \"${item.title}\", registrou-se a discussão correspondente, sem detalhamento adicional nesta redação.`;
            }
            return `Em relação à pauta \"${item.title}\", ${finalizarFrase(textoPauta)}`;
        }).join(" ");
        paragraphs.push(discussoes);
    } else {
        paragraphs.push("Não constaram itens de pauta para deliberação nesta sessão.");
    }

    paragraphs.push(`Nada mais havendo a tratar, a reunião foi encerrada às ${horaFim}. Eu, ${redigidaPor}, lavrei a presente ata, de número ${numero}, que, após lida e aprovada, seguirá para os trâmites institucionais de assinatura.`);

    return reduzirReferenciasDocentes(paragraphs.filter(Boolean).join("\n\n"));
}

function reduzirReferenciasDocentes(texto) {
    let resultado = String(texto ?? "");

    getDocentesReferenciaveis().forEach((docente) => {
        const variantes = [`${docente.longPrefix} ${docente.nome}`, docente.nome]
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp);

        if (!variantes.length) return;

        let primeiraOcorrenciaMantida = false;
        const regex = new RegExp(variantes.join("|"), "g");

        resultado = resultado.replace(regex, (match) => {
            if (!primeiraOcorrenciaMantida) {
                primeiraOcorrenciaMantida = true;
                return match;
            }
            return docente.shortReference;
        });
    });

    return resultado;
}

function getDocentesReferenciaveis() {
    const vistos = new Set();
    const lista = [];

    [...membrosOriginais, ...membrosExtras].forEach((membro) => {
        const nome = esc(membro?.nome);
        const funcao = normalizarFuncaoMembro(membro?.funcao);
        if (!nome || !/^Prof\.|^Profa\./.test(funcao)) return;

        const chave = safeLower(nome);
        if (vistos.has(chave)) return;
        vistos.add(chave);

        const isDocenteMulher = funcao.startsWith("Profa.");
        const longPrefix = isDocenteMulher ? "Profa. Dra." : "Prof. Dr.";
        const shortPrefix = isDocenteMulher ? "Profa." : "Prof.";

        lista.push({
            nome,
            longPrefix,
            shortReference: `${shortPrefix} ${montarNomeCurtoDocente(nome)}`,
        });
    });

    return lista.sort((a, b) => b.nome.length - a.nome.length);
}

function montarNomeCurtoDocente(nomeCompleto) {
    const partes = esc(nomeCompleto).split(/\s+/).filter(Boolean);
    if (partes.length <= 2) return partes.join(" ");

    const primeiroNome = partes[0];
    const sobrenome = extrairSobrenomeCurto(partes);
    return sobrenome ? `${primeiroNome} ${sobrenome}` : primeiroNome;
}

function extrairSobrenomeCurto(partes) {
    if (!Array.isArray(partes) || partes.length <= 1) return "";

    const sobrenome = [partes[partes.length - 1]];
    let cursor = partes.length - 2;

    while (cursor > 0 && NAME_CONNECTORS.has(safeLower(partes[cursor]))) {
        sobrenome.unshift(partes[cursor]);
        cursor -= 1;
    }

    if (sobrenome.length === 1 && FAMILY_SUFFIXES.has(safeLower(sobrenome[0])) && cursor >= 1) {
        sobrenome.unshift(partes[cursor]);
    }

    return sobrenome.join(" ");
}

function escapeRegExp(value) {
    return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    renderPromptIA();
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
    const rows = [["Participante", "Identificador", "Função", "Presença", "Motivo"]];
    [...membrosOriginais, ...membrosExtras]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
        .forEach((item) => {
            rows.push([
                item.nome,
                item.identificador || "",
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
        mergeBases: {
            pautas: cloneSectionItems(mergeBases.pautas),
            informes: cloneSectionItems(mergeBases.informes),
        },
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
        restoreSectionBases();
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
        restoreSectionBases(state);
    } catch (error) {
        console.warn("Falha ao recuperar o estado salvo.", error);
        logos = { ...DEFAULT_LOGOS };
        setHoje();
        setPautasPadrao();
        setInformesPadrao();
        restoreSectionBases();
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
