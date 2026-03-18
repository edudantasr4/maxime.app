// ===== CONFIGURAÇÕES BÁSICAS =====
const MASTER_PASSWORD = "master123";
const CONSULTOR_PASSWORD = "consultor123";

// 🔴 URL DO WORKER (intermediário para evitar CORS)
const WORKER_URL = "https://maxime.eduardo-0a6.workers.dev/";
const API_URL = WORKER_URL;
const UPDATE_STATUS_URL = WORKER_URL;

let currentRole = null;
let allData = [];
let statusAlterados = {}; // Armazenar alterações pendentes

console.log("✅ App Maxime inicializado – Conectado à API real");

// ===== VERIFICAR SESSÃO AO CARREGAR =====
document.addEventListener("DOMContentLoaded", function() {
  const sessao = localStorage.getItem("maxime_sessao");
  if (sessao) {
    const dados = JSON.parse(sessao);
    currentRole = dados.role;
    
    if (currentRole) {
      document.getElementById("login-view").style.display = "none";
      document.getElementById("consulta-view").style.display = "block";
      
      const dashboard = document.getElementById("master-dashboard");
      if (currentRole === "master") {
        dashboard.style.display = "block";
        document.getElementById("user-role").textContent = "Logado como MASTER";
      } else {
        dashboard.style.display = "none";
        document.getElementById("user-role").textContent = "Logado como CONSULTOR";
      }
      
      fetchDataFromAPI();
    }
  }

  // Event listeners
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const searchBtn = document.getElementById("search-btn");
  const salvarBtn = document.getElementById("salvar-status-btn");
  const searchInput = document.getElementById("search-name");
  const passwordInput = document.getElementById("password");

  if (loginBtn) loginBtn.onclick = handleLogin;
  if (logoutBtn) logoutBtn.onclick = handleLogout;
  if (searchBtn) searchBtn.onclick = handleSearch;
  if (salvarBtn) salvarBtn.onclick = salvarAlteracoes;

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

  // Modal
  const modal = document.getElementById("observacao-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const closeBtnFooter = document.getElementById("close-modal-btn-footer");

  if (closeBtn) closeBtn.onclick = closeObservacaoModal;
  if (closeBtnFooter) closeBtnFooter.onclick = closeObservacaoModal;

  window.onclick = function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  };
});

// ===== VERIFICAR ATUALIZAÇÕES A CADA 3 SEGUNDOS (PARA MASTER) =====
setInterval(async () => {
  if (currentRole === "master" && document.getElementById("consulta-view").style.display !== "none") {
    await fetchDataFromAPI();
  }
}, 3000);

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
  
  // Salvar sessão
  localStorage.setItem("maxime_sessao", JSON.stringify({ role: role }));
  
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
  }
}

// ===== LOGOUT =====
function handleLogout() {
  currentRole = null;
  localStorage.removeItem("maxime_sessao");
  document.getElementById("login-view").style.display = "block";
  document.getElementById("consulta-view").style.display = "none";
  document.getElementById("role").value = "consultor";
  document.getElementById("password").value = "";
  document.getElementById("login-error").textContent = "";
  document.getElementById("search-name").value = "";
  allData = [];
  statusAlterados = {};
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
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">Nenhum resultado encontrado</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");

    // Status dropdown para Consultor, cores para Master
    let statusCell = "";
    let statusAtual = statusAlterados[row.nome] || row.status || "AGUARDANDO";
    
    if (currentRole === "consultor") {
      // Dropdown com cores inline
      statusCell = `
        <select id="status-${row.nome.replace(/\s/g, '-')}" class="status-select" onchange="registrarMudanca('${row.nome}', this.value)" style="
          padding: 8px 12px;
          border-radius: 5px;
          border: 2px solid #ddd;
          font-weight: bold;
          cursor: pointer;
          font-size: 13px;
          width: 120px;
        ">
          <option value="AGUARDANDO" ${statusAtual === "AGUARDANDO" ? "selected" : ""}>AGUARDANDO</option>
          <option value="SIM" ${statusAtual === "SIM" ? "selected" : ""}>SIM</option>
          <option value="NÃO" ${statusAtual === "NÃO" ? "selected" : ""}>NÃO</option>
        </select>
      `;
    } else {
      // Master vê apenas cores
      let statusColor = "#FFC107";
      let statusText = "AGUARDANDO";
      
      if (statusAtual === "SIM") {
        statusColor = "#4CAF50";
        statusText = "SIM";
      } else if (statusAtual === "NÃO") {
        statusColor = "#F44336";
        statusText = "NÃO";
      }
      
      statusCell = `<span style="background-color: ${statusColor} !important; color: white; padding: 8px 12px; border-radius: 5px; font-size: 13px; font-weight: bold; display: inline-block; min-width: 100px; text-align: center;">${statusText}</span>`;
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

  // Mostrar botão salvar se for consultor
  const salvarBtn = document.getElementById("salvar-status-btn");
  if (salvarBtn) {
    if (currentRole === "consultor") {
      salvarBtn.style.display = "inline-block";
    } else {
      salvarBtn.style.display = "none";
    }
  }
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

// ===== REGISTRAR MUDANÇA DE STATUS =====
function registrarMudanca(nome, novoStatus) {
  statusAlterados[nome] = novoStatus;
  console.log(`📝 Mudança registrada: ${nome} → ${novoStatus}`);
  console.log(`Total de mudanças: ${Object.keys(statusAlterados).length}`);
}

// ===== SALVAR ALTERAÇÕES =====
async function salvarAlteracoes() {
  try {
    let alteracoesEnviadas = 0;
    
    for (const nome in statusAlterados) {
      const novoStatus = statusAlterados[nome];
      const select = document.getElementById(`status-${nome.replace(/\s/g, '-')}`);
      const statusSelecionado = select ? select.value : novoStatus;

      const response = await fetch(UPDATE_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStatus",
          nome: nome,
          status: statusSelecionado
        })
      });

      if (response.ok) {
        alteracoesEnviadas++;
      }
    }

    statusAlterados = {};
    alert(`✅ ${alteracoesEnviadas} alteração(ões) salva(s) com sucesso!`);
    
    // Atualizar dados
    await fetchDataFromAPI();
  } catch (error) {
    console.error("Erro ao salvar:", error);
    alert("❌ Erro ao salvar alterações!");
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
        <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${fecharam}</div>
      </div>
      <div style="border-left: 4px solid #F44336; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Não Fecharam</div>
        <div style="font-size: 24px; font-weight: bold; color: #F44336;">${naoFecharam}</div>
      </div>
      <div style="border-left: 4px solid #FFC107; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Aguardando</div>
        <div style="font-size: 24px; font-weight: bold; color: #FFC107;">${aguardando}</div>
      </div>
      <div style="border-left: 4px solid #2196F3; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <div style="font-size: 12px; color: #666;">Taxa de Conversão</div>
        <div style="font-size: 24px; font-weight: bold; color: #2196F3;">${taxa}%</div>
      </div>
    </div>

    <div style="margin-bottom: 30px;">
      <h3>Fechamentos por Período (SIM)</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Esta Semana</div>
          <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">${estaSemana}</div>
        </div>
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Este Mês</div>
          <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">${esteMes}</div>
        </div>
        <div style="padding: 15px; background: #e8f5e9; border-radius: 5px;">
          <div style="font-size: 12px;">Últimos 30 dias</div>
          <div style="font-size: 20px; font-weight: bold; color: #4CAF50;">${ultimos30}</div>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
      <div>
        <h4>Top Consultores</h4>
        <ul style="list-style: none; padding: 0;">
          ${topConsultores.length > 0 ? topConsultores.map(([consultor, count]) => `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${consultor}</strong>: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
      <div>
        <h4>Top Fotógrafos</h4>
        <ul style="list-style: none; padding: 0;">
          ${topFotografos.length > 0 ? topFotografos.map(([fotografo, count]) => `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${fotografo}</strong>: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
      <div>
        <h4>Top Cerimoniais</h4>
        <ul style="list-style: none; padding: 0;">
          ${topCerimoniais.length > 0 ? topCerimoniais.map(([cerimonial, count]) => `<li style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${cerimonial}</strong>: ${count}</li>`).join("") : "<li>Sem dados</li>"}
        </ul>
      </div>
    </div>
  `;
}
