// URL DE TU SCRIPT DE GOOGLE
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx63KFX3ufsTu6Kd0-G3bTz6WAmyZSfRxudGA6GgJZkL_RVEBqnXvrPwVYrXaHx57hq/exec";

let colaArchivos =[];

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem('sys_token');
  if (token) {
    document.getElementById('user-display').innerText = localStorage.getItem('sys_user');
    mostrarVista('app-view');
    cargarHistorial();
  } else {
    mostrarVista('login-view');
  }
  configurarDragAndDrop();
});

function mostrarVista(id) {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById(id).classList.remove('hidden');
}

// --- COMUNICACIÓN API ---
async function llamarApi(datos) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    });
    const json = await response.json();
    if (json.error_code === "SESION_EXPIRADA") cerrarSesion();
    return json;
  } catch (e) {
    console.error("Error API:", e);
    return { success: false, message: "Error de red o conexión." };
  }
}

async function iniciarSesion() {
  const u = document.getElementById('user').value.trim();
  const p = document.getElementById('pass').value.trim();
  const btn = document.getElementById('btn-login');

  if (!u || !p) return mostrarToast("Ingresa usuario y contraseña", "error");
  
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Verificando...`;

  const res = await llamarApi({ action: 'login', usuario: u, password: p });
  
  if (res.success) {
    localStorage.setItem('sys_token', res.token);
    localStorage.setItem('sys_user', res.usuario);
    window.location.reload();
  } else {
    mostrarToast(res.message, "error");
    btn.disabled = false;
    btn.innerHTML = `Ingresar <i class="fas fa-arrow-right"></i>`;
  }
}

function cerrarSesion() {
  localStorage.clear();
  window.location.reload();
}

// --- MANEJO DE ARCHIVOS (IMÁGENES Y ACUMULACIÓN) ---

// Filtro crucial: Solo permite imágenes
function filtrarImagenes(archivosOriginales) {
  const imagenes = archivosOriginales.filter(file => file.type.startsWith('image/'));
  
  if (imagenes.length < archivosOriginales.length) {
    mostrarToast("Solo se permiten archivos de imagen (JPG, PNG, GIF, etc.). Los otros fueron descartados.", "error");
  }
  return imagenes;
}

function manejarArchivos(e) {
  let files = Array.from(e.target.files);
  files = filtrarImagenes(files); // Filtramos antes de acumular
  
  if(files.length > 0) {
    colaArchivos =[...colaArchivos, ...files];
    actualizarColaUI();
  }
  e.target.value = ""; // Resetea el input para poder seleccionar los mismos archivos después
}

function actualizarColaUI() {
  const list = document.getElementById('pending-list');
  const count = document.getElementById('file-count');
  const btn = document.getElementById('btn-upload');
  
  list.innerHTML = "";
  
  if (colaArchivos.length > 0) {
    count.classList.remove('hidden');
    document.getElementById('file-count-text').innerText = colaArchivos.length;
    btn.disabled = false;
    
    colaArchivos.forEach((f, i) => {
      list.innerHTML += `
        <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm fade-in">
          <span class="text-sm font-medium truncate max-w-[250px] text-slate-700"><i class="far fa-image mr-2 text-blue-500"></i>${f.name}</span>
          <button onclick="quitarArchivo(${i})" class="text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"><i class="fas fa-trash-alt"></i></button>
        </div>`;
    });
  } else {
    count.classList.add('hidden');
  }
}

function quitarArchivo(i) {
  colaArchivos.splice(i, 1);
  actualizarColaUI();
}

async function procesarSubida() {
  if (colaArchivos.length === 0) return mostrarToast("No hay imágenes en la cola", "error");
  
  const btn = document.getElementById('btn-upload');
  const bar = document.getElementById('progress-bar');
  const status = document.getElementById('status-area');
  const token = localStorage.getItem('sys_token');
  
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo...`;
  status.classList.remove('hidden');
  
  let exitos = 0;

  for (let i = 0; i < colaArchivos.length; i++) {
    const file = colaArchivos[i];
    bar.style.width = `${((i + 1) / colaArchivos.length) * 100}%`;
    
    const base64 = await toBase64(file);
    const res = await llamarApi({
      action: 'upload', token: token, base64Data: base64.split(',')[1], fileName: file.name, mimeType: file.type
    });
    
    if (res.success) {
      agregarResultadoUI(res.fileName, res.directUrl, res.driveUrl);
      exitos++;
    } else {
      mostrarToast(`Error subiendo ${file.name}: ${res.message}`, "error");
    }
  }
  
  colaArchivos =[]; // Vaciar la cola tras intentar subir todo
  actualizarColaUI();
  mostrarToast(`Se subieron ${exitos} imágenes correctamente`);
  btn.disabled = false;
  btn.innerHTML = `<i class="fas fa-bolt"></i> <span>Comenzar Subida</span>`;
  cargarHistorial(); // Refrescar el historial en segundo plano
}

// --- HISTORIAL Y MODAL ---
async function cargarHistorial() {
  const list = document.getElementById('history-list');
  const loading = document.getElementById('history-loading');
  loading.classList.remove('hidden');
  list.innerHTML = "";

  const res = await llamarApi({ action: 'get_records', token: localStorage.getItem('sys_token') });
  loading.classList.add('hidden');

  if (res.success) {
    if (res.records.length === 0) {
      list.innerHTML = "<div class='text-center flex flex-col items-center text-slate-400 py-10'><i class='fas fa-folder-open text-3xl mb-3 opacity-50'></i><p class='font-medium'>Base de datos vacía</p></div>";
      return;
    }
    res.records.forEach(rec => {
      list.innerHTML += `
        <div class="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-300 group">
          <div class="flex items-center gap-4 cursor-pointer overflow-hidden flex-1" onclick="abrirModal('${rec.urlDirecta}', '${rec.nombre}')">
            <div class="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <i class="far fa-image text-lg"></i>
            </div>
            <div class="truncate">
              <p class="text-sm font-bold text-slate-800 truncate">${rec.nombre}</p>
              <p class="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-1">${rec.usuario} • ${rec.fecha.substring(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          <button onclick="copiarLink('${rec.urlDirecta}', this)" class="shrink-0 ml-3 bg-slate-50 text-slate-600 font-bold px-4 py-2.5 text-xs rounded-xl border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">
            Copiar URL
          </button>
        </div>`;
    });
  }
}

function abrirModal(url, nombre) {
  const modal = document.getElementById('image-modal');
  document.getElementById('modal-img').src = url;
  document.getElementById('modal-title').innerText = nombre;
  document.getElementById('modal-copy-btn').onclick = () => copiarLink(url, document.getElementById('modal-copy-btn'));
  modal.classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('image-modal').classList.add('hidden');
  document.getElementById('modal-img').src = "";
}

// --- UTILIDADES ---
function mostrarToast(msg, tipo = "success") {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `px-6 py-3.5 rounded-2xl shadow-xl text-white font-medium text-sm flex items-center gap-3 fade-in ${tipo === 'success' ? 'bg-slate-900' : 'bg-red-600'}`;
  t.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle text-green-400' : 'fa-exclamation-triangle'}"></i> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

function copiarLink(url, btn) {
  navigator.clipboard.writeText(url);
  mostrarToast("¡URL copiada al portapapeles!");
  if(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check mr-2"></i>¡Copiado!`;
    btn.classList.add('bg-green-600');
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('bg-green-600');
    }, 2000);
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function configurarDragAndDrop() {
  const dz = document.getElementById('drop-zone');
  ['dragenter', 'dragover'].forEach(n => dz.addEventListener(n, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));['dragleave', 'drop'].forEach(n => dz.addEventListener(n, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => {
    let files = Array.from(e.dataTransfer.files);
    files = filtrarImagenes(files); // Filtramos al arrastrar y soltar
    
    if(files.length > 0) {
      colaArchivos = [...colaArchivos, ...files];
      actualizarColaUI();
    }
  });
}

function cambiarTab(id) {
  document.getElementById('upload-tab').classList.toggle('hidden', id !== 'upload-tab');
  document.getElementById('history-tab').classList.toggle('hidden', id !== 'history-tab');
  
  const activo = 'flex-1 py-4 font-bold text-blue-600 border-b-2 border-blue-600 transition-colors';
  const inactivo = 'flex-1 py-4 font-bold text-slate-400 border-b-2 border-transparent hover:text-slate-600 transition-colors';
  
  document.getElementById('tab-u').className = id === 'upload-tab' ? activo : inactivo;
  document.getElementById('tab-h').className = id === 'history-tab' ? activo : inactivo;
}

function agregarResultadoUI(nombre, urlDirecta, urlDrive) {
  const resList = document.getElementById('results-list');
  
  resList.innerHTML = `
    <div class="bg-green-50/50 p-3 rounded-xl border border-green-100 flex justify-between items-center fade-in mt-2">
      <span class="text-xs font-bold text-slate-700 truncate pr-4"><i class="fas fa-check-circle text-green-500 mr-2"></i>${nombre}</span>
      <div class="flex gap-2">
        <!-- BOTÓN VER EN DRIVE -->
        <a href="${urlDrive}" target="_blank" class="shrink-0 flex items-center bg-white hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-[10px] font-extrabold rounded-lg shadow-sm border border-slate-200 transition-colors">
          <i class="fas fa-external-link-alt mr-1"></i> DRIVE
        </a>
        <!-- BOTÓN COPIAR LH3 -->
        <button onclick="copiarLink('${urlDirecta}')" class="shrink-0 bg-blue-600 hover:bg-slate-900 text-white px-3 py-1.5 text-[10px] font-extrabold rounded-lg shadow-sm transition-colors">
          COPIAR URL
        </button>
      </div>
    </div>` + resList.innerHTML;
}