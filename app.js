// ===== CONFIGURAÇÕES EMAILJS =====
const EMAILJS_PUBLIC_KEY = "IN4Q24MwID8vgdvUw";
const EMAILJS_SERVICE_ID = "service_xv1618p";
const EMAILJS_TEMPLATE_ID = "template_maxime_cadastro";

// ===== CONFIGURAÇÕES BÁSICAS =====
const MASTER_PASSWORD = "master123";
const CONSULTOR_PASSWORD = "consultor123";

// 🔴 URL CORRETA DO APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbwOie7Urlq0LPtw4nmnPnGMC0BXD18ZG_bI1yyIaHAhNHbsdjLRhgdt8Dum3lLz0rmJ0Q/exec";
const UPDATE_STATUS_URL = "https://script.google.com/macros/s/AKfycbwOie7Urlq0LPtw4nmnPnGMC0BXD18ZG_bI1yyIaHAhNHbsdjLRhgdt8Dum3lLz0rmJ0Q/exec";

// ===== INICIALIZAR EMAILJS =====
emailjs.init(EMAILJS_PUBLIC_KEY);

let currentRole = null;
let allData = [];
let ultimoRegistroEnviado = null;
let ultimasDataVerificada = null;

console.log("✅ App Maxime inicializado – Conectado à API real");

// ===== VERIFICAR NOVOS REGISTROS A CADA 2 SEGUNDOS =====
setInterval(async () => {
  await verificarNovoRegistro();
}, 2000);

// ===== VERIFICAR SE HÁ NOVO REGISTRO =====
async function verificarNovoRegistro() {
  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    const data = result.data || [];

    if (data.length === 0) return;

    const ultimoRegistro = data[0]; // O mais recente está no topo
    const dataAtual = ultimoRegistro.dataHora ? new Date(ultimoRegistro.dataHora).getTime() : 0;

    // Se é um registro novo (diferente do último verificado)
    if (ultimasDataVerificada !== dataAtual && ultimoRegistro.email) {
      console.log("🆕 NOVO REGISTRO DETECTADO:", ultimoRegistro.nome);
      ultimasDataVerificada = dataAtual;

      // Enviar email imediatamente
      await enviarEmailComEmailJS(
        ultimoRegistro.email,
        ultimoRegistro.nome,
        ultimoRegistro.observacao
      );
    }
  } catch (error) {
    console.error("Erro ao verificar novo registro:", error);
  }
}

// ===== LOGIN =====
async function handleLogin() {
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("login-error");

  if (!role || !password) {
    errorEl.textContent = "Preencha todos os campos!";
    return;
  }

  const correctPassword = role === "master" ? MASTER_PASSWORD : CONSULTOR_PASSWORD;

  if (password !== correctPassword) {
    errorEl.textContent = "Senha incorreta!";
    return;
  }

  currentRole = role;
  document.getElementById("login-view").style.display = "none";
  document.getElementById("consulta-view").style.display = "block";

  // Mostrar/esconder dashboard master
  const dashboard = document.getElementById("master-dashboard");
  if (currentRole === "master") {
    dashboard.style.display = "block";
    document.getElementById("user-role").textContent = "Logado como MASTER";
  } else {
    dashboard.style.display = "none";
    document.getElementById("user-role").textContent = "Logado como CONSULTOR";
  }

  await fetchDataFromAPI();
}

// ===== FETCH DATA =====
async function fetchDataFromAPI() {
  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    allData = result.data || [];
    console.log(`✅ Dados carregados da API: ${allData.length} registros`);
    renderResults();
    if (currentRole === "master") {
      renderMasterDashboard();
    }
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    alert("Erro ao carregar dados!");
  }
}

// ===== LOGOUT =====
function handleLogout() {
  currentRole = null;
  document.getElementById("login-view").style.display = "block";
  document.getElementById("consulta-view").style.display = "none";
  document.getElementById("role").value = "consultor";
  document.getElementById("password").value = "";
  document.getElementById("login-error").textContent = "";
  document.getElementById("search-name").value = "";
  allData = [];
}

// ===== BUSCA =====
function handleSearch() {
  const searchTerm = document.getElementById("search-name").value.toLowerCase();
  if (searchTerm === "") {
    renderResults();
    return;
  }

  const filtered = allData.filter(row =>
    row.nome.toLowerCase().includes(searchTerm)
  );
  renderTable(filtered);
}

// ===== RENDER RESULTS =====
function renderResults() {
  renderTable(allData);
}

// ===== RENDER TABLE =====
function renderTable(data) {
  const tbody = document.querySelector("#results-table tbody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Nenhum resultado encontrado</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");

    // Status dropdown para Consultor, texto para Master
    let statusCell = "";
    if (currentRole === "consultor") {
      statusCell = `
        <select onchange="updateStatus('${row.nome}', this.value)" class="status-select">
          <option value="AGUARDANDO" ${row.status === "AGUARDANDO" ? "selected" : ""}>AGUARDANDO</option>
          <option value="SIM" ${row.status === "SIM" ? "selected" : ""}>SIM</option>
          <option value="NÃO" ${row.status === "NÃO" ? "selected" : ""}>NÃO</option>
        </select>
      `;
    } else {
      const statusColor = row.status === "SIM" ? "#4CAF50" : row.status === "NÃO" ? "#F44336" : "#FFC107";
      const statusText = row.status || "SEM STATUS";
      statusCell = `<span style="background-color: ${statusColor}; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px;">${statusText}</span>`;
    }

    // Observações clicável
    let obsCell = "";
    if (row.observacao && row.observacao.trim()) {
      const obsText = row.observacao.substring(0, 30) + (row.observacao.length > 30 ? "..." : "");
      obsCell = `<span style="color: green; text-decoration: underline; cursor: pointer; font-size: 12px;" onclick="openObservacaoModal('${row.nome.replace(/'/g, "\\'")}', '${row.observacao.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')">${obsText}</span>`;
    }

    const dataFormatada = row.dataHora ? new Date(row.dataHora).toLocaleDateString('pt-BR') : "";

    tr.innerHTML = `
      <td>${dataFormatada}</td>
      <td>${row.nome || ""}</td>
      <td>${row.email || ""}</td>
      <td>${row.whatsapp || ""}</td>
      <td>${row.dataCasamento || ""}</td>
      <td>${row.consultor || ""}</td>
      <td>${obsCell}</td>
      <td>${statusCell}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ===== MODAL OBSERVAÇÕES =====
function openObservacaoModal(nome, observacao) {
  document.getElementById("observacao-modal").style.display = "block";
  document.getElementById("observacao-nome").textContent = nome;
  document.getElementById("observacao-texto").textContent = observacao;
}

function closeObservacaoModal() {
  document.getElementById("observacao-modal").style.display = "none";
}

// Fechar modal ao clicar no X
document.addEventListener("DOMContentLoaded", function() {
  const modal = document.getElementById("observacao-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeBtnFooter = document.getElementById("close-modal-btn-footer");

  if (closeBtn) {
    closeBtn.onclick = closeObservacaoModal;
  }
  if (closeBtnFooter) {
    closeBtnFooter.onclick = closeObservacaoModal;
  }

  window.onclick = function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  };

  // Event listeners dos botões
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const searchBtn = document.getElementById("search-btn");
  const searchInput = document.getElementById("search-name");
  const passwordInput = document.getElementById("password");

  if (loginBtn) loginBtn.onclick = handleLogin;
  if (logoutBtn) logoutBtn.onclick = handleLogout;
  if (searchBtn) searchBtn.onclick = handleSearch;

  if (searchInput) {
    searchInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") handleSearch();
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") handleLogin();
    });
  }
});

// ===== UPDATE STATUS =====
async function updateStatus(nome, novoStatus) {
  try {
    const response = await fetch(UPDATE_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateStatus",
        nome: nome,
        status: novoStatus
      })
    });

    const result = await response.text();
    console.log("Status atualizado:", result);
    await fetchDataFromAPI();
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    alert("Erro ao atualizar status!");
  }
}

// ===== ENVIAR EMAIL COM EMAILJS =====
async function enviarEmailComEmailJS(email, nome, observacao) {
  try {
    if (!email || email.trim() === "") {
      console.log("❌ Email vazio, não enviando");
      return false;
    }

    console.log("📧📧📧 ENVIANDO EMAIL PARA:", email);

    const templateParams = {
      to_email: email,
      nome: nome,
      observacao: observacao || "Sem observações",
      data_envio: new Date().toLocaleDateString('pt-BR')
    };

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );

    console.log("✅✅✅ EMAIL ENVIADO COM SUCESSO PARA:", email);
    console.log("Resposta EmailJS:", response);
    return true;
  } catch (error) {
    console.error("❌❌❌ ERRO AO ENVIAR EMAIL:", error);
    return false;
  }
}

// ===== RENDER MASTER DASHBOARD =====
function renderMasterDashboard() {
  const dashboard = document.getElementById("master-dashboard");

  if (allData.length === 0) {
    dashboard.innerHTML = "<p>Nenhum dado disponível</p>";
    return;
  }

  const total = allData.length;
  const fecharam = allData.filter(r => r.status === "SIM").length;
  const naoFecharam = allData.filter(r => r.status === "NÃO").length;
  const aguardando = allData.filter(r => r.status === "AGUARDANDO").length;
  const taxa = total > 0 ? ((fecharam / total) * 100).toFixed(2) : 0;

  // Filtros por período
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const seteeDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const estaSemana = allData.filter(r => {
    const d = new Date(r.dataHora);
    return r.status === "SIM" && d >= seteeDiasAtras && d <= agora;
  }).length;

  const esteMes = allData.filter(r => {
    const d = new Date(r.dataHora);
    return r.status === "SIM" && d >= inicioMes && d <= agora;
  }).length;

  const ultimos30 = allData.filter(r => {
    const d = new Date(r.dataHora);
    return r.status === "SIM" && d >= trintaDiasAtras && d <= agora;
  }).length;

  // Top Consultores
  const consultoresMap = {};
  allData.forEach(r => {
    if (r.status === "SIM" && r.consultor) {
      consultoresMap[r.consultor] = (consultoresMap[r.consultor] || 0) + 1;
    }
  });
  const topConsultores = Object.entries(consultoresMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top Fotógrafos
  const fotografosMap = {};
  allData.forEach(r => {
    if (r.fotografo) {
      fotografosMap[r.fotografo] = (fotografosMap[r.fotografo] || 0) + 1;
    }
  });
  const topFotografos = Object.entries(fotografosMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top Cerimoniais
  const cerimonialMap = {};
  allData.forEach(r => {
    if (r.cerimonial) {
      cerimonialMap[r.cerimonial] = (cerimonialMap[r.cerimonial] || 0) + 1;
    }
  });
  const topCerimoniais = Object.entries(cerimonialMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  dashboard.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
      <div style="border-left: 4px solid #4CAF50; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Total de Formulários</div>
        <div style="font-size: 24px; font-weight: bold;">${total}</div>
      </div>
      <div style="border-left: 4px solid #4CAF50; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Fecharam Aluguel</div>
        <div style="font-size: 24px; font-weight: bold;">${fecharam}</div>
      </div>
      <div style="border-left: 4px solid #F44336; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Não Fecharam</div>
        <div style="font-size: 24px; font-weight: bold;">${naoFecharam}</div>
      </div>
      <div style="border-left: 4px solid #FFC107; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Aguardando</div>
        <div style="font-size: 24px; font-weight: bold;">${aguardando}</div>
      </div>
      <div style="border-left: 4px solid #2196F3; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Taxa de Conversão</div>
        <div style="font-size: 24px; font-weight: bold;">${taxa}%</div>
      </div>
    </div>

    <div style="margin-bottom: 30px;">
      <h3>Fechamentos por Período (SIM)</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Esta Semana</div>
          <div style="font-size: 20px; font-weight: bold;">${estaSemana}</div>
        </div>
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Este Mês</div>
          <div style="font-size: 20px; font-weight: bold;">${esteMes}</div>
        </div>
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Últimos 30 dias</div>
          <div style="font-size: 20px; font-weight: bold;">${ultimos30}</div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
      <div>
        <h4>Top Consultores</h4>
        <ul style="list-style: none; padding: 0;">
          ${topConsultores.length > 0 ? topConsultores.map(([consultor, count]) => `<li>${consultor}: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
      <div>
        <h4>Top Fotógrafos</h4>
        <ul style="list-style: none; padding: 0;">
          ${topFotografos.length > 0 ? topFotografos.map(([fotografo, count]) => `<li>${fotografo}: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
      <div>
        <h4>Top Cerimoniais</h4>
        <ul style="list-style: none; padding: 0;">
          ${topCerimoniais.length > 0 ? topCerimoniais.map(([cerimonial, count]) => `<li>${cerimonial}: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
    </div>
  `;
}
