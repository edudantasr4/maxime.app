// ====== CONFIGURAÇÕES BÁSICAS ======

// Senhas simples (trocar depois)
const MASTER_PASSWORD = "master123";
const CONSULTOR_PASSWORD = "consultor123";

// URL da API de leitura (Apps Script)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxjTbj-AapfLmAAUz-Zi8uUfwVkyK5QN4F9uOuzV7ckApJeXBARumPiQohB4Y_JJLWmQw/exec";

// URL para atualizar status (mesmo Apps Script com doPost)
const UPDATE_STATUS_URL =
  "https://script.google.com/macros/s/AKfycbxjTbj-AapfLmAAUz-Zi8uUfwVkyK5QN4F9uOuzV7ckApJeXBARumPiQohB4Y_JJLWmQw/exec";

let currentRole = null; // "master" ou "consultor"
let allData = []; // Dados carregados da API

// ====== LOGIN ======

async function handleLogin() {
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("login-error");

  let ok = false;
  if (role === "master" && password === MASTER_PASSWORD) ok = true;
  if (role === "consultor" && password === CONSULTOR_PASSWORD) ok = true;

  if (!ok) {
    errorEl.textContent = "Usuário ou senha inválidos.";
    return;
  }

  // Tenta carregar dados da API
  try {
    errorEl.textContent = "Carregando dados...";
    await fetchDataFromAPI();
    errorEl.textContent = "";
  } catch (err) {
    errorEl.textContent = "Erro ao carregar dados: " + err.message;
    console.error("Erro na API:", err);
    return;
  }

  currentRole = role;
  document.getElementById("password").value = "";

  document.getElementById("login-view").style.display = "none";
  document.getElementById("consulta-view").style.display = "block";

  document.getElementById("user-role").textContent =
    role === "master" ? "Logado como MASTER" : "Logado como CONSULTOR";

  document.getElementById("master-dashboard").style.display =
    role === "master" ? "block" : "none";

  renderResults(allData);
  if (role === "master") {
    renderMasterDashboard(allData);
  } else {
    updateDashboard(allData);
  }
}

async function fetchDataFromAPI() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Resposta da API inválida");
    }

    allData = json.data;
    console.log("✅ Dados carregados da API:", allData.length, "registros");
  } catch (err) {
    console.error("❌ Erro ao buscar dados:", err);
    throw err;
  }
}

function handleLogout() {
  currentRole = null;
  allData = [];
  document.getElementById("consulta-view").style.display = "none";
  document.getElementById("login-view").style.display = "block";
  document.getElementById("search-name").value = "";
  document.getElementById("login-error").textContent = "";
}

// ====== BUSCA ======

function handleSearch() {
  const term = document
    .getElementById("search-name")
    .value.trim()
    .toLowerCase();

  if (!term) {
    renderResults(allData);
    if (currentRole === "master") {
      renderMasterDashboard(allData);
    } else {
      updateDashboard(allData);
    }
    return;
  }

  const filtered = allData.filter((row) =>
    row.nome.toLowerCase().includes(term),
  );

  renderResults(filtered);
  if (currentRole === "master") {
    renderMasterDashboard(filtered);
  } else {
    updateDashboard(filtered);
  }
}

function renderResults(rows) {
  const tbody = document.getElementById("results-table").querySelector("tbody");

  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "Nenhum registro encontrado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const tdDataHora = document.createElement("td");
    tdDataHora.textContent = formatarData(row.dataHora);
    tr.appendChild(tdDataHora);

    const tdNome = document.createElement("td");
    tdNome.textContent = row.nome || "";
    tr.appendChild(tdNome);

    const tdEmail = document.createElement("td");
    tdEmail.textContent = row.email || "";
    tr.appendChild(tdEmail);

    const tdWhats = document.createElement("td");
    tdWhats.textContent = row.whatsapp || "";
    tr.appendChild(tdWhats);

    const tdDataCas = document.createElement("td");
    tdDataCas.textContent = formatarData(row.dataCasamento);
    tr.appendChild(tdDataCas);

    const tdConsultor = document.createElement("td");
    tdConsultor.textContent = row.consultor || "";
    tr.appendChild(tdConsultor);

    // 🆕 COLUNA DE OBSERVAÇÕES (M) - CLICÁVEL
    const tdObservacao = document.createElement("td");
    tdObservacao.textContent = row.observacao || "";
    tdObservacao.style.maxWidth = "300px";
    tdObservacao.style.wordWrap = "break-word";
    tdObservacao.style.cursor = "pointer";
    tdObservacao.style.color = "#4CAF50";
    tdObservacao.style.textDecoration = "underline";
    tdObservacao.title = "Clique para ver mais";
    tdObservacao.addEventListener("click", () => {
      openObservacaoModal(row.nome, row.observacao);
    });
    tr.appendChild(tdObservacao);

    // 🆕 STATUS EDITÁVEL
    const tdStatus = document.createElement("td");
    tdStatus.style.padding = "4px";

    if (currentRole === "consultor") {
      // Para consultor, mostra um select
      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.padding = "6px 4px";
      select.style.borderRadius = "4px";
      select.style.fontWeight = "bold";
      select.style.border = "1px solid #ddd";
      select.style.cursor = "pointer";

      select.innerHTML = `
        <option value="">Selecione...</option>
        <option value="SIM">SIM</option>
        <option value="AGUARDANDO">AGUARDANDO</option>
        <option value="NÃO">NÃO</option>
      `;
      select.value = row.status || "";

      // Aplica cor inicial
      atualizarCorStatus(select, row.status);

      select.addEventListener("change", async (e) => {
        const newStatus = e.target.value;
        if (!newStatus) return;

        // Atualiza cor imediatamente
        atualizarCorStatus(select, newStatus);

        try {
          select.disabled = true;
          select.style.opacity = "0.7";
          await updateStatusInSheet(row.nome, newStatus);
          row.status = newStatus;

          // Recarrega dados da API
          await fetchDataFromAPI();
          renderResults(allData);
          updateDashboard(allData);
        } catch (err) {
          alert("Erro ao atualizar status: " + err.message);
          select.value = row.status;
          atualizarCorStatus(select, row.status);
          select.disabled = false;
          select.style.opacity = "1";
        }
      });

      tdStatus.appendChild(select);
    } else {
      // Para master, mostra apenas o valor com cor
      tdStatus.textContent = row.status || "";
      aplicarCorStatus(tdStatus, row.status);
    }

    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
}

// ====== FUNÇÕES DE COR DO STATUS ======

function atualizarCorStatus(select, status) {
  if (status === "SIM") {
    select.style.backgroundColor = "#4CAF50";
    select.style.color = "white";
  } else if (status === "NÃO") {
    select.style.backgroundColor = "#F44336";
    select.style.color = "white";
  } else if (status === "AGUARDANDO") {
    select.style.backgroundColor = "#FFC107";
    select.style.color = "black";
  } else {
    select.style.backgroundColor = "white";
    select.style.color = "#333";
  }
}

function aplicarCorStatus(elemento, status) {
  if (status === "SIM") {
    elemento.style.backgroundColor = "#4CAF50";
    elemento.style.color = "white";
    elemento.style.fontWeight = "bold";
  } else if (status === "NÃO") {
    elemento.style.backgroundColor = "#F44336";
    elemento.style.color = "white";
    elemento.style.fontWeight = "bold";
  } else if (status === "AGUARDANDO") {
    elemento.style.backgroundColor = "#FFC107";
    elemento.style.color = "black";
    elemento.style.fontWeight = "bold";
  }
}

// ====== MODAL DE OBSERVAÇÕES ======

function openObservacaoModal(nome, observacao) {
  const modal = document.getElementById("observacao-modal");
  if (!modal) {
    console.error("Modal não encontrado!");
    return;
  }
  document.getElementById("observacao-nome").textContent = nome;
  document.getElementById("observacao-texto").textContent =
    observacao || "(Sem observações)";
  modal.style.display = "block";
}

function closeObservacaoModal() {
  const modal = document.getElementById("observacao-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Fechar modal ao clicar fora
window.addEventListener("click", (e) => {
  const modal = document.getElementById("observacao-modal");
  if (modal && e.target === modal) {
    modal.style.display = "none";
  }
});

// ====== ATUALIZAR STATUS NA PLANILHA ======

async function updateStatusInSheet(nome, novoStatus) {
  try {
    const response = await fetch(UPDATE_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStatus",
        nome: nome,
        status: novoStatus,
      }),
    });

    const result = await response.text();
    console.log("Resposta do servidor:", result);

    if (!response.ok) {
      throw new Error("Erro ao atualizar: " + result);
    }

    return true;
  } catch (err) {
    console.error("❌ Erro ao atualizar status:", err);
    throw err;
  }
}

// Formata datas que vêm do Google Sheets
function formatarData(valor) {
  if (!valor) return "";

  // Se for número (timestamp do Sheets)
  if (typeof valor === "number") {
    const date = new Date((valor - 25569) * 86400 * 1000);
    return date.toLocaleDateString("pt-BR");
  }

  // Se for string, tenta parsear
  if (typeof valor === "string") {
    const date = new Date(valor);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR");
    }
    return valor; // Retorna como estava se não conseguir parsear
  }

  return "";
}

// ====== DASHBOARD CONSULTOR ======

function updateDashboard(rows) {
  const total = rows.length;
  const fecharam = rows.filter((r) => r.status === "SIM").length;
  const nao = rows.filter((r) => r.status === "NÃO").length;
  const aguardando = rows.filter((r) => r.status === "AGUARDANDO").length;

  document.getElementById("dash-total").textContent = total;
  document.getElementById("dash-fecharam").textContent = fecharam;
  document.getElementById("dash-nao").textContent = nao;
  document.getElementById("dash-aguardando").textContent = aguardando;
}

// ====== DASHBOARD MASTER - KPI ======

function renderMasterDashboard(rows) {
  const total = rows.length;
  const fecharam = rows.filter((r) => r.status === "SIM").length;
  const nao = rows.filter((r) => r.status === "NÃO").length;
  const aguardando = rows.filter((r) => r.status === "AGUARDANDO").length;

  const hoje = new Date();
  const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const mesPassado = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  // Filtros por período
  const estaSemana = rows.filter((r) => {
    const data = parseDataRS(r.dataHora);
    return data >= semanaPassada && r.status === "SIM";
  });

  const esteMs = rows.filter((r) => {
    const data = parseDataRS(r.dataHora);
    return data >= inicioMes && r.status === "SIM";
  });

  const ultimos30 = rows.filter((r) => {
    const data = parseDataRS(r.dataHora);
    return data >= mesPassado && r.status === "SIM";
  });

  // TOP Consultores (SIM)
  const topConsultores = calcularTopConsultores(rows);

  // TOP Fotógrafos (mais indicados)
  const topFotografos = calcularTopFotografos(rows);

  // TOP Cerimoniais (mais indicados)
  const topCerimoniais = calcularTopCerimoniais(rows);

  // Taxa de conversão
  const taxaConversao = total > 0 ? ((fecharam / total) * 100).toFixed(1) : 0;

  // Renderizar
  const dashboardHTML = `
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
      <h2 style="text-align: center; color: #333; margin-bottom: 20px;">📊 DASHBOARD MASTER - KPI</h2>

      <!-- INDICADORES PRINCIPAIS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px;">
        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #4CAF50; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Total de Formulários</div>
          <div style="font-size: 32px; font-weight: bold; color: #4CAF50;">${total}</div>
        </div>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #4CAF50; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Fecharam Aluguel</div>
          <div style="font-size: 32px; font-weight: bold; color: #4CAF50;">${fecharam}</div>
        </div>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #F44336; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Não Fecharam</div>
          <div style="font-size: 32px; font-weight: bold; color: #F44336;">${nao}</div>
        </div>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #FFC107; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Aguardando Fechamento</div>
          <div style="font-size: 32px; font-weight: bold; color: #FFC107;">${aguardando}</div>
        </div>

        <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #2196F3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="color: #888; font-size: 13px; margin-bottom: 8px;">Taxa de Conversão</div>
          <div style="font-size: 32px; font-weight: bold; color: #2196F3;">${taxaConversao}%</div>
        </div>
      </div>

      <!-- FILTROS POR PERÍODO -->
      <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">📅 Fechamentos por Período</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <div style="color: #888; font-size: 12px;">Esta Semana</div>
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${estaSemana.length}</div>
          </div>
          <div>
            <div style="color: #888; font-size: 12px;">Este Mês</div>
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${esteMs.length}</div>
          </div>
          <div>
            <div style="color: #888; font-size: 12px;">Últimos 30 dias</div>
            <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${ultimos30.length}</div>
          </div>
        </div>
      </div>

      <!-- TOP CONSULTORES -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <!-- TOP CONSULTORES (SIM) -->
        <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">👥 Top Consultores (Fechamentos SIM)</h3>
          <div style="font-size: 13px;">
            ${topConsultores
              .map(
                (c, i) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #333;">${i + 1}. <strong>${c.nome}</strong></span>
                <span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${c.count}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- TOP FOTÓGRAFOS -->
        <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">📷 Top Fotógrafos (Mais Indicados)</h3>
          <div style="font-size: 13px;">
            ${topFotografos
              .map(
                (f, i) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #333;">${i + 1}. <strong>${f.nome || "(Vazio)"}</strong></span>
                <span style="background: #2196F3; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${f.count}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- TOP CERIMONIAIS -->
        <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">💒 Top Cerimoniais (Mais Indicados)</h3>
          <div style="font-size: 13px;">
            ${topCerimoniais
              .map(
                (c, i) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="color: #333;">${i + 1}. <strong>${c.nome || "(Vazio)"}</strong></span>
                <span style="background: #FF9800; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${c.count}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("master-dashboard").innerHTML = dashboardHTML;
}

// ====== FUNÇÕES AUXILIARES PARA CALCULAR TOP ======

function calcularTopConsultores(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.status === "SIM" && r.consultor) {
      const nome = r.consultor.trim();
      map[nome] = (map[nome] || 0) + 1;
    }
  });

  return Object.entries(map)
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function calcularTopFotografos(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.fotografo) {
      const nome = r.fotografo.trim();
      map[nome] = (map[nome] || 0) + 1;
    }
  });

  return Object.entries(map)
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function calcularTopCerimoniais(rows) {
  const map = {};
  rows.forEach((r) => {
    if (r.cerimonial) {
      const nome = r.cerimonial.trim();
      map[nome] = (map[nome] || 0) + 1;
    }
  });

  return Object.entries(map)
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function parseDataRS(valor) {
  if (!valor) return new Date(0);

  if (typeof valor === "number") {
    return new Date((valor - 25569) * 86400 * 1000);
  }

  if (typeof valor === "string") {
    return new Date(valor);
  }

  return new Date(0);
}

// ====== INICIALIZAÇÃO ======

function init() {
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("search-btn").addEventListener("click", handleSearch);

  // Modal close buttons
  const closeBtn1 = document.getElementById("close-modal-btn");
  const closeBtn2 = document.getElementById("close-modal-btn-footer");

  if (closeBtn1) closeBtn1.addEventListener("click", closeObservacaoModal);
  if (closeBtn2) closeBtn2.addEventListener("click", closeObservacaoModal);

  document.getElementById("password").addEventListener("keyup", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  document.getElementById("search-name").addEventListener("keyup", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  console.log("✅ App Maxime inicializado - Conectado à API real");
}

document.addEventListener("DOMContentLoaded", init);
