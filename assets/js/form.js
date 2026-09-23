(function () {
  "use strict";

  var FORM_SLUG = "autoavaliacao-maturidade-ia";
  var DRAFT_KEY = "srjorge-maturidade-draft";
  var RESPONSE_ID_KEY = "srjorge-maturidade-response-id";
  var ROW_CREATED_KEY = "srjorge-maturidade-row-created";
  var LAST_STEP = 6;
  var ADVANCED_STEP = 4;

  var FERRAMENTAS = [
    "ChatGPT (chat)", "ChatGPT Work (modo agente)", "Codex", "Claude (chat)", "Claude Cowork",
    "Claude Code", "Gemini", "NotebookLM", "ClickUp Brain", "Gamma", "n8n / Make", "Nenhuma"
  ];

  var DIMENSOES = [
    {
      id: "talentos", titulo: "2.1 Talentos e habilidades com IA",
      niveis: [
        "Nunca usei IA no trabalho.",
        "Uso ferramentas de IA prontas (ex.: ChatGPT, Gemini) de forma exploratória, sem rotina fixa.",
        "Tenho um jeito próprio de usar IA em pelo menos uma tarefa recorrente, mas não documentei nem ensinei a mais ninguém.",
        "Tenho um método replicável (prompt, fluxo ou rotina) que já usei mais de uma vez com resultado consistente.",
        "Já ajudei outra pessoa a aprender a usar IA numa tarefa real."
      ],
      aberta: { path: "falta_subir_nivel", label: "O que te falta para subir um nível?", required: true }
    },
    {
      id: "julgamento", titulo: "2.2 Julgamento sobre quando usar (e quando não usar) IA",
      niveis: [
        "Não sei dizer em que situações a IA erra ou atrapalha no meu trabalho.",
        "Já percebi pelo menos um caso em que a IA errou ou não ajudou.",
        "Tenho um critério pessoal (mesmo que não escrito) de quando não vale a pena usar IA numa tarefa.",
        "Já recusei ou reverti o uso de IA numa tarefa específica por esse critério.",
        "Meu critério já foi útil para outra pessoa da equipa decidir quando não usar IA."
      ],
      aberta: { path: "exemplo", label: "Dê um exemplo concreto, se tiver. (opcional)", required: false }
    },
    {
      id: "experimentacao", titulo: "2.3 Capacidade de experimentação",
      niveis: [
        "Nunca testei uma ferramenta de IA nova por conta própria.",
        "Já testei, mas não documentei o resultado nem decidi se adotar.",
        "Já testei e decidi conscientemente adotar ou descartar, mesmo sem registar formalmente.",
        "Já registei um teste (mesmo informalmente) de forma que outra pessoa poderia repetir.",
        "Já apresentei um teste/resultado para a equipa ou liderança."
      ]
    }
  ];

  var ESCALA = [
    { v: "0", curto: "Não conheço" },
    { v: "1", curto: "Sei o que é" },
    { v: "2", curto: "Já experimentei" },
    { v: "3", curto: "Uso com frequência" },
    { v: "4", curto: "Domino / ensino" }
  ];

  var BLOCOS = [
    { id: "A", titulo: "A. Conversar bem com a IA", avancado: false, itens: [
      ["engenharia_prompt", "Engenharia de prompt", "Escrever pedidos com papel, tarefa, formato e exemplos para a IA acertar de primeira"],
      ["engenharia_contexto", "Engenharia de contexto", "Dar à IA os materiais certos (briefing, histórico, referências) antes de pedir"],
      ["instrucoes_globais", "Instruções globais/personalizadas", "Configurar como a IA deve responder sempre, sem repetir a cada conversa"],
      ["memoria", "Memória", "A IA lembrar de você e do seu trabalho entre conversas (e saber revisar ou apagar o que guardou)"]
    ]},
    { id: "B", titulo: "B. Pensar e pesquisar", avancado: false, itens: [
      ["reasoning", "Modelos de raciocínio (reasoning)", "Escolher o modo \"pensar mais\" para problemas complexos"],
      ["deep_research", "Deep research", "Pedir uma pesquisa longa, com várias fontes, e receber um relatório citado"],
      ["rotacao_modelos", "Alternar modelos para economizar", "Usar modelos leves em tarefas simples e potentes só onde precisa, gastando menos tokens e limite"]
    ]},
    { id: "C", titulo: "C. Criar imagem e vídeo", avancado: false, itens: [
      ["prompt_imagem", "Prompt para imagem", "Descrever estilo, composição, luz e referências para gerar imagens"],
      ["imagem_video", "Imagem para vídeo", "Animar uma imagem gerada ou existente num vídeo curto"]
    ]},
    { id: "D", titulo: "D. Projetos e agentes", avancado: true, itens: [
      ["projetos_assistentes", "Projetos/assistentes personalizados", "Projects do ChatGPT ou do Claude, GPTs, Gems, NotebookLM, com arquivos e instruções fixas"],
      ["skills", "Skills", "Pacotes de instruções reutilizáveis que a IA carrega para uma tarefa específica"],
      ["rag", "RAG (base de conhecimento)", "A IA buscar respostas numa base própria de documentos (manuais, cases, histórico de clientes)"]
    ]},
    { id: "E", titulo: "E. Conectar e agir", avancado: true, itens: [
      ["conectores_mcp", "Conectores/MCPs", "Ligar a IA a Drive, Gmail, ClickUp, Notion etc. para ler e agir nessas ferramentas"],
      ["cli_api", "CLIs/APIs", "Usar a IA pelo terminal ou por API, fora da interface de chat"],
      ["modos_agenticos", "Modos agênticos", "Saber quando usar chat, agente ou agente de código (ChatGPT × Work × Codex; Claude × Cowork × Code)"],
      ["agentes_autonomos", "Agentes autónomos", "Agentes que rodam sozinhos, 24/7, com ferramentas e canais (ex.: Hermes, OpenClaw, Grokbot)"]
    ]},
    { id: "F", titulo: "F. Construir e automatizar", avancado: true, itens: [
      ["vibe_coding", "Vibe coding", "Criar páginas, ferramentas, apps ou sistemas descrevendo o que quer para a IA"],
      ["rotinas", "Rotinas e tarefas recorrentes", "Agendar a IA para rodar sozinha (ex.: resumo diário, relatório semanal)"],
      ["automacoes_nocode", "Automações no/low-code", "Montar fluxos em n8n, Make ou similares, com ou sem IA no meio"]
    ]}
  ];

  var form = document.getElementById("maturidade-form");
  var submitErrorEl = document.getElementById("submit-error");
  var syncStatusEl = document.getElementById("sync-status");
  var backBtn = document.getElementById("btn-back");
  var nextBtn = document.getElementById("btn-next");
  var progressFillEl = document.getElementById("progress-fill");
  var progressBarEl = document.getElementById("progress-bar");
  var respondentSelect = document.getElementById("respondente-select");

  var currentStep = 0;
  var responseId = null;
  var rowCreated = false;
  var visitedSteps = { 0: true };
  var saveTimer = null;

  // ── Helpers ──────────────────────────────────────────────────
  function setPath(obj, path, value) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function newUuid() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // ── Renderização ─────────────────────────────────────────────
  function renderFerramentas() {
    var box = document.getElementById("ferramentas");
    FERRAMENTAS.forEach(function (nome) {
      var label = el("label", { "class": "radio-option" });
      var input = el("input", { type: "checkbox", value: nome, "data-check": "uso.ferramentas" });
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + nome));
      box.appendChild(label);
    });
  }

  function renderDimensoes() {
    var box = document.getElementById("dimensoes");
    DIMENSOES.forEach(function (d) {
      var field = el("div", { "class": "field" });
      field.appendChild(el("p", { "class": "question-label" }, d.titulo));
      var group = el("div", { "class": "radio-group scale-list", "data-required": "" });
      d.niveis.forEach(function (txt, i) {
        var label = el("label", { "class": "radio-option" });
        label.appendChild(el("input", { type: "radio", name: "dim_" + d.id, value: String(i + 1), "data-path": "dimensoes." + d.id + ".nivel" }));
        label.appendChild(el("span", {}, "<strong>" + (i + 1) + ".</strong> " + txt));
        group.appendChild(label);
      });
      field.appendChild(group);
      if (d.aberta) {
        field.appendChild(el("label", { "class": "field-hint", "for": "dim-" + d.id + "-txt" }, d.aberta.label));
        var ta = el("textarea", { id: "dim-" + d.id + "-txt", "class": "field-control", "data-path": "dimensoes." + d.id + "." + d.aberta.path });
        if (d.aberta.required) ta.setAttribute("data-required", "");
        field.appendChild(ta);
      }
      box.appendChild(field);
    });
  }

  function renderLegend(id) {
    var box = document.getElementById(id);
    box.innerHTML = ESCALA.map(function (s) {
      return "<span><strong>" + s.v + "</strong> " + s.curto + "</span>";
    }).join("");
  }

  function renderGrids() {
    BLOCOS.forEach(function (b) {
      var target = document.getElementById(b.avancado ? "grids-avancados" : "grids-basicos");
      var wrap = el("div", { "class": "field capability-block" });
      wrap.appendChild(el("h3", { "class": "capability-title" }, b.titulo));
      var scroll = el("div", { "class": "table-scroll" });
      var table = el("table", { "class": "data-table capability-grid" });
      var head = "<thead><tr><th>Capacidade</th>" + ESCALA.map(function (s) {
        return "<th title=\"" + s.curto + "\">" + s.v + "<small>" + s.curto + "</small></th>";
      }).join("") + "</tr></thead>";
      table.innerHTML = head;
      var tbody = el("tbody");
      b.itens.forEach(function (item) {
        var path = "capacidades." + b.id + "." + item[0];
        var tr = el("tr", { "class": "grid-row", "data-required": "" });
        tr.appendChild(el("td", { "class": "row-label" }, "<strong>" + item[1] + "</strong><span class=\"field-hint\">" + item[2] + "</span>"));
        ESCALA.forEach(function (s) {
          var td = el("td", { "class": "grid-cell" });
          var label = el("label", { "class": "grid-hit", "aria-label": item[1] + ": " + s.curto });
          label.appendChild(el("input", { type: "radio", name: "cap_" + b.id + "_" + item[0], value: s.v, "data-path": path }));
          label.appendChild(el("span", { "class": "grid-num" }, s.v));
          td.appendChild(label);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scroll.appendChild(table);
      wrap.appendChild(scroll);
      target.appendChild(wrap);
    });
  }

  // ── Serialização ─────────────────────────────────────────────
  function serialize() {
    var state = {};
    form.querySelectorAll("[data-path]").forEach(function (node) {
      if (node.type === "radio") {
        if (node.checked) setPath(state, node.dataset.path, node.value);
      } else {
        setPath(state, node.dataset.path, node.value);
      }
    });
    var checks = {};
    form.querySelectorAll("[data-check]").forEach(function (node) {
      checks[node.dataset.check] = checks[node.dataset.check] || [];
      if (node.checked) checks[node.dataset.check].push(node.value);
    });
    Object.keys(checks).forEach(function (p) { setPath(state, p, checks[p]); });
    return state;
  }

  function hydrate(state) {
    if (!state) return;
    form.querySelectorAll("[data-path]").forEach(function (node) {
      var value = getPath(state, node.dataset.path);
      if (value === undefined) return;
      if (node.type === "radio") node.checked = node.value === value;
      else node.value = value;
    });
    form.querySelectorAll("[data-check]").forEach(function (node) {
      var arr = getPath(state, node.dataset.check);
      node.checked = Array.isArray(arr) && arr.indexOf(node.value) !== -1;
    });
  }

  // ── Regras condicionais ──────────────────────────────────────
  function advancedEnabled() {
    var checked = form.querySelector('input[name="filtro"]:checked');
    return !!checked && checked.value === "Sim";
  }

  function hasAnyFour() {
    return !!form.querySelector('.capability-grid input[value="4"]:checked:not(:disabled)');
  }

  function applyConditionals() {
    document.getElementById("respondente-outro-fields").hidden = respondentSelect.value !== "outro";

    var adv = advancedEnabled();
    var advPanel = form.querySelector('.step-panel[data-step="' + ADVANCED_STEP + '"]');
    advPanel.querySelectorAll("input").forEach(function (i) {
      i.disabled = !adv;
      if (!adv) i.checked = false;
    });

    var ev = document.getElementById("evidencia");
    var hint = document.getElementById("evidencia-hint");
    if (hasAnyFour()) {
      ev.setAttribute("data-required", "");
      hint.textContent = "Obrigatória, porque você marcou pelo menos um nível 4. Serve para calibrar a autoavaliação, não para corrigir a resposta.";
    } else {
      ev.removeAttribute("data-required");
      hint.textContent = "Opcional. Serve para calibrar a autoavaliação, não para corrigir a resposta.";
    }
  }

  function isStepActive(n) {
    return n !== ADVANCED_STEP || advancedEnabled();
  }

  // ── Validação / completude ───────────────────────────────────
  function panelOf(n) {
    return form.querySelector('.step-panel[data-step="' + n + '"]');
  }

  function requiredItems(n) {
    var panel = panelOf(n);
    if (!panel || !isStepActive(n)) return [];
    var items = Array.prototype.slice.call(panel.querySelectorAll("[data-required]"));
    if (n === 0) {
      items.push(respondentSelect, document.getElementById("area"));
      if (respondentSelect.value === "outro") items.push(document.getElementById("respondente-nome"));
    }
    return items.filter(function (node) { return !node.closest("[hidden]:not(.step-panel)"); });
  }

  function isFilled(node) {
    if (node.matches("select, textarea, input[type=text]")) return !!node.value.trim();
    return !!node.querySelector("input:checked");
  }

  function missingIn(n) {
    return requiredItems(n).filter(function (node) { return !isFilled(node); });
  }

  function clearErrors() {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (n) { n.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".invalid").forEach(function (n) { n.classList.remove("invalid"); });
    submitErrorEl.hidden = true;
  }

  function validateStep(n) {
    clearErrors();
    var missing = missingIn(n);
    missing.forEach(function (node) {
      if (node.matches("select, textarea, input")) node.setAttribute("aria-invalid", "true");
      else node.classList.add("invalid");
    });
    return missing;
  }

  function updateProgressBar() {
    var total = 0, done = 0;
    for (var s = 0; s <= LAST_STEP; s++) {
      requiredItems(s).forEach(function (node) {
        total++;
        if (isFilled(node)) done++;
      });
    }
    var pct = total ? Math.round((done / total) * 100) : 0;
    progressFillEl.style.width = pct + "%";
    progressFillEl.setAttribute("data-revealed", pct > 0 ? "true" : "false");
    progressBarEl.setAttribute("aria-valuenow", String(pct));
  }

  // ── Navegação ────────────────────────────────────────────────
  function updateStepNav() {
    document.querySelectorAll(".block-nav button").forEach(function (btn) {
      var s = parseInt(btn.dataset.step, 10);
      var active = isStepActive(s);
      btn.disabled = !active;
      btn.classList.toggle("current", s === currentStep);
      if (btn.dataset.block) {
        var complete = active && requiredItems(s).length > 0 && missingIn(s).length === 0;
        btn.classList.toggle("filled", complete);
        btn.classList.toggle("attention", active && !!visitedSteps[s] && missingIn(s).length > 0);
      }
    });
  }

  function updateStepButtons() {
    backBtn.hidden = currentStep === 0;
    nextBtn.textContent = currentStep === LAST_STEP ? "Enviar respostas" : "Avançar →";
  }

  function showStep(n, direction) {
    visitedSteps[n] = true;
    form.querySelectorAll(".step-panel").forEach(function (panel) {
      var s = parseInt(panel.dataset.step, 10);
      if (s === n) {
        panel.hidden = false;
        panel.classList.remove("step-enter", "step-enter-back");
        void panel.offsetWidth;
        panel.classList.add(direction === "back" ? "step-enter-back" : "step-enter");
      } else {
        panel.hidden = true;
      }
    });
    currentStep = n;
    clearErrors();
    updateStepNav();
    updateStepButtons();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextActive(from, dir) {
    var n = from + dir;
    while (n > 0 && n < LAST_STEP && !isStepActive(n)) n += dir;
    return n;
  }

  // ── Payload / persistência ───────────────────────────────────
  function resolveRespondent() {
    var area = document.getElementById("area").value;
    if (respondentSelect.value === "outro") {
      return { name: document.getElementById("respondente-nome").value.trim(), role: area };
    }
    return { name: respondentSelect.value.split("|")[0] || "", role: area };
  }

  function buildPayload() {
    var state = serialize();
    var respondent = resolveRespondent();
    var answers = {};
    ["uso", "dimensoes", "capacidades", "percepcao", "aberto"].forEach(function (k) {
      if (state[k] !== undefined) answers[k] = state[k];
    });
    answers.respondente = { perfil: (respondentSelect.value.split("|")[1] || "outro"), area: respondent.role };
    return {
      form_slug: FORM_SLUG,
      respondent_name: respondent.name,
      respondent_role: respondent.role,
      answers: answers,
      source_url: window.location.href,
      user_agent: navigator.userAgent
    };
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize())); } catch (e) { /* sem autosave local */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearLocalState() {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(RESPONSE_ID_KEY);
      localStorage.removeItem(ROW_CREATED_KEY);
    } catch (e) { /* ignora */ }
  }

  function ensureResponseId() {
    if (!responseId) {
      responseId = newUuid();
      try { localStorage.setItem(RESPONSE_ID_KEY, responseId); } catch (e) { /* ignora */ }
    }
    return responseId;
  }

  function setSyncStatus(text, isError) {
    syncStatusEl.textContent = text;
    if (isError) syncStatusEl.setAttribute("data-state", "error");
    else syncStatusEl.removeAttribute("data-state");
  }

  function persist(payload) {
    ensureResponseId();
    return (rowCreated ? patchDraft(responseId, payload) : insertDraft(responseId, payload)).then(function () {
      if (!rowCreated) {
        rowCreated = true;
        try { localStorage.setItem(ROW_CREATED_KEY, "1"); } catch (e) { /* ignora */ }
      }
    });
  }

  function syncProgressive() {
    if (!resolveRespondent().name) return;
    var payload = buildPayload();
    payload.status = "draft";
    payload.updated_at = new Date().toISOString();
    setSyncStatus("Sincronizando…", false);
    persist(payload).then(function () {
      setSyncStatus("Sincronizado às " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }), false);
    }).catch(function (err) {
      setSyncStatus("Não sincronizado com o servidor — o seu progresso local está seguro.", true);
      console.error(err);
    });
  }

  function doFinalSubmit() {
    var payload = buildPayload();
    payload.status = "submitted";
    payload.submitted_at = new Date().toISOString();
    payload.updated_at = payload.submitted_at;
    nextBtn.disabled = true;
    nextBtn.textContent = "Enviando…";
    persist(payload).then(function () {
      clearLocalState();
      document.getElementById("main-form").style.display = "none";
      document.getElementById("block-nav").style.display = "none";
      document.getElementById("obrigado").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (err) {
      submitErrorEl.textContent = "Não foi possível enviar agora. O seu rascunho continua guardado neste navegador — tente novamente em instantes.";
      submitErrorEl.hidden = false;
      nextBtn.disabled = false;
      nextBtn.textContent = "Enviar respostas";
      console.error(err);
    });
  }

  function onChange() {
    applyConditionals();
    updateProgressBar();
    updateStepNav();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 600);
  }

  function wireNavigation() {
    nextBtn.addEventListener("click", function () {
      var missing = validateStep(currentStep);
      if (missing.length) {
        submitErrorEl.textContent = currentStep === 0
          ? "Indique quem está a responder e a sua área para continuar."
          : "Responda às perguntas obrigatórias desta etapa para continuar.";
        submitErrorEl.hidden = false;
        missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (currentStep === LAST_STEP) { doFinalSubmit(); return; }
      syncProgressive();
      showStep(nextActive(currentStep, 1), "forward");
    });

    backBtn.addEventListener("click", function () {
      if (currentStep > 0) showStep(nextActive(currentStep, -1), "back");
    });

    document.querySelectorAll(".block-nav button[data-step]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = parseInt(btn.dataset.step, 10);
        if (isStepActive(n)) showStep(n, n > currentStep ? "forward" : "back");
      });
    });
  }

  function syncHeaderHeight() {
    var header = document.querySelector(".site-header-fixed");
    if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderFerramentas();
    renderDimensoes();
    renderLegend("scale-legend-1");
    renderLegend("scale-legend-2");
    renderGrids();

    hydrate(loadDraft());
    try {
      responseId = localStorage.getItem(RESPONSE_ID_KEY) || null;
      rowCreated = localStorage.getItem(ROW_CREATED_KEY) === "1";
    } catch (e) { /* ignora */ }

    applyConditionals();
    wireNavigation();
    syncHeaderHeight();
    window.addEventListener("resize", syncHeaderHeight);

    updateProgressBar();
    updateStepNav();
    updateStepButtons();

    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
  });
})();
