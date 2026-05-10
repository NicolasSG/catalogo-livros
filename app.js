// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let livros = [];
let livroSelecionado = null;
let appsScriptUrl =
  "https://script.google.com/macros/s/AKfycbzDcI3EukA35GK2Aw6x8e-Y9TgSJBkqIABPXCVjdlLTTMFvM-EDqTIwm9Ok_X_47doUqg/exec";
let googleSheetsId = "1ZfLN5R_gwIeyVcpy6O5Fkg8vzrqryZjb2jiJxjd7AgM";
let modoEdicao = false;
let livroEditandoId = null;

const camposDisponiveis = [
  { id: "editora", label: "Editora", obrigatorio: false },
  { id: "resumo", label: "Resumo", obrigatorio: false },
  { id: "foto", label: "URL da capa", obrigatorio: false },
];

let camposAtivos = camposDisponiveis.map((c) => c.id);
let categoriasList = [];

// ============================================
// AUTENTICAÇÃO E CONTROLE DE ACESSO
// Para ativar o login com Google:
// 1. Acesse console.cloud.google.com
// 2. Crie um projeto e ative a Google Identity API
// 3. Em "Credentials", crie um OAuth 2.0 Client ID (Web application)
// 4. Em "Authorized JavaScript origins", adicione o domínio do seu app
// 5. Substitua o valor de GOOGLE_CLIENT_ID abaixo
// ============================================
const GOOGLE_CLIENT_ID =
  "621833041327-p3pb3i69nf72ugrio9khcpl6e8ak5kr5.apps.googleusercontent.com";

let usuarioLogado = null;
let roleUsuario = "Visualizador";

function inicializarAuth() {
  const sessao = sessionStorage.getItem("sessaoUsuario");
  if (sessao) {
    try {
      const dados = JSON.parse(sessao);
      usuarioLogado = dados.usuario;
      roleUsuario = dados.role;
      ocultarLoginOverlay();
      atualizarInfoUsuario();
      aplicarPermissoesUI();
      return;
    } catch (e) {
      sessionStorage.removeItem("sessaoUsuario");
    }
  }

  mostrarLoginOverlay();

  const clientIdValido =
    GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith("SEU_");
  if (!clientIdValido) {
    document.getElementById("loginSemAuth").style.display = "block";
    document.getElementById("loginStatus").textContent =
      "Login com Google não configurado. Configure o GOOGLE_CLIENT_ID em app.js para ativar.";
    return;
  }

  aguardarGIS();
}

function aguardarGIS() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    inicializarGIS();
  } else {
    setTimeout(aguardarGIS, 100);
  }
}

function inicializarGIS() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false,
  });

  google.accounts.id.renderButton(
    document.getElementById("googleSignInButton"),
    {
      theme: "outline",
      size: "large",
      text: "signin_with",
      locale: "pt-BR",
      width: 300,
    },
  );
}

async function handleCredentialResponse(response) {
  document.getElementById("loginStatus").textContent = "Verificando...";

  try {
    const payload = parseJwt(response.credential);
    usuarioLogado = {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || "",
    };

    roleUsuario = await buscarRoleUsuario(usuarioLogado.email);

    sessionStorage.setItem(
      "sessaoUsuario",
      JSON.stringify({ usuario: usuarioLogado, role: roleUsuario }),
    );

    ocultarLoginOverlay();
    atualizarInfoUsuario();
    aplicarPermissoesUI();
  } catch (e) {
    document.getElementById("loginStatus").textContent =
      "Erro ao autenticar. Tente novamente.";
    console.error("Erro no login:", e);
  }
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
  return JSON.parse(json);
}

async function buscarRoleUsuario(email) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${googleSheetsId}/gviz/tq?tqx=out:csv&sheet=Usuarios`;
    const response = await fetch(url);
    if (!response.ok) return "Visualizador";

    const csv = await response.text();
    const linhas = csv
      .split("\n")
      .slice(1)
      .filter((l) => l.trim());

    for (const linha of linhas) {
      const cols = linha.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      if (cols[0].toLowerCase() === email.toLowerCase()) {
        if (["Admin", "Editor", "Visualizador"].includes(cols[1]))
          return cols[1];
      }
    }

    return "Visualizador";
  } catch (e) {
    console.error("Erro ao buscar role:", e);
    return "Visualizador";
  }
}

function aplicarPermissoesUI() {
  const podeEditar = roleUsuario === "Admin" || roleUsuario === "Editor";
  const podeAdmin = roleUsuario === "Admin";

  document.getElementById("navAdicionar").style.display = podeEditar
    ? ""
    : "none";
  document.getElementById("navConfig").style.display = podeAdmin ? "" : "none";
}

function atualizarInfoUsuario() {
  if (!usuarioLogado) return;

  document.getElementById("userInfo").style.display = "flex";

  const avatar = document.getElementById("userAvatar");
  if (usuarioLogado.picture) {
    avatar.src = usuarioLogado.picture;
    avatar.style.display = "block";
  }

  document.getElementById("userName").textContent = usuarioLogado.name;

  const badge = document.getElementById("userRole");
  badge.textContent = roleUsuario;
  badge.className = "role-badge role-" + roleUsuario.toLowerCase();
}

function mostrarLoginOverlay() {
  document.getElementById("loginOverlay").style.display = "flex";
}

function ocultarLoginOverlay() {
  document.getElementById("loginOverlay").style.display = "none";
}

function continuarSemLogin() {
  usuarioLogado = { email: "visitante", name: "Visitante", picture: "" };
  roleUsuario = "Visualizador";
  ocultarLoginOverlay();
  atualizarInfoUsuario();
  aplicarPermissoesUI();
}

function logout() {
  sessionStorage.removeItem("sessaoUsuario");
  usuarioLogado = null;
  roleUsuario = "Visualizador";
  document.getElementById("userInfo").style.display = "none";
  document.getElementById("userAvatar").style.display = "none";

  if (window.google && window.google.accounts && window.google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }

  document.getElementById("loginStatus").textContent = "";
  mostrarLoginOverlay();
  aplicarPermissoesUI();
}

window.addEventListener("load", function () {
  inicializarAuth();
  setTimeout(async () => {
    carregarConfiguracao();
    await carregarDadosPlanilha();
    await carregarCategoriasDaPlanilha();
    carregarConfigCampos();
  }, 500);
});

function carregarConfiguracao() {
  console.log("Credenciais carregadas do código");
}

async function carregarCategoriasDaPlanilha() {
  try {
    // Carregar a aba Configuracao como CSV
    const url = `https://docs.google.com/spreadsheets/d/${googleSheetsId}/export?format=csv&gid=1301720323`;
    console.log("Carregando categorias da planilha:", url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Erro ao carregar categorias da planilha");
    }

    const csv = await response.text();
    const linhas = csv
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    // Pular a primeira linha (cabeçalho) e extrair categorias
    categoriasList = linhas
      .slice(1)
      .map((linha) => linha.replace(/"/g, ""))
      .filter((cat) => cat);

    console.log("Categorias da planilha:", categoriasList);
    renderizarConfigCampos();
  } catch (erro) {
    console.error("Erro ao carregar categorias da planilha:", erro);

    // Fallback: extrair categorias dos livros
    const categoriasDosLivros = [
      ...new Set(livros.flatMap((l) => l.categorias).filter((c) => c)),
    ];
    categoriasList = categoriasDosLivros.sort();
    console.log("Usando categorias dos livros como fallback:", categoriasList);
    renderizarConfigCampos();
  }
}

function atualizarSyncStatus(status, mensagem) {
  const syncStatus = document.getElementById("syncStatus");
  const syncIcon = document.getElementById("syncIcon");
  const syncText = document.getElementById("syncText");

  syncStatus.className = "sync-status " + status;
  syncText.textContent = mensagem;

  if (status === "sincronizado") {
    syncIcon.textContent = "✅";
  } else if (status === "sincronizando") {
    syncIcon.textContent = "⏳";
  } else if (status === "erro") {
    syncIcon.textContent = "❌";
  }
}

async function carregarDadosPlanilha() {
  if (!googleSheetsId) {
    atualizarSyncStatus("erro", "Não configurado");
    return;
  }

  atualizarSyncStatus("sincronizando", "Carregando...");

  try {
    const url = `https://docs.google.com/spreadsheets/d/${googleSheetsId}/export?format=csv`;
    console.log("Carregando planilha de:", url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Erro ao carregar: " + response.status);
    }

    const csv = await response.text();
    console.log("CSV recebido, linhas:", csv.split("\n").length);

    const parsed = Papa.parse(csv, { header: true });
    console.log("Linhas parseadas:", parsed.data.length);

    livros = parsed.data
      .filter((row) => row.id && row.titulo)
      .map((row) => ({
        id: parseInt(row.id) || Date.now(),
        titulo: row.titulo || "",
        autor: row.autor || "",
        editora: row.editora || "",
        categorias: row.categoria
          ? row.categoria.split(",").map((c) => c.trim())
          : [],
        exemplares: parseInt(row.exemplares) || 0,
        resumo: row.resumo || "",
        foto: row.foto || "",
      }));

    console.log("Livros carregados:", livros.length);

    document.getElementById("alertaGoogle").style.display = "flex";
    atualizarSyncStatus("sincronizado", "Sincronizado");
    renderizar();
    atualizarStats();
    atualizarFiltros();
  } catch (erro) {
    console.error("Erro ao carregar:", erro);
    atualizarSyncStatus("erro", "Erro ao carregar");
  }
}

async function sincronizar(showOverlay = true) {
  if (!googleSheetsId) {
    alert("Configure a planilha primeiro!");
    switchTab("config");
    return;
  }

  console.log("Sincronizando...");
  atualizarSyncStatus("sincronizando", "Sincronizando...");
  if (showOverlay)
    document.getElementById("loadingOverlay").style.display = "flex";
  await carregarDadosPlanilha();
  if (showOverlay)
    document.getElementById("loadingOverlay").style.display = "none";
  console.log("Sincronização concluída!");
}

async function salvarNoAppsScript(livro) {
  if (!appsScriptUrl) {
    alert("Configure o Apps Script primeiro!");
    return false;
  }

  try {
    await fetch(appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "addBook",
        userEmail: usuarioLogado ? usuarioLogado.email : "anonimo",
        id: livro.id,
        titulo: livro.titulo,
        autor: livro.autor,
        editora: livro.editora,
        categoria: livro.categorias.join(", "),
        exemplares: livro.exemplares,
        resumo: livro.resumo,
        foto: livro.foto,
      }),
    });
    return true;
  } catch (erro) {
    console.error("Erro:", erro);
    return false;
  }
}

async function deletarDoAppsScript(id) {
  if (!appsScriptUrl) return false;

  try {
    await fetch(appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "deleteBook",
        userEmail: usuarioLogado ? usuarioLogado.email : "anonimo",
        id: id,
      }),
    });
    return true;
  } catch (erro) {
    console.error("Erro:", erro);
    return false;
  }
}

async function adicionarLivro(e) {
  e.preventDefault();

  if (roleUsuario !== "Admin" && roleUsuario !== "Editor") {
    alert("Você não tem permissão para adicionar ou editar livros.");
    return;
  }

  if (!appsScriptUrl) {
    alert("Configure o Apps Script primeiro!");
    return;
  }

  const titulo = document.getElementById("formTitulo").value.trim();
  const autor = document.getElementById("formAutor").value.trim();
  const exemplares = document.getElementById("formExemplares").value;

  if (!titulo) {
    alert("Preencha o título!");
    return;
  }
  if (!autor) {
    alert("Preencha o autor!");
    return;
  }
  if (!exemplares || isNaN(exemplares) || parseInt(exemplares) < 0) {
    alert("Preencha os exemplares com um número válido!");
    return;
  }

  const categoriasSelecionadas = Array.from(
    document.querySelectorAll(".categoria-checkbox:checked"),
  ).map((cb) => cb.value);

  if (categoriasSelecionadas.length === 0) {
    alert("Selecione pelo menos uma categoria!");
    return;
  }

  const id = modoEdicao ? livroEditandoId : Date.now();

  const novoLivro = {
    id: id,
    titulo: titulo,
    autor: autor,
    editora: document.getElementById("formEditora").value.trim(),
    categorias: categoriasSelecionadas,
    exemplares: parseInt(exemplares),
    resumo: document.getElementById("formResumo").value.trim(),
    foto: document.getElementById("formFoto").value.trim(),
  };

  atualizarSyncStatus("sincronizando", "Salvando...");
  document.getElementById("loadingOverlay").style.display = "flex";
  document.getElementById("btnSalvar").disabled = true;
  const eraEdicao = modoEdicao;
  if (modoEdicao) {
    await deletarDoAppsScript(id);
  }
  await salvarNoAppsScript(novoLivro);
  // document.getElementById("loadingOverlay").style.display = "none"; // keep shown
  document.getElementById("btnSalvar").disabled = false;
  document.getElementById("formAdicionar").reset();
  document
    .querySelectorAll(".categoria-checkbox")
    .forEach((cb) => (cb.checked = false));
  modoEdicao = false;
  livroEditandoId = null;
  switchTab("consulta");
  atualizarSyncStatus("sincronizando", "Sincronizando...");
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await sincronizar(false);
  document.getElementById("loadingOverlay").style.display = "none";
}

async function deletarLivro() {
  if (!livroSelecionado) return;

  if (roleUsuario !== "Admin") {
    alert("Apenas administradores podem deletar livros.");
    return;
  }

  if (confirm(`Deletar "${livroSelecionado.titulo}"?`)) {
    atualizarSyncStatus("sincronizando", "Deletando...");
    document.getElementById("loadingOverlay").style.display = "flex";
    await deletarDoAppsScript(livroSelecionado.id);
    // document.getElementById("loadingOverlay").style.display = "none"; // keep shown
    fecharModal();
    atualizarSyncStatus("sincronizando", "Sincronizando...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await sincronizar(false);
    document.getElementById("loadingOverlay").style.display = "none";
    alert("✅ Livro deletado com sucesso!");
  }
}

function editarLivro() {
  if (!livroSelecionado) return;

  if (roleUsuario !== "Admin" && roleUsuario !== "Editor") {
    alert("Você não tem permissão para editar livros.");
    return;
  }

  modoEdicao = true;
  livroEditandoId = livroSelecionado.id;
  document.getElementById("formTitulo").value = livroSelecionado.titulo;
  document.getElementById("formAutor").value = livroSelecionado.autor;
  document.getElementById("formEditora").value = livroSelecionado.editora;
  document.querySelectorAll(".categoria-checkbox").forEach((cb) => {
    cb.checked = livroSelecionado.categorias.includes(cb.value);
  });
  document.getElementById("formExemplares").value = livroSelecionado.exemplares;
  document.getElementById("formResumo").value = livroSelecionado.resumo;
  document.getElementById("formFoto").value = livroSelecionado.foto;

  fecharModal();
  switchTab("adicionar", false);
}

function filtrarLivros() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const activeTags = Array.from(document.querySelectorAll(".tag.active")).map(
    (t) => t.textContent.trim(),
  );

  const filtrados = livros.filter((livro) => {
    const matchSearch =
      livro.titulo.toLowerCase().includes(search) ||
      livro.autor.toLowerCase().includes(search) ||
      livro.resumo.toLowerCase().includes(search);

    const matchTag =
      activeTags.length === 0 ||
      livro.categorias.some((cat) => activeTags.includes(cat));

    return matchSearch && matchTag;
  });

  renderizar(filtrados);
  document.getElementById("emptyState").style.display =
    filtrados.length === 0 ? "block" : "none";
}

function atualizarFiltros() {
  const categorias = [...new Set(livros.flatMap((l) => l.categorias))].sort();
  const container = document.getElementById("filterTags");

  container.innerHTML = categorias
    .map(
      (cat) =>
        `<div class="tag" onclick="this.classList.toggle('active'); filtrarLivros();">${cat}</div>`,
    )
    .join("");
}

function atualizarStats() {
  const totalLivros = livros.length;
  const totalExemplares = livros.reduce((sum, l) => sum + l.exemplares, 0);
  const totalCategorias = new Set(livros.flatMap((l) => l.categorias)).size;
  const indisponiveis = livros.filter((l) => l.exemplares === 0).length;

  document.getElementById("totalLivros").textContent = totalLivros;
  document.getElementById("totalExemplares").textContent = totalExemplares;
  document.getElementById("totalCategorias").textContent = totalCategorias;
  document.getElementById("livrosIndisponiveis").textContent = indisponiveis;

  gerarRelatorios();
}

function renderizar(livrosParaMostrar = livros) {
  const container = document.getElementById("booksContainer");

  if (livrosParaMostrar.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = livrosParaMostrar
    .map(
      (livro) => `
    <div class="book-card" onclick="abrirModal(${livro.id})">
      <div class="book-cover">
        ${livro.foto ? `<img src="${livro.foto}" alt="${livro.titulo}" onerror="this.style.display='none'">` : "📚"}
      </div>
      <div class="book-info">
        <div class="book-title">${livro.titulo}</div>
        <div class="book-author">${livro.autor}</div>
        <div class="book-meta">
          <div class="book-categories">
            ${livro.categorias.map((cat) => `<span class="category-tag">${cat}</span>`).join("")}
          </div>
        </div>
        <div class="book-exemplares">
          ${livro.exemplares} exemplar${livro.exemplares !== 1 ? "es" : ""}
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

function abrirModal(id) {
  livroSelecionado = livros.find((l) => l.id === id);
  if (!livroSelecionado) return;

  document.getElementById("modalTitulo").textContent = livroSelecionado.titulo;
  const capa = document.getElementById("modalCapa");
  capa.innerHTML = livroSelecionado.foto
    ? `<img src="${livroSelecionado.foto}" alt="${livroSelecionado.titulo}" onerror="this.style.display='none'">`
    : "📚";

  const info = document.getElementById("modalInfo");
  info.innerHTML = `
    <div class="modal-field">
      <span class="modal-label">Autor</span>
      <div class="modal-value">${livroSelecionado.autor}</div>
    </div>
    <div class="modal-field">
      <span class="modal-label">Editora</span>
      <div class="modal-value">${livroSelecionado.editora || "—"}</div>
    </div>
    <div class="modal-field">
      <span class="modal-label">Categoria</span>
      <div class="modal-value">${livroSelecionado.categorias.join(", ")}</div>
    </div>
    <div class="modal-field">
      <span class="modal-label">Exemplares</span>
      <div class="modal-value" style="font-weight: 600;">${livroSelecionado.exemplares}</div>
    </div>
    <div class="modal-field">
      <span class="modal-label">Resumo</span>
      <div class="modal-value">${livroSelecionado.resumo || "—"}</div>
    </div>
  `;

  const podeEditar = roleUsuario === "Admin" || roleUsuario === "Editor";
  document.getElementById("btnEditarModal").style.display = podeEditar
    ? ""
    : "none";
  document.getElementById("btnDeletarModal").style.display =
    roleUsuario === "Admin" ? "" : "none";

  document.getElementById("modal").classList.add("active");
}

function fecharModal(event) {
  if (event && event.target.id !== "modal") return;
  document.getElementById("modal").classList.remove("active");
  livroSelecionado = null;
}

function switchTab(tabName, limparFormulario = true) {
  if (
    tabName === "adicionar" &&
    roleUsuario !== "Admin" &&
    roleUsuario !== "Editor"
  )
    return;
  if (tabName === "config" && roleUsuario !== "Admin") return;

  document
    .querySelectorAll(".tab-content")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");

  const titles = {
    consulta: "Consultar Livros",
    adicionar: "Adicionar Livro",
    relatorios: "Relatórios",
    config: "Configuração",
  };
  document.getElementById("pageTitle").textContent = titles[tabName];

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (event && event.target) {
    event.target.classList.add("active");
  } else {
    const buttons = document.querySelectorAll(".nav-item");
    const nomeEsperado =
      tabName === "consulta"
        ? "🔍"
        : tabName === "adicionar"
          ? "➕"
          : tabName === "relatorios"
            ? "📊"
            : "⚙️";
    for (let btn of buttons) {
      if (btn.textContent.includes(nomeEsperado)) {
        btn.classList.add("active");
        break;
      }
    }
  }

  if (tabName === "config") {
    carregarConfiguracao();
    carregarConfigCampos();
  }

  if (tabName === "adicionar" && limparFormulario) {
    document.getElementById("formAdicionar").reset();
    document
      .querySelectorAll(".categoria-checkbox")
      .forEach((cb) => (cb.checked = false));
    modoEdicao = false;
    livroEditandoId = null;
    document.getElementById("btnSalvar").disabled = false;
  }
}

function gerarRelatorios() {
  const porCategoria = {};
  livros.forEach((l) => {
    l.categorias.forEach((cat) => {
      if (!porCategoria[cat]) porCategoria[cat] = 0;
      porCategoria[cat]++;
    });
  });

  let html = "";
  if (Object.keys(porCategoria).length === 0) {
    html = '<div class="no-data">Nenhum livro cadastrado ainda</div>';
  } else {
    Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        html += `<div class="report-row">
        <span>${cat}</span>
        <span style="font-weight: 500;">${count} livro${count !== 1 ? "s" : ""}</span>
      </div>`;
      });
  }
  document.getElementById("relatorioCategoria").innerHTML = html;

  const escassos = livros
    .filter((l) => l.exemplares < 3)
    .sort((a, b) => a.exemplares - b.exemplares);
  let htmlEscassos = "";
  if (escassos.length === 0) {
    htmlEscassos = '<div class="no-data">Nenhum livro com poucas cópias</div>';
  } else {
    escassos.forEach((l) => {
      htmlEscassos += `<div class="report-row">
        <span>${l.titulo}</span>
        <span style="color: var(--color-danger); font-weight: 500;">${l.exemplares}</span>
      </div>`;
    });
  }
  document.getElementById("relatorioEscassos").innerHTML = htmlEscassos;
}

function exportarDados() {
  const csv =
    "ID,Título,Autor,Editora,Categoria,Exemplares,Resumo,Foto\n" +
    livros
      .map(
        (l) =>
          `${l.id},"${l.titulo.replace(/"/g, '""')}","${l.autor.replace(/"/g, '""')}","${l.editora.replace(/"/g, '""')}","${l.categorias.join(", ")}",${l.exemplares},"${l.resumo.replace(/"/g, '""')}","${l.foto}"`,
      )
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo_livros.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function carregarConfigCampos() {
  renderizarConfigCampos();
  atualizarFormulario();
}

function renderizarConfigCampos() {
  const container = document.getElementById("camposConfig");
  const listaCategorias = document.getElementById("listaCategorias");

  if (!container || !listaCategorias) {
    console.log("Elementos não encontrados ainda");
    setTimeout(renderizarConfigCampos, 100);
    return;
  }

  container.innerHTML = camposDisponiveis
    .map(
      (campo) => `
    <div style="padding: 12px; background: var(--color-bg-light); border-radius: 6px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
      <input 
        type="checkbox" 
        id="checkbox-${campo.id}" 
        ${camposAtivos.includes(campo.id) ? "checked" : ""}
        onchange="atualizarCamposAtivos()"
      >
      <label for="checkbox-${campo.id}" style="flex: 1; font-size: 14px; color: var(--color-text-dark); cursor: pointer; margin: 0;">${campo.label}</label>
      ${campo.obrigatorio ? '<span style="font-size: 12px; color: var(--color-danger);">*Obrigatório</span>' : ""}
    </div>
  `,
    )
    .join("");

  listaCategorias.innerHTML = categoriasList
    .map(
      (cat, idx) => `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #dbeafe; color: var(--color-primary); border-radius: 6px; font-size: 13px; font-weight: 500;">
      ${cat}
      <button type="button" onclick="removerCategoria(${idx})" style="background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 16px; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
    </div>
  `,
    )
    .join("");
}

function atualizarCamposAtivos() {
  camposAtivos = camposDisponiveis
    .filter((c) => document.getElementById(`checkbox-${c.id}`).checked)
    .map((c) => c.id);
}

function salvarConfigCampos() {
  atualizarFormulario();
  alert("✅ Configuração salva!");
}

function restaurarConfigPadrao() {
  if (confirm("Tem certeza? Isso vai restaurar os campos para o padrão.")) {
    camposAtivos = camposDisponiveis.map((c) => c.id);
    salvarConfigCampos();
    renderizarConfigCampos();
  }
}

function atualizarFormulario() {
  const container = document.getElementById("categoriasContainer");
  container.innerHTML = categoriasList
    .map(
      (cat) => `
      <label style="display: flex; align-items: center; gap: 6px; padding: 8px; background: var(--color-bg-light); border-radius: 6px; cursor: pointer;">
        <input type="checkbox" value="${cat}" class="categoria-checkbox">
        <span style="font-size: 14px; color: var(--color-text-dark);">${cat}</span>
      </label>
    `,
    )
    .join("");

  const mapeoPorId = {
    editora: "formEditora",
    resumo: "formResumo",
    foto: "formFoto",
  };

  Object.entries(mapeoPorId).forEach(([campoId, elementId]) => {
    const elemento = document.getElementById(elementId);
    if (elemento) {
      const pai = elemento.parentElement;
      pai.style.display = camposAtivos.includes(campoId) ? "block" : "none";
    }
  });
}

async function adicionarCategoria() {
  if (roleUsuario !== "Admin") {
    alert("Apenas administradores podem gerenciar categorias.");
    return;
  }

  const input = document.getElementById("novaCategoria");
  const novaCategoria = input.value.trim();

  if (!novaCategoria) {
    alert("Digite um nome para a categoria");
    return;
  }

  if (categoriasList.includes(novaCategoria)) {
    alert("Esta categoria já existe");
    return;
  }

  categoriasList.push(novaCategoria);
  input.value = "";
  renderizarConfigCampos();

  try {
    document.getElementById("loadingOverlay").style.display = "flex";
    await fetch(appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "addCategory",
        userEmail: usuarioLogado ? usuarioLogado.email : "anonimo",
        categoria: novaCategoria,
      }),
    });
    document.getElementById("loadingOverlay").style.display = "none";
    alert("✅ Categoria adicionada!");
  } catch (erro) {
    document.getElementById("loadingOverlay").style.display = "none";
    console.error("Erro ao adicionar categoria:", erro);
    alert("❌ Erro ao salvar categoria");
  }
}

function removerCategoria(index) {
  if (roleUsuario !== "Admin") {
    alert("Apenas administradores podem gerenciar categorias.");
    return;
  }

  const categoria = categoriasList[index];

  if (confirm(`Tem certeza que deseja remover "${categoria}"?`)) {
    document.getElementById("loadingOverlay").style.display = "flex";
    categoriasList.splice(index, 1);
    renderizarConfigCampos();
    fetch(appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "deleteCategory",
        userEmail: usuarioLogado ? usuarioLogado.email : "anonimo",
        categoria: categoria,
      }),
    }).catch((erro) => console.error("Erro ao deletar categoria:", erro));
    document.getElementById("loadingOverlay").style.display = "none";
  }
}
