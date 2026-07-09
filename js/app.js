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
// Identificador curto preferido por nome completo. Sobrescreve a sugestão automática
// e fica salvo no navegador junto com o estado da reunião.
const MEMBER_IDENTIFIER_OVERRIDES = {
    "Carlos Eduardo Rangel de Andrade": "Eduardo",
};
const getIdentificadorPreferido = (nome) => MEMBER_IDENTIFIER_OVERRIDES[esc(nome)] || "";
const REQUIRED_MEMBERS = [
    { nome: "Nils Edvin Asp Neto", funcao: "Prof. Dr." },
    { nome: "Rafael Anaisce das Chagas", funcao: "Prof. Dr." },
    { nome: "Angelo Renato Silva Tavares", funcao: "Representante Discente" },
    { nome: "Breno Portilho de Sousa Maia", funcao: "Representante dos Técnicos" },
];

const byId = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").trim();
const sortAlphaPT = (arr) => arr.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
const safeLower = (value) => esc(value).toLowerCase();
const REMOVED_MEMBER_NAMES = new Set([
    "ana luiza borges guedes",
]);
const isRemovedMemberName = (nome) => REMOVED_MEMBER_NAMES.has(safeLower(nome));
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
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let speechRecognition = null;
let speechRecognitionActive = false;
let speechRecognitionPaused = false;
let speechRecognitionBaseText = "";
let speechRecognitionFinalText = "";
let speechRecognitionSessionSpeaker = "";
let speechRecognitionSessionTheme = "";
let speechRecognitionBaseTheme = "";
let selectedSpeechParticipant = "";
let selectedSpeechTheme = "";
let salvarEstadoTimer = null;
let promptIATimer = null;
let speechRecognitionInterimText = "";
let pendingSpeakerSwitch = null;
let pendingSpeakerTimer = null;

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
        "Fulano | apresentou | situação do convênio e necessidade de ajuste",
        "Sicrano | complementou | que o órgão ainda não respondeu",
        "Beltrano | propôs | cobrar retorno até a próxima semana",
        "Decisão | aprovada a cobrança formal ao órgão",
        "Votação | aprovado por unanimidade",
        "Encaminhamento | secretaria enviará novo ofício",
        "Responsável | coordenação",
        "Prazo | próxima reunião",
    ].join("\n"),
    informe: [
        "Fulano | informou | previsão de visita técnica em junho",
        "Sicrano | complementou | necessidade de confirmar transporte",
        "Encaminhamento | confirmar logística, se necessário",
        "Responsável | coordenação",
        "Prazo | até 20/05",
    ].join("\n"),
};

const TELEGRAPHIC_LEGENDS = {
    pauta: {
        title: "Estrutura sugerida",
        note: "Use o identificador da lista de presença ou o nome completo. Registre as falas na ordem em que ocorreram.",
        items: [
            ["Nome | tipo de fala | conteúdo essencial", "linha principal de cada intervenção"],
            ["Decisão | resultado final", "fechamento da pauta"],
            ["Votação | resultado da votação", "use apenas quando houver"],
            ["Encaminhamento | ação definida", "providência prática aprovada"],
            ["Responsável | nome ou setor", "quem executa o encaminhamento"],
            ["Prazo | data ou marco", "quando retornar ao tema"],
        ],
    },
    informe: {
        title: "Estrutura sugerida",
        note: "Em informes, normalmente bastam as falas em sequência. Use encaminhamento, responsável e prazo só se o informe gerar ação.",
        items: [
            ["Nome | tipo de fala | conteúdo essencial", "linha principal de cada intervenção"],
            ["Encaminhamento | ação definida", "registre apenas se houver desdobramento"],
            ["Responsável | nome ou setor", "quem executa o encaminhamento"],
            ["Prazo | data ou marco", "quando haverá retorno"],
        ],
    },
};

const TELEGRAPHIC_LEGACY_SPEAKER_CODES = new Set(["F", "A", "AP", "C"]);
const TELEGRAPHIC_SPECIAL_LINE_LABELS = new Map([
    ["encaminhamento", "encaminhamento"],
    ["responsavel", "responsável"],
    ["prazo", "prazo"],
    ["decisao", "deliberação"],
    ["deliberacao", "deliberação"],
    ["votacao", "votação"],
    ["resultado", "resultado"],
]);
const TELEGRAPHIC_AUTOCOMPLETE_MIN_LENGTH = 3;
const TELEGRAPHIC_SPECIAL_LINE_SUGGESTIONS = [
    { value: "Decisão", description: "resultado final do tema" },
    { value: "Votação", description: "resultado da votação" },
    { value: "Encaminhamento", description: "ação definida" },
    { value: "Responsável", description: "quem executa" },
    { value: "Prazo", description: "data ou marco" },
    { value: "Resultado", description: "síntese do fechamento" },
];
const TELEGRAPHIC_ACTION_SUGGESTIONS = [
    { value: "apresentou", description: "abriu o relato do tema" },
    { value: "avaliou", description: "fez avaliação sobre o tema" },
    { value: "comentou", description: "fez observação breve" },
    { value: "informou", description: "trouxe dado ou atualização" },
    { value: "relatou", description: "descreveu fato ou situação" },
    { value: "explicou", description: "detalhou o ponto tratado" },
    { value: "complementou", description: "acrescentou informação" },
    { value: "esclareceu", description: "prestou esclarecimento" },
    { value: "destacou", description: "enfatizou aspecto importante" },
    { value: "ressaltou", description: "reforçou ponto relevante" },
    { value: "observou", description: "registrou observação" },
    { value: "mencionou", description: "fez referência a fato ou dado" },
    { value: "lembrou", description: "recordou informação anterior" },
    { value: "registrou", description: "consignou posição ou fato" },
    { value: "manifestou", description: "expressou posição" },
    { value: "ponderou", description: "apresentou ressalva ou cautela" },
    { value: "questionou", description: "levantou dúvida" },
    { value: "concordou", description: "aderiu ao entendimento apresentado" },
    { value: "discordou", description: "divergiu do entendimento apresentado" },
    { value: "propôs", description: "sugeriu encaminhamento" },
    { value: "sugeriu", description: "indicou possibilidade ou ajuste" },
    { value: "recomendou", description: "orientou providência" },
    { value: "solicitou", description: "pediu providência ou informação" },
    { value: "defendeu", description: "sustentou posicionamento" },
    { value: "apoiou", description: "deu suporte a proposta ou posição" },
    { value: "justificou", description: "apresentou motivo ou fundamento" },
    { value: "encaminhou", description: "formalizou proposta" },
];
const INFORME_AGENDA_KEYWORDS = [
    "pauta futura",
    "incluir em pauta",
    "inclusao em pauta",
    "proximo mes",
    "mes que vem",
    "proxima sessao",
    "ordem do dia",
];
const INFORME_ACTION_KEYWORDS = [
    "acao prevista",
    "levantamento",
    "levantar",
    "providenciar",
    "mapear",
    "agendar",
];

document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    setupHelpSubtopics();
    setupGlobalListeners();
    setupSpeechToText();

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
            activateTab(id, { scroll: true, triggerButton: btn });
        });
    });
}

function activateTab(id, options = {}) {
    const { scroll = false, triggerButton = null } = options;
    document.querySelectorAll(".tabbtn").forEach((item) => {
        item.classList.toggle("active", item === triggerButton || item.dataset.tab === id);
    });
    document.querySelectorAll(".tabcontent").forEach((item) => {
        item.classList.toggle("active", item.id === id);
    });
    if (id === "transcricao") {
        renderSpeechThemeOptions();
        renderSpeechSpeakerOptions();
    }
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupHelpSubtopics() {
    const links = [...document.querySelectorAll(".help-subnav-link[data-help-target]")];
    if (!links.length) return;

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const targetId = link.dataset.helpTarget;
            if (!targetId) return;
            setActiveHelpSubtopic(targetId);
        });
    });

    const defaultTarget = links[0]?.dataset.helpTarget;
    if (defaultTarget) setActiveHelpSubtopic(defaultTarget);
}

function setActiveHelpSubtopic(targetId) {
    document.querySelectorAll(".help-panel[id]").forEach((panel) => {
        panel.classList.toggle("active", panel.id === targetId);
    });
    document.querySelectorAll(".help-subnav-link[data-help-target]").forEach((link) => {
        const isActive = link.dataset.helpTarget === targetId;
        link.classList.toggle("active", isActive);
        if (isActive) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
    });
}

function on(id, eventName, handler) {
    const element = byId(id);
    if (element) element.addEventListener(eventName, handler);
}

function setupGlobalListeners() {
    on("btnNovaReuniao", "click", () => {
        if (confirm("Tem certeza que deseja apagar todos os dados e iniciar uma nova reunião? Essa ação não pode ser desfeita e todos os formulários serão zerados.")) {
            localStorage.removeItem(STORAGE_KEY);
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const suggestNumber = `${month}/${year}`;
            
            // Cria os dados básicos com a data atual e o número sugerido da ata para o reload.
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                "numeroAta": suggestNumber,
                "dataReuniao": now.toISOString().slice(0,10)
            }));
            
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
    on("btnIniciarDitado", "click", iniciarTranscricaoFala);
    on("btnPararDitado", "click", pararTranscricaoFala);
    on("btnLimparTranscricao", "click", limparTranscricaoTexto);

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

    on("transcricaoAudio", "input", () => syncTranscriptDerivedState());
    on("transcricaoFalanteAtual", "input", (event) => {
        selectedSpeechParticipant = esc(event.target.value);
    });
    on("transcricaoFalanteAtual", "change", (event) => commitSpeechSpeakerValue(event.target));
    on("transcricaoFalanteAtual", "blur", (event) => commitSpeechSpeakerValue(event.target));
    on("transcricaoFalantesRapidos", "click", (event) => {
        const botao = event.target.closest(".speaker-chip");
        if (!botao) return;
        selecionarFalanteRapido(botao.dataset.nome);
    });
    on("transcricaoTemasLista", "click", (event) => {
        const botao = event.target.closest(".tema-chip");
        if (!botao) return;
        selecionarTemaRapido(botao.dataset.tema);
    });
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

function setupSpeechToText() {
    updateSpeechControls("Preparando ditado...", "connecting");
    if (!SpeechRecognitionCtor) {
        updateSpeechControls("Ditado indisponível", "disabled");
        const startBtn = byId("btnIniciarDitado");
        const stopBtn = byId("btnPararDitado");
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        return;
    }

    speechRecognition = new SpeechRecognitionCtor();
    speechRecognition.lang = "pt-BR";
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.maxAlternatives = 1;

    speechRecognition.onstart = () => {
        speechRecognitionActive = true;
        speechRecognitionPaused = false;
        updateSpeechControls("Ouvindo...", "listening");
    };

    speechRecognition.onresult = (event) => {
        let interimText = "";
        let hasFinalResult = false;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = normalizeSpeechFragment(result?.[0]?.transcript);
            if (!transcript) continue;
            if (result.isFinal) {
                speechRecognitionFinalText = joinSpeechFragments(speechRecognitionFinalText, transcript);
                hasFinalResult = true;
            }
            else interimText = joinSpeechFragments(interimText, transcript);
        }
        speechRecognitionInterimText = interimText;
        if (hasFinalResult && pendingSpeakerSwitch) {
            aplicarTrocaFalantePendente();
            applySpeechTranscriptToField(interimText, { persist: true });
        } else {
            applySpeechTranscriptToField(interimText, { persist: hasFinalResult });
        }
    };

    speechRecognition.onerror = (event) => {
        const errorCode = event?.error || "erro-desconhecido";
        if (errorCode !== "aborted") {
            showToast(mapSpeechRecognitionError(errorCode), "info");
            speechRecognitionPaused = false;
        }
    };

    speechRecognition.onend = () => {
        speechRecognitionActive = false;
        cancelarTrocaFalantePendente();
        speechRecognitionInterimText = "";
        applySpeechTranscriptToField("", { persist: true });
        finalizeSpeechTranscriptField();
        updateSpeechControls(speechRecognitionPaused ? "Ditado em pausa" : "Pronto para ouvir", speechRecognitionPaused ? "paused" : "idle");
        speechRecognitionSessionSpeaker = "";
    };

    updateSpeechControls("Pronto para ouvir", "idle");
}

function updateSpeechControls(statusText, state = "idle") {
    const startBtn = byId("btnIniciarDitado");
    const stopBtn = byId("btnPararDitado");
    const status = byId("statusTranscricaoFala");
    const isBusy = state === "listening" || state === "connecting";
    const isPaused = state === "paused";
    if (status) {
        status.textContent = statusText;
        status.dataset.state = state;
    }
    if (startBtn) {
        startBtn.disabled = !SpeechRecognitionCtor || isBusy;
        startBtn.textContent = isPaused ? "▶️ Retomar ditado" : "🎤 Iniciar ditado";
    }
    if (stopBtn) {
        stopBtn.disabled = !SpeechRecognitionCtor || state !== "listening";
        stopBtn.textContent = "⏸️ Pausar";
    }
}

function normalizeSpeechFragment(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function syncTranscriptDerivedState(options = {}) {
    const { persist = true } = options;
    agendarRenderPromptIA();
    if (persist) agendarSalvarEstado();
}

function finalizeSpeechText(value) {
    const trimmed = String(value ?? "").trimEnd();
    if (!trimmed) return "";

    const trailingMatch = trimmed.match(/(["'”’)\]]+)$/u);
    const trailing = trailingMatch ? trailingMatch[1] : "";
    const core = trailing ? trimmed.slice(0, -trailing.length).trimEnd() : trimmed;
    if (!core) return trimmed;
    if (/[.!?…]$/u.test(core)) return `${core}${trailing}`;

    const cleanedCore = core.replace(/[,:;\-–—]+$/u, "").trimEnd();
    return `${cleanedCore || core}.${trailing}`;
}

function capitalizeSpeechBlock(value) {
    const chars = Array.from(String(value ?? ""));
    for (let index = 0; index < chars.length; index += 1) {
        const char = chars[index];
        if (char.toLocaleLowerCase("pt-BR") !== char.toLocaleUpperCase("pt-BR")) {
            chars[index] = char.toLocaleUpperCase("pt-BR");
            break;
        }
    }
    return chars.join("");
}

function buildSpeechSpeakerOptionLabel(item) {
    const baseLabel = item.identificador && safeLower(item.identificador) !== safeLower(item.nome)
        ? `${item.identificador} — ${item.nome}`
        : item.nome;
    return item.funcao && item.funcao !== "—"
        ? `${baseLabel} (${item.funcao})`
        : baseLabel;
}

function findSpeechSpeakerEntry(rawValue) {
    const target = safeLower(rawValue);
    if (!target) return null;

    const entries = getMemberIdentifierEntries();
    const exact = entries.find((item) => safeLower(item.nome) === target || safeLower(item.identificador) === target);
    if (exact) return exact;

    const partial = entries.filter((item) => safeLower(item.nome).startsWith(target) || safeLower(item.identificador).startsWith(target));
    return partial.length === 1 ? partial[0] : null;
}

function normalizeSpeechSpeakerValue(rawValue) {
    const text = esc(rawValue);
    if (!text) return "";
    return findSpeechSpeakerEntry(text)?.nome || text;
}

function commitSpeechSpeakerValue(input) {
    if (!input) return;
    const normalized = normalizeSpeechSpeakerValue(input.value);
    selectedSpeechParticipant = normalized;
    input.value = normalized;
    salvarEstado();
}

function resolverIdentificadorPorReferencia(referencia) {
    const membro = encontrarMembroPorReferencia(referencia);
    return membro ? esc(membro.identificador) : esc(referencia);
}

function getSelectedSpeechSpeaker() {
    const liveValue = byId("transcricaoFalanteAtual")?.value;
    const ref = normalizeSpeechSpeakerValue(liveValue || selectedSpeechParticipant);
    return resolverIdentificadorPorReferencia(ref);
}

const SPEECH_THEME_PREFIX = "### ";

function buildSpeechThemeHeading(label) {
    const tema = esc(label);
    return tema ? `${SPEECH_THEME_PREFIX}${tema}` : "";
}

function detectLastThemeFromText(text) {
    const marcador = SPEECH_THEME_PREFIX.trim();
    const linhas = String(text ?? "").split("\n");
    for (let index = linhas.length - 1; index >= 0; index -= 1) {
        const linha = linhas[index].trim();
        if (linha.startsWith(marcador)) {
            return esc(linha.slice(marcador.length));
        }
    }
    return "";
}

function textoTerminaEmCabecalho(text) {
    const marcador = SPEECH_THEME_PREFIX.trim();
    const linhas = String(text ?? "").trimEnd().split("\n");
    const ultima = (linhas[linhas.length - 1] || "").trim();
    return ultima.startsWith(marcador);
}

function appendThemeHeadingToBase(baseText, tema) {
    const heading = buildSpeechThemeHeading(tema);
    if (!heading) return String(baseText ?? "").trimEnd();
    const base = String(baseText ?? "").trimEnd();
    if (!base) return heading;
    const baseFinalizada = textoTerminaEmCabecalho(base) ? base : finalizeSpeechText(base);
    return `${baseFinalizada}\n\n${heading}`;
}

function buildSpeechBlockText(value, speakerLabel = speechRecognitionSessionSpeaker) {
    const text = normalizeSpeechFragment(value);
    if (!text) return "";
    const prefix = esc(speakerLabel) ? `${esc(speakerLabel)}: ` : "";
    return `${prefix}${capitalizeSpeechBlock(text)}`;
}

function appendSpeechBlock(baseText, blockText, options = {}) {
    const { sessionTheme = "", baseTheme = "", finalizeBlock = false } = options;
    const base = String(baseText ?? "").trimEnd();
    const bloco = finalizeBlock ? finalizeSpeechText(blockText) : blockText;
    if (!bloco) return base;
    const precisaCabecalho = esc(sessionTheme) && safeLower(sessionTheme) !== safeLower(baseTheme);
    const heading = precisaCabecalho ? buildSpeechThemeHeading(sessionTheme) : "";
    if (!base) {
        return heading ? `${heading}\n${bloco}` : bloco;
    }
    const baseFinalizada = textoTerminaEmCabecalho(base) ? base : finalizeSpeechText(base);
    if (heading) {
        return `${baseFinalizada}\n\n${heading}\n${bloco}`;
    }
    return `${baseFinalizada}\n${bloco}`;
}

function composeSpeechTranscriptText(baseText, liveText, speakerLabel = speechRecognitionSessionSpeaker, sessionTheme = speechRecognitionSessionTheme, baseTheme = speechRecognitionBaseTheme) {
    const bloco = buildSpeechBlockText(liveText, speakerLabel);
    if (!bloco) return String(baseText ?? "").trimEnd();
    return appendSpeechBlock(baseText, bloco, { sessionTheme, baseTheme });
}

function autoScrollTranscricao(textarea) {
    if (!textarea) return;
    // Rola sempre ate o fim; o padding-bottom do CSS garante folga para a
    // ultima linha nao colar na borda inferior. Mais confiavel que calcular
    // linhas/alturas manualmente.
    textarea.scrollTop = textarea.scrollHeight;
}

function agendarSalvarEstado(delay = 400) {
    if (salvarEstadoTimer) clearTimeout(salvarEstadoTimer);
    salvarEstadoTimer = setTimeout(() => {
        salvarEstadoTimer = null;
        salvarEstado();
    }, delay);
}

function flushSalvarEstado() {
    if (salvarEstadoTimer) {
        clearTimeout(salvarEstadoTimer);
        salvarEstadoTimer = null;
    }
    salvarEstado();
}

function agendarRenderPromptIA(delay = 300) {
    if (promptIATimer) clearTimeout(promptIATimer);
    promptIATimer = setTimeout(() => {
        promptIATimer = null;
        renderPromptIA();
    }, delay);
}

function commitLiveBlockToBase() {
    const bloco = buildSpeechBlockText(speechRecognitionFinalText, speechRecognitionSessionSpeaker);
    if (!bloco) return;
    speechRecognitionBaseText = appendSpeechBlock(speechRecognitionBaseText, bloco, {
        sessionTheme: speechRecognitionSessionTheme,
        baseTheme: speechRecognitionBaseTheme,
        finalizeBlock: true,
    });
    if (esc(speechRecognitionSessionTheme)) {
        speechRecognitionBaseTheme = speechRecognitionSessionTheme;
    }
    speechRecognitionFinalText = "";
}

function joinSpeechFragments(baseText, fragment) {
    const left = normalizeSpeechFragment(baseText);
    const right = normalizeSpeechFragment(fragment);
    if (!left) return right;
    if (!right) return left;
    return `${left} ${right}`;
}

function buildSpeechTranscriptText(interimText = "") {
    const baseText = String(speechRecognitionBaseText ?? "").trimEnd();
    const liveText = joinSpeechFragments(speechRecognitionFinalText, interimText);
    return composeSpeechTranscriptText(baseText, liveText, speechRecognitionSessionSpeaker, speechRecognitionSessionTheme, speechRecognitionBaseTheme);
}

function applySpeechTranscriptToField(interimText = "", options = {}) {
    const { persist = false } = options;
    const textarea = byId("transcricaoAudio");
    if (!textarea) return;
    const nextValue = buildSpeechTranscriptText(interimText);
    if (textarea.value !== nextValue) {
        textarea.value = nextValue;
        syncTranscriptDerivedState({ persist });
    }
    const cursor = textarea.value.length;
    textarea.setSelectionRange(cursor, cursor);
    autoScrollTranscricao(textarea);
}

function finalizeSpeechTranscriptField() {
    const textarea = byId("transcricaoAudio");
    if (!textarea) return;
    const finalizedValue = finalizeSpeechText(textarea.value);
    if (textarea.value !== finalizedValue) {
        textarea.value = finalizedValue;
        syncTranscriptDerivedState({ persist: true });
    }
    const cursor = textarea.value.length;
    textarea.setSelectionRange(cursor, cursor);
    autoScrollTranscricao(textarea);
}

function limparTranscricaoTexto() {
    const textarea = byId("transcricaoAudio");
    if (!textarea) return;

    const hasText = Boolean(esc(textarea.value) || esc(speechRecognitionBaseText) || esc(speechRecognitionFinalText));
    if (!hasText && !speechRecognitionActive) return;

    const message = speechRecognitionActive
        ? "Limpar a transcrição atual? O ditado será interrompido e o texto será apagado."
        : "Limpar toda a transcrição atual?";
    if (!confirm(message)) return;

    speechRecognitionBaseText = "";
    speechRecognitionFinalText = "";
    speechRecognitionSessionSpeaker = "";
    speechRecognitionSessionTheme = "";
    speechRecognitionBaseTheme = "";
    speechRecognitionInterimText = "";
    cancelarTrocaFalantePendente();

    textarea.value = "";
    syncTranscriptDerivedState({ persist: true });
    textarea.focus();
    textarea.setSelectionRange(0, 0);

    if (speechRecognition && speechRecognitionActive) {
        speechRecognitionPaused = false;
        updateSpeechControls("Encerrando e limpando transcrição...", "connecting");
        speechRecognition.stop();
    } else {
        updateSpeechControls("Pronto para ouvir", SpeechRecognitionCtor ? "idle" : "disabled");
    }

    showToast("Transcrição limpa.", "success");
}

function getSpeechSpeakerEntries() {
    garantirIdentificadoresMembros();
    return getTodosMembros()
        .map((membro) => ({
            nome: esc(membro.nome),
            identificador: esc(membro.identificador),
            funcao: esc(membro.funcao),
            presente: membro.status === "presente",
        }))
        .filter((item) => item.nome && item.identificador)
        .sort((a, b) => {
            if (a.presente !== b.presente) return a.presente ? -1 : 1;
            return a.identificador.localeCompare(b.identificador, "pt-BR", { sensitivity: "base" });
        });
}

function updateActiveSpeakerLabel(nome) {
    const label = byId("transcricaoFalanteAtualLabel");
    if (label) label.textContent = `Falante: ${esc(nome) || "—"}`;
}

function buildConducaoNomeFormatado(membro) {
    const nome = esc(membro.nome);
    const funcao = esc(membro.funcao);
    if (!nome) return "";
    return /prof|dr/i.test(funcao) ? `${funcao} ${nome}` : nome;
}

function renderConducaoSugestoes() {
    const presentes = getTodosMembros()
        .filter((membro) => membro.status === "presente" && esc(membro.nome))
        .map(buildConducaoNomeFormatado)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    const options = presentes.map((nome) => `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`).join("");
    ["presidente", "redigidaPor"].forEach((id) => {
        const select = byId(id);
        const selectedValue = select?.value;
        if (select) {
            let htmlOptions = '<option value="Prof. Dr. Carlos Alberto Martins Cordeiro">Prof. Dr. Carlos Alberto Martins Cordeiro</option>';
            htmlOptions += '<option value="Prof. Dr. Evaldo Martins da Silva">Prof. Dr. Evaldo Martins da Silva</option>';
            htmlOptions += '<option value="Profa. Dra. Simoni Santos">Profa. Dra. Simoni Santos</option>';
            htmlOptions += '<option value="Outro">Outro...</option>';
            // Adicionar opções dinâmicas dos presentes, se ainda não estiverem na lista padrão
            const padroes = ["Prof. Dr. Carlos Alberto Martins Cordeiro", "Prof. Dr. Evaldo Martins da Silva", "Profa. Dra. Simoni Santos", "Outro"];
            presentes.forEach((nome) => {
                if (!padroes.includes(nome)) {
                    htmlOptions += `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`;
                }
            });
            select.innerHTML = htmlOptions;
            if (selectedValue) {
                select.value = selectedValue;
            }
        }
    });
}

function renderSpeechSpeakerOptions() {
    const input = byId("transcricaoFalanteAtual");
    const datalist = byId("transcricaoFalanteSugestoes");
    if (!input || !datalist) return;

    const entries = getSpeechSpeakerEntries();
    const wantedValue = normalizeSpeechSpeakerValue(selectedSpeechParticipant || input.value);

    datalist.innerHTML = entries.map((item) => {
        const label = buildSpeechSpeakerOptionLabel(item);
        return `<option value="${escapeHtml(item.nome)}" label="${escapeHtml(label)}"></option>`;
    }).join("");

    const lista = byId("transcricaoFalantesRapidos");
    if (lista) {
        const ativo = safeLower(wantedValue);
        lista.innerHTML = entries.map((item) => {
            const classes = ["speaker-chip"];
            if (item.presente) classes.push("is-present");
            if (ativo && safeLower(item.nome) === ativo) classes.push("is-active");
            const detalhe = item.identificador !== item.nome ? item.nome : item.funcao;
            const titulo = detalhe ? `${item.nome}${item.funcao ? ` — ${item.funcao}` : ""}` : item.nome;
            return `<button type="button" class="${classes.join(" ")}" data-nome="${escapeHtml(item.nome)}" title="${escapeHtml(titulo)}">${escapeHtml(item.identificador)}</button>`;
        }).join("");
    }

    selectedSpeechParticipant = wantedValue;
    input.value = wantedValue;
    updateActiveSpeakerLabel(resolverIdentificadorPorReferencia(wantedValue));
}

function marcarFalanteAtivoRapido(nome) {
    const lista = byId("transcricaoFalantesRapidos");
    const alvo = safeLower(normalizeSpeechSpeakerValue(nome));
    if (lista) {
        lista.querySelectorAll(".speaker-chip").forEach((chip) => {
            const ativo = alvo && safeLower(chip.getAttribute("data-nome")) === alvo;
            chip.classList.toggle("is-active", ativo);
        });
    }
    updateActiveSpeakerLabel(resolverIdentificadorPorReferencia(nome));
}

function getSpeechThemes() {
    const temas = [];
    pautas.forEach((item, index) => {
        const ordem = index + 1;
        const titulo = esc(item.title);
        const label = titulo ? `Pauta ${ordem} — ${titulo}` : `Pauta ${ordem}`;
        temas.push({ kind: "pauta", ordem, titulo: titulo || `Pauta ${ordem}`, label });
    });
    informes.forEach((item, index) => {
        const ordem = index + 1;
        const titulo = esc(item.title);
        const label = titulo ? `Informe ${ordem} — ${titulo}` : `Informe ${ordem}`;
        temas.push({ kind: "informe", ordem, titulo: titulo || `Informe ${ordem}`, label });
    });
    return temas;
}

function updateActiveThemeLabel(label) {
    const el = byId("transcricaoTemaAtualLabel");
    if (el) el.textContent = `Tema: ${esc(label) || "—"}`;
}

function renderSpeechThemeOptions() {
    const lista = byId("transcricaoTemasLista");
    if (!lista) return;
    const temas = getSpeechThemes();
    if (!temas.length) {
        lista.innerHTML = '<p class="helper">Nenhuma pauta ou informe cadastrado ainda. Crie temas nas abas Pautas e Informes.</p>';
        updateActiveThemeLabel(selectedSpeechTheme);
        return;
    }
    const ativo = safeLower(selectedSpeechTheme);
    lista.innerHTML = temas.map((tema) => {
        const classes = ["tema-chip", `tema-${tema.kind}`];
        if (ativo && safeLower(tema.label) === ativo) classes.push("is-active");
        return `<button type="button" class="${classes.join(" ")}" data-tema="${escapeHtml(tema.label)}" title="${escapeHtml(tema.label)}">
            <span class="tema-chip-kind">${tema.kind === "pauta" ? "Pauta" : "Informe"} ${tema.ordem}</span>
            <span class="tema-chip-title">${escapeHtml(tema.titulo)}</span>
        </button>`;
    }).join("");
    updateActiveThemeLabel(selectedSpeechTheme);
}

function selecionarTemaRapido(label) {
    const tema = esc(label);
    if (!tema) return;
    selectedSpeechTheme = tema;

    const textarea = byId("transcricaoAudio");

    if (speechRecognitionActive) {
        // Fecha o bloco da fala atual sob o tema anterior.
        commitLiveBlockToBase();
        // Insere o cabecalho do novo tema imediatamente na base, se mudou.
        if (safeLower(speechRecognitionBaseTheme) !== safeLower(tema)) {
            speechRecognitionBaseText = appendThemeHeadingToBase(speechRecognitionBaseText, tema);
            speechRecognitionBaseTheme = tema;
        }
        speechRecognitionSessionTheme = tema;
        applySpeechTranscriptToField("", { persist: true });
    } else if (textarea) {
        // Sem ditado ativo: insere o cabecalho diretamente no texto visivel.
        const atual = detectLastThemeFromText(textarea.value);
        if (safeLower(atual) !== safeLower(tema)) {
            textarea.value = appendThemeHeadingToBase(textarea.value, tema);
            syncTranscriptDerivedState({ persist: true });
            autoScrollTranscricao(textarea);
        }
    }

    updateActiveThemeLabel(tema);
    agendarSalvarEstado();
    renderSpeechThemeOptions();
}

function trocarFalanteAtivo(novoIdentificador) {
    commitLiveBlockToBase();
    speechRecognitionSessionSpeaker = novoIdentificador;
    applySpeechTranscriptToField("", { persist: true });
}

function aplicarTrocaFalantePendente() {
    if (!pendingSpeakerSwitch) return;
    const { identificador, nome } = pendingSpeakerSwitch;
    cancelarTrocaFalantePendente();
    commitLiveBlockToBase();
    speechRecognitionSessionSpeaker = identificador;
    selectedSpeechParticipant = nome;
    const input = byId("transcricaoFalanteAtual");
    if (input) input.value = nome;
    marcarFalanteAtivoRapido(nome);
    agendarSalvarEstado();
}

function cancelarTrocaFalantePendente() {
    pendingSpeakerSwitch = null;
    if (pendingSpeakerTimer) {
        clearTimeout(pendingSpeakerTimer);
        pendingSpeakerTimer = null;
    }
}

function selecionarFalanteRapido(nome) {
    const nomeFinal = normalizeSpeechSpeakerValue(nome);
    if (!nomeFinal) return;
    const identificador = resolverIdentificadorPorReferencia(nomeFinal);

    const input = byId("transcricaoFalanteAtual");
    selectedSpeechParticipant = nomeFinal;
    if (input) input.value = nomeFinal;

    if (speechRecognitionActive) {
        if (esc(speechRecognitionInterimText)) {
            // Há fala em andamento ainda sendo reconhecida: enfileira a troca
            // para não misturar os resíduos da fala atual no novo falante.
            pendingSpeakerSwitch = { identificador, nome: nomeFinal };
            if (pendingSpeakerTimer) clearTimeout(pendingSpeakerTimer);
            pendingSpeakerTimer = setTimeout(() => {
                pendingSpeakerTimer = null;
                if (pendingSpeakerSwitch && speechRecognitionActive) {
                    aplicarTrocaFalantePendente();
                    applySpeechTranscriptToField(speechRecognitionInterimText, { persist: true });
                }
            }, 1200);
        } else {
            cancelarTrocaFalantePendente();
            trocarFalanteAtivo(identificador);
            agendarSalvarEstado();
        }
    } else {
        iniciarTranscricaoFala();
    }

    marcarFalanteAtivoRapido(nomeFinal);
}

function mapSpeechRecognitionError(errorCode) {
    const messages = {
        "audio-capture": "Nenhum microfone foi encontrado para o ditado.",
        "network": "O navegador não conseguiu processar o ditado agora.",
        "not-allowed": "Permissão de microfone negada para o ditado.",
        "service-not-allowed": "O serviço de ditado do navegador não está disponível.",
        "no-speech": "Nenhuma fala foi detectada no ditado.",
        "aborted": "Ditado interrompido.",
    };
    return messages[errorCode] || "Não foi possível concluir o ditado por voz.";
}

function iniciarTranscricaoFala() {
    if (!speechRecognition) {
        alert("O ditado por voz depende do reconhecimento de fala do navegador. Use Edge ou Chrome.");
        return;
    }
    if (speechRecognitionActive) return;

    const textarea = byId("transcricaoAudio");
    if (!textarea) return;

    const wasPaused = speechRecognitionPaused;
    speechRecognitionBaseText = String(textarea.value ?? "").trimEnd();
    speechRecognitionBaseTheme = detectLastThemeFromText(speechRecognitionBaseText);
    speechRecognitionSessionTheme = esc(selectedSpeechTheme) || speechRecognitionBaseTheme;
    speechRecognitionFinalText = "";
    speechRecognitionInterimText = "";
    cancelarTrocaFalantePendente();
    speechRecognitionSessionSpeaker = getSelectedSpeechSpeaker();
    speechRecognitionPaused = false;
    updateSpeechControls(wasPaused ? "Retomando ditado..." : "Conectando microfone...", "connecting");

    try {
        speechRecognition.start();
    } catch (error) {
        console.error(error);
        speechRecognitionPaused = wasPaused;
        updateSpeechControls(wasPaused ? "Ditado em pausa" : "Falha ao iniciar o ditado", wasPaused ? "paused" : "idle");
        showToast("Não foi possível iniciar o ditado agora. Tente novamente.", "info");
    }
}

function pararTranscricaoFala() {
    if (!speechRecognition || !speechRecognitionActive) return;
    speechRecognitionPaused = true;
    updateSpeechControls("Pausando ditado...", "connecting");
    speechRecognition.stop();
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
    const preferido = getIdentificadorPreferido(nome);
    if (preferido) return preferido;
    const opcoes = buildBaseIdentifierOptions(nome);
    const primeiroNome = opcoes[0] || nome;
    const repeticoesPrimeiroNome = todos.filter((item) => safeLower(getFirstRelevantNamePart(item?.nome)) === safeLower(primeiroNome)).length;
    if (repeticoesPrimeiroNome <= 1) return primeiroNome;
    return opcoes.find((opcao) => opcao.includes(" ")) || nome;
}

function garantirIdentificadoresMembros() {
    const todos = getTodosMembros();
    todos.forEach((membro) => {
        const preferido = getIdentificadorPreferido(membro.nome);
        if (preferido) {
            membro.identificador = preferido;
        } else if (!esc(membro.identificador)) {
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
            if (isRemovedMemberName(novoNome)) {
                alert("Este participante foi removido da lista de presença.");
                return;
            }
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

    renderSpeechSpeakerOptions();
    renderConducaoSugestoes();
}

function addNovoMembro() {
    const nome = esc(byId("novoNome")?.value);
    const funcao = esc(byId("novaFuncao")?.value) || "—";
    if (!nome) return;
    if (isRemovedMemberName(nome)) {
        alert("Este participante foi removido da lista de presença.");
        return;
    }

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
        ? "Use uma linha por intervenção, na ordem das falas. Modelo sugerido: Nome | tipo de fala | conteúdo essencial. Após 3 letras, pressione TAB para aceitar a primeira sugestão. Feche a pauta com Decisão, Votação, Encaminhamento, Responsável e Prazo quando houver."
        : "Use uma linha por intervenção. Modelo sugerido: Nome | tipo de fala | conteúdo essencial. Após 3 letras, pressione TAB para aceitar a primeira sugestão. Se o informe gerar ação, registre Encaminhamento, Responsável e Prazo.";

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
                <span class="item-label">Registro telegráfico</span>
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

function normalizeTelegraphicLabel(text) {
    return safeLower(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function isSpecialTelegraphicLabelPrefix(text) {
    const normalized = normalizeTelegraphicLabel(text);
    if (!normalized) return false;
    return [...TELEGRAPHIC_SPECIAL_LINE_LABELS.keys()].some((item) => item.startsWith(normalized));
}

function parseLegacyTelegraphicAutocompleteContext(prefix) {
    const match = prefix.match(/^\s*([A-Za-z]{1,3})\s*:\s*([^|\n]*)$/);
    if (!match) return null;

    const codigo = match[1].toUpperCase();
    if (!TELEGRAPHIC_LEGACY_SPEAKER_CODES.has(codigo)) return null;

    return {
        mode: "legacy",
        codigo,
        typedIdentifier: esc(match[2]),
    };
}

function parseStructuredTelegraphicAutocompleteContext(prefix) {
    if (prefix.includes("|")) return null;

    const typedIdentifier = esc(prefix);
    if (!typedIdentifier) return null;

    return {
        mode: "structured-start",
        typedIdentifier,
    };
}

function getTelegraphicAutocompleteContext(textarea) {
    const value = String(textarea?.value ?? "");
    const cursor = Number(textarea?.selectionStart ?? value.length);
    const lineStart = value.lastIndexOf("\n", Math.max(cursor - 1, 0)) + 1;
    const nextBreak = value.indexOf("\n", cursor);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lineFull = value.slice(lineStart, lineEnd);
    const cursorInLine = cursor - lineStart;
    const firstPipeIndex = lineFull.indexOf("|");
    const secondPipeIndex = firstPipeIndex >= 0 ? lineFull.indexOf("|", firstPipeIndex + 1) : -1;

    if (firstPipeIndex >= 0 && cursorInLine > firstPipeIndex) {
        if (secondPipeIndex >= 0 && cursorInLine > secondPipeIndex) return null;

        const typedAction = esc(lineFull.slice(firstPipeIndex + 1, cursorInLine));
        if (!typedAction) return null;

        return {
            lineStart,
            lineEnd,
            cursor,
            mode: "structured-action",
            typedIdentifier: typedAction,
        };
    }

    const prefix = value.slice(lineStart, cursor);
    const parsedContext = parseLegacyTelegraphicAutocompleteContext(prefix)
        || parseStructuredTelegraphicAutocompleteContext(prefix);
    if (!parsedContext) return null;

    return {
        lineStart,
        lineEnd,
        cursor,
        ...parsedContext,
    };
}

function getAutocompleteIdentifierSuggestions(typedIdentifier) {
    const query = safeLower(typedIdentifier);
    if (query.length < TELEGRAPHIC_AUTOCOMPLETE_MIN_LENGTH) return [];
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
        .slice(0, 6)
        .map((item) => ({
            value: item.identificador,
            primary: item.identificador,
            secondary: item.nome,
        }));
}

function getAutocompleteSpecialLineSuggestions(typedText) {
    const query = normalizeTelegraphicLabel(typedText);
    if (query.length < TELEGRAPHIC_AUTOCOMPLETE_MIN_LENGTH) return [];
    return TELEGRAPHIC_SPECIAL_LINE_SUGGESTIONS
        .filter((item) => normalizeTelegraphicLabel(item.value).startsWith(query))
        .map((item) => ({
            value: item.value,
            primary: item.value,
            secondary: item.description,
        }));
}

function getAutocompleteActionSuggestions(typedText) {
    const query = normalizeTelegraphicLabel(typedText);
    if (query.length < TELEGRAPHIC_AUTOCOMPLETE_MIN_LENGTH) return [];
    return TELEGRAPHIC_ACTION_SUGGESTIONS
        .filter((item) => normalizeTelegraphicLabel(item.value).startsWith(query))
        .map((item) => ({
            value: item.value,
            primary: item.value,
            secondary: item.description,
        }));
}

function getTelegraphicAutocompleteSuggestions(context) {
    if (!context) return [];
    if (context.mode === "legacy") return getAutocompleteIdentifierSuggestions(context.typedIdentifier);
    if (context.mode === "structured-action") return getAutocompleteActionSuggestions(context.typedIdentifier);
    return [
        ...getAutocompleteIdentifierSuggestions(context.typedIdentifier),
        ...getAutocompleteSpecialLineSuggestions(context.typedIdentifier),
    ].slice(0, 8);
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

    const suggestions = getTelegraphicAutocompleteSuggestions(context);
    if (!suggestions.length) {
        container.hidden = true;
        container.innerHTML = "";
        return [];
    }

    container.hidden = false;
    container.innerHTML = suggestions.map((item, index) => `
        <button type="button" class="autocomplete-option" data-index="${index}">
            <strong>${escapeHtml(item.primary)}</strong>
            <span>${escapeHtml(item.secondary || "")}</span>
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

    if (context.mode === "legacy") {
        const existingContent = pipeIndex >= 0 ? esc(linhaAtual.slice(pipeIndex + 1)) : "";
        const prefix = `${context.codigo}: ${suggestion.value} | `;
        const novaLinha = existingContent ? `${prefix}${existingContent}` : prefix;

        textarea.value = `${before}${novaLinha}${afterLine}`;
        const nextCursor = before.length + prefix.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        return true;
    }

    if (context.mode === "structured-action") {
        const firstPipe = linhaAtual.indexOf("|");
        if (firstPipe < 0) return false;

        const secondPipe = linhaAtual.indexOf("|", firstPipe + 1);
        const speaker = esc(linhaAtual.slice(0, firstPipe));
        const suffix = secondPipe >= 0 ? linhaAtual.slice(secondPipe) : " | ";
        const novaLinha = `${speaker} | ${suggestion.value}${suffix}`;

        textarea.value = `${before}${novaLinha}${afterLine}`;
        const nextCursor = before.length + (secondPipe >= 0 ? `${speaker} | ${suggestion.value}`.length : novaLinha.length);
        textarea.setSelectionRange(nextCursor, nextCursor);
        return true;
    }

    const suffix = pipeIndex >= 0 ? linhaAtual.slice(pipeIndex) : " | ";
    const novaLinha = `${suggestion.value}${suffix}`;
    textarea.value = `${before}${novaLinha}${afterLine}`;
    const nextCursor = before.length + (pipeIndex >= 0 ? suggestion.value.length : novaLinha.length);
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
            renderSpeechThemeOptions();
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
    renderSpeechThemeOptions();
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

function parseStructuredTelegraphicLine(linha) {
    const parts = String(linha ?? "").split("|").map((part) => esc(part));
    if (parts.length < 2) return null;

    const [first, second, ...rest] = parts;
    if (!first) return null;

    const normalizedLabel = normalizeTelegraphicLabel(first);
    if (TELEGRAPHIC_SPECIAL_LINE_LABELS.has(normalizedLabel)) {
        return {
            kind: "special",
            key: normalizedLabel,
            content: [second, ...rest].filter(Boolean).join(" | "),
        };
    }

    return {
        kind: "speaker",
        reference: first,
        action: second,
        content: rest.filter(Boolean).join(" | "),
    };
}

function formatLegacyTelegraphicLine(codigo, conteudo, tipo) {
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

    return conteudo;
}

function formatStructuredTelegraphicLine(parsedLine) {
    if (!parsedLine) return "";

    if (parsedLine.kind === "special") {
        const content = esc(parsedLine.content);
        if (!content) return "";
        if (parsedLine.key === "encaminhamento") return `encaminhamento: ${content}`;
        if (parsedLine.key === "responsavel") return `responsável: ${content}`;
        if (parsedLine.key === "prazo") return `prazo: ${content}`;
        if (parsedLine.key === "votacao") return `votação: ${content}`;
        if (parsedLine.key === "resultado") return `resultado: ${content}`;
        return `deliberação: ${content}`;
    }

    const speakerName = resolverNomeCompletoPorReferencia(parsedLine.reference);
    const action = esc(parsedLine.action);
    const content = esc(parsedLine.content);

    if (action && content) return `${speakerName} ${action} ${content}`;
    if (action) return `registrou-se manifestação de ${speakerName}: ${action}`;
    if (content) return `registrou-se manifestação de ${speakerName}: ${content}`;
    return speakerName;
}

function parseTelegraphicLineForAta(linha) {
    const match = String(linha ?? "").match(/^([A-Za-z]{1,3})\s*:\s*(.+)$/);
    if (match) {
        return {
            mode: "legacy",
            code: match[1].toUpperCase(),
            content: esc(match[2]),
        };
    }

    const parsedLine = parseStructuredTelegraphicLine(linha);
    if (parsedLine) {
        return {
            mode: "structured",
            parsedLine,
        };
    }

    return {
        mode: "plain",
        content: esc(linha),
    };
}

function normalizeKeywordSearchText(text) {
    return normalizeTelegraphicLabel(text)
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function detectInformeFollowUpSignals(text) {
    const normalized = normalizeKeywordSearchText(text);
    return {
        hasAgenda: INFORME_AGENDA_KEYWORDS.some((keyword) => normalized.includes(keyword)),
        hasAction: INFORME_ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword)),
    };
}

function buildInformeAgendaPhrase(text) {
    const normalized = normalizeKeywordSearchText(text);
    if (normalized.includes("ordem do dia") || normalized.includes("proxima sessao")) {
        return "encaminhado para a ordem do dia da próxima sessão";
    }
    if (normalized.includes("proximo mes") || normalized.includes("mes que vem")) {
        return "gerando o encaminhamento de inclusão do tema na pauta do próximo mês";
    }
    return "gerando o encaminhamento de inclusão em pauta futura";
}

function buildInformeActionPhrase(text) {
    const normalized = normalizeKeywordSearchText(text);
    const hasLevantamento = normalized.includes("levantamento") || normalized.includes("levantar");
    const hasTecnico = normalized.includes("tecnico");
    const hasOrcamentario = normalized.includes("orcament");
    const hasDados = normalized.includes("dados");

    if (hasLevantamento && hasTecnico && hasOrcamentario) {
        return "gerando a ação prevista de realizar levantamento técnico/orçamentário";
    }
    if (hasLevantamento && hasTecnico) {
        return "gerando a ação prevista de realizar levantamento técnico";
    }
    if (hasLevantamento && hasOrcamentario) {
        return "gerando a ação prevista de realizar levantamento orçamentário";
    }
    if (hasLevantamento && hasDados) {
        return "gerando a ação prevista de realizar levantamento de dados";
    }
    if (hasLevantamento) {
        return "gerando a ação prevista de realizar levantamento";
    }
    if (normalized.includes("providenciar")) {
        return "gerando a ação prevista de providenciar as medidas necessárias";
    }
    if (normalized.includes("mapear")) {
        return "gerando a ação prevista de mapear a situação relatada";
    }
    if (normalized.includes("agendar")) {
        return "gerando a ação prevista de agendar a providência necessária";
    }
    return "gerando a ação prevista de adotar as providências cabíveis";
}

function buildInformeFollowUpSuffix(text) {
    const signals = detectInformeFollowUpSignals(text);
    const parts = [];
    if (signals.hasAgenda) parts.push(buildInformeAgendaPhrase(text));
    if (signals.hasAction) parts.push(buildInformeActionPhrase(text));
    return parts.length ? `, ${parts.join(" e ")}` : "";
}

function formatInformeSpecialLine(key, content) {
    const text = esc(content);
    if (!text) return "";

    if (key === "encaminhamento") {
        const signals = detectInformeFollowUpSignals(text);
        if (signals.hasAgenda) return buildInformeAgendaPhrase(text);
        if (signals.hasAction) return buildInformeActionPhrase(text);
        return `ficou registrado o encaminhamento para ${text}`;
    }
    if (key === "responsavel") return `ficando indicado ${text} como responsável pelo acompanhamento`;
    if (key === "prazo") return `com retorno previsto ${text}`;
    if (key === "resultado") return `registrou-se como resultado do informe: ${text}`;
    if (key === "votacao") return `sem caráter de votação, registrou-se apenas ${text}`;
    return `ficou registrado, sem caráter deliberativo, ${text}`;
}

function analisarTextoInformeParaAta(texto) {
    const linhas = splitTelegraphicLines(texto);
    if (!linhas.length) return { text: "", hasFollowUp: false };

    const parsedLines = linhas.map((linha) => ({ raw: linha, parsed: parseTelegraphicLineForAta(linha) }));
    const hasExplicitFollowUp = parsedLines.some(({ parsed }) => {
        if (parsed.mode === "legacy") return ["E", "R", "P"].includes(parsed.code);
        return parsed.mode === "structured"
            && parsed.parsedLine.kind === "special"
            && ["encaminhamento", "responsavel", "prazo"].includes(parsed.parsedLine.key);
    });

    let hasFollowUp = false;

    const parts = parsedLines.map(({ raw, parsed }) => {
        if (parsed.mode === "legacy") {
            if (["E", "R", "P"].includes(parsed.code)) {
                hasFollowUp = true;
                const specialKey = parsed.code === "E" ? "encaminhamento" : parsed.code === "R" ? "responsavel" : "prazo";
                return formatInformeSpecialLine(specialKey, parsed.content);
            }

            const base = formatLegacyTelegraphicLine(parsed.code, parsed.content, "informe");
            if (hasExplicitFollowUp) return base;

            const suffix = buildInformeFollowUpSuffix(`${raw} ${parsed.content}`);
            if (suffix) hasFollowUp = true;
            return `${base}${suffix}`;
        }

        if (parsed.mode === "structured") {
            if (parsed.parsedLine.kind === "special") {
                const text = formatInformeSpecialLine(parsed.parsedLine.key, parsed.parsedLine.content);
                if (["encaminhamento", "responsavel", "prazo"].includes(parsed.parsedLine.key)) hasFollowUp = true;
                return text;
            }

            const base = formatStructuredTelegraphicLine(parsed.parsedLine);
            if (hasExplicitFollowUp) return base;

            const sourceText = `${parsed.parsedLine.action} ${parsed.parsedLine.content}`;
            const suffix = buildInformeFollowUpSuffix(sourceText || raw);
            if (suffix) hasFollowUp = true;
            return `${base}${suffix}`;
        }

        const suffix = hasExplicitFollowUp ? "" : buildInformeFollowUpSuffix(raw);
        if (suffix) hasFollowUp = true;
        return `${parsed.content}${suffix}`;
    }).filter(Boolean);

    return {
        text: parts.join("; "),
        hasFollowUp,
    };
}

function formatarLinhaTelegráficaParaAta(linha, tipo) {
    const parsed = parseTelegraphicLineForAta(linha);
    if (parsed.mode === "legacy") {
        return formatLegacyTelegraphicLine(parsed.code, parsed.content, tipo);
    }
    if (parsed.mode === "structured") return formatStructuredTelegraphicLine(parsed.parsedLine);
    return parsed.content;
}

function formatarTextoTelegraficoParaAta(texto, tipo) {
    if (tipo === "informe") return analisarTextoInformeParaAta(texto).text;
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

function buildPromptTranscricaoIA() {
    const texto = String(byId("transcricaoAudio")?.value ?? "").trim();
    if (!texto) return "Transcrição / texto-resumo do áudio:\n- Nenhum texto informado na aba Transcrição.";
    return `Transcrição / texto-resumo do áudio (apoio factual complementar):\n${texto}`;
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
        "- transformar os registros telegráficos abaixo em texto institucional claro, coeso e conciso;",
        "- preservar fielmente o conteúdo factual da reunião;",
        "- aproveitar os nomes completos e o contexto institucional que já constam no DOCX.",
        "",
        "Regras obrigatórias:",
        "- Não invente fatos, falas, deliberações, votações, responsáveis ou prazos.",
        "- Leia cada linha, em regra, como Nome | tipo de fala | conteúdo essencial. Linhas iniciadas por Decisão, Votação, Encaminhamento, Responsável, Prazo ou Resultado representam o fechamento do tema.",
        "- Se houver texto na aba Transcrição, trate-o como apoio factual complementar. Esse conteúdo pode ser a transcrição bruta ou um texto-resumo produzido a partir da transcrição das pessoas participantes da reunião.",
        "- Quando houver texto-resumo derivado da transcrição, considere que ele já passou por arrumação prévia, com retirada de pausas, palavras grosseiras ou sem sentido e vícios de fala, preservando apenas o conteúdo útil da reunião.",
        "- Considere que os identificadores ou nomes abreviados dos participantes correspondem aos nomes completos presentes no DOCX e na lista de presença.",
        "- Na primeira menção de cada docente, use o nome completo.",
        "- Nas menções seguintes, use Prof. ou Profa. + primeiro nome + sobrenome.",
        "- Preserve a ordem das falas quando isso ajudar a manter o sentido da discussão.",
        "- Se não houver votação, não invente votação.",
        "- Se não houver responsável ou prazo, não acrescente.",
        "- Nos informes, quando houver desdobramento futuro, registre-o como encaminhamento ou ação prevista, sem atribuir caráter deliberativo ou de votação.",
        "- Nos informes, sinais como encaminhamento, ação prevista, levantamento, providenciar, mapear, agendar e incluir em pauta futura indicam providências a serem registradas.",
        "- Para informes com tema a retornar em sessão futura, use formulações como encaminhado para a ordem do dia da próxima sessão ou gerando o encaminhamento de inclusão na pauta do próximo mês.",
        "- Para informes com providência prática, use formulações como gerando a ação prevista de, com o compromisso de realizar levantamento técnico/orçamentário, ou registrando a necessidade de providências subsequentes.",
        "- Em caso de divergência, preserve o que estiver mais consistente com o DOCX e com as deliberações e encaminhamentos explícitos das pautas e informes.",
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
        "",
        buildPromptTranscricaoIA(),
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
            ? `${membro.funcao} ${membro.nome}` // MODIFIED: titulo before name
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
        if (!normalizado.nome || isRemovedMemberName(normalizado.nome)) return;
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
        const analisesInformes = informes.map((item) => ({
            title: item.title,
            analysis: analisarTextoInformeParaAta(item.text),
        }));
        const corpoInformes = analisesInformes.map((item) => {
            const textoInforme = item.analysis.text;
            if (isResumida) {
                if (item.analysis.hasFollowUp) {
                    return finalizarFrase(`${item.title}, com registro de encaminhamentos e ações previstas decorrentes do informe`);
                }
                return finalizarFrase(item.title);
            }
            if (!textoInforme) return finalizarFrase(item.title);
            return finalizarFrase(`${item.title}: ${textoInforme}`);
        }).join(" ");
        paragraphs.push(`Nos informes, registrou-se o seguinte: ${corpoInformes}`);
        if (analisesInformes.some((item) => item.analysis.hasFollowUp)) {
            paragraphs.push("Os desdobramentos consignados nos informes foram registrados como encaminhamentos e ações previstas para acompanhamento, sem caráter deliberativo ou de votação.");
        }
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

function getPptxGenConstructor() {
    const scope = typeof globalThis !== "undefined" ? globalThis : window;
    if (typeof scope.PptxGenJS === "function") return scope.PptxGenJS;
    if (typeof scope.pptxgen === "function") return scope.pptxgen;
    return null;
}

async function normalizarImagemParaDataUrl(src) {
    const source = esc(src);
    if (!source) return "";
    if (source.startsWith("data:")) return source;

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            if (!context || !width || !height) {
                reject(new Error("Não foi possível preparar a imagem para a apresentação."));
                return;
            }

            canvas.width = width;
            canvas.height = height;
            context.drawImage(image, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = () => reject(new Error(`Não foi possível carregar a imagem ${source}.`));
        image.src = source;
    });
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
    const PptxGenCtor = getPptxGenConstructor();
    if (!PptxGenCtor) {
        throw new Error("PptxGenJS não disponível");
    }

    const pres = new PptxGenCtor();
    pres.layout = "LAYOUT_16x9";

    const tipo = esc(byId("tipoReuniao")?.value) || "Reunião Ordinária";
    const data = formatDateBR(byId("dataReuniao")?.value);
    const logoFepesca = await normalizarImagemParaDataUrl(logos.fepesca).catch((error) => {
        console.warn(error);
        return "";
    });

    const slideCapa = pres.addSlide();
    slideCapa.background = { color: "0F172A" };
    if (logoFepesca) {
        slideCapa.addImage({ data: logoFepesca, x: 3.75, y: 0.45, w: 2.5, h: 2.5 });
    }
    slideCapa.addText(tipo.toUpperCase(), { x: 1, y: 3.05, w: 8, h: 1, fontSize: 32, bold: true, color: "FFFFFF", align: "center", fontFace: "Segoe UI" });
    slideCapa.addText(`DATA: ${data}`, { x: 1, y: 3.95, w: 8, h: 1, fontSize: 18, color: "94A3B8", align: "center", fontFace: "Segoe UI" });

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
    const logoFepesca = esc(logos.fepesca);

    browserSlides.push(`
        ${logoFepesca ? `<img src="${escapeHtml(logoFepesca)}" alt="Logo da FEPESCA" style="width: 220px; height: 220px; object-fit: contain; margin-bottom: 24px; filter: drop-shadow(0 18px 36px rgba(15, 23, 42, 0.45));">` : ""}
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
            transcricaoFalante: selectedSpeechParticipant || byId("transcricaoFalanteAtual")?.value || "",
            transcricaoTema: selectedSpeechTheme || "",
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
        const now = new Date();
        byId("numeroAta").value = `__/${now.getFullYear()}`;
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
            byId("numeroAta").value = state.meta.numero || `__/${new Date().getFullYear()}`;
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
            selectedSpeechParticipant = state.meta.transcricaoFalante || "";
            selectedSpeechTheme = state.meta.transcricaoTema || "";

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
        membrosExtras = normalizarMembrosBase(Array.isArray(state.membrosExtras) ? state.membrosExtras : [])
            .filter((membroExtra) => !membrosOriginais.some((membroBase) => safeLower(membroBase.nome) === safeLower(membroExtra.nome)));
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
