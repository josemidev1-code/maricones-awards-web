/* Maricones Awards: nominaciones y motivos, con envío a la hoja del organizador. */

"use strict";

const PERSONAS = ["Joan", "Víctor", "Batiste", "Chema", "Marc", "Jordi", "Guillem", "Joan Langa"];

// URL de la aplicación web de config-nube/Codigo.gs (terminada en /exec).
const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbzMPTs9sQkZCp2Ne6rMwppaRpQDYG3qnBQ1oaWsqNO0lM9sPq1P1PfrYGuH-191MZGf/exec";
// Contraseñas solo en memoria mientras esta pestaña permanece abierta.
const credenciales = new Map();

const CATEGORIAS = [
  { id: "mas-gracioso", nombre: "😂 El Más Gracioso" },
  { id: "npc", nombre: "🗿 NPC del Año" },
  { id: "clutch", nombre: "🎮 Clutch del Año" },
  { id: "mejor-momento", nombre: "🔥 Mejor Momento" },
  { id: "momento-mas-gracioso", nombre: "💀 Momento Más Gracioso" },
  { id: "frase", nombre: "🗣️ Frase del Año" },
  { id: "mejor-mensaje", nombre: "📱 Mejor Mensaje del Año" },
  { id: "cagada", nombre: "💩 Cagada del Año" },
  { id: "music-taste", nombre: "🎧 Best music taste" },
  { id: "mas-fantasma", nombre: "👻 Mas Fantasma" },
  { id: "glow-up", nombre: "🙈 Best Glow up" },
  { id: "ruinero", nombre: "🤡 Ruinero maxim" },
  { id: "confy", nombre: "🤝Confy Asf" },
  { id: "sensible", nombre: "👀 Mes sensible" },
  { id: "chill-guy", nombre: "🤓 chill guy" },
  { id: "cona-grup", nombre: "🗣️Coña del grup" },
  { id: "mes-bebe", nombre: "👼 Mes bebe" },
  { id: "demacracio", nombre: "🧟‍♂️ Demacracio suprema" },
  { id: "major-pluma", nombre: "🪶 Major pluma" },
  { id: "propia-pelicula", nombre: "El que más vive en su propia película" },
  { id: "protagonista", nombre: "El protagonista del grupo" },
  { id: "secundario", nombre: "El secundario que se cree protagonista" },
  { id: "lore", nombre: "El que tiene más lore" },
  { id: "peores-consejos", nombre: "El que da los peores consejos" },
  { id: "mes-putero", nombre: "🫃Mes putero" },
  { id: "persona", nombre: "👑 PERSONA DEL AÑO —" }
];

const NUM_CATEGORIAS = CATEGORIAS.length;
const CLAVE_STORAGE = "maricones-awards-v2";

// ---------- Estado ----------
let persona = null; // nombre de la persona que está respondiendo ahora
let todas = cargarTodo(); // respuestas de toda la gente

function cargarTodo() {
  let datos = {};
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    datos = crudo ? JSON.parse(crudo) : {};
  } catch {
    datos = {};
  }
  // Conserva los antiguos textos como motivos del nuevo cuestionario.
  for (const p of PERSONAS) {
    if (typeof datos[p] !== "object" || datos[p] === null) datos[p] = {};
  }
  return datos;
}

function guardarTodo() {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(todas));
    return true;
  } catch (e) {
    console.warn("No se pudo guardar:", e);
    return false;
  }
}

function normalizarRespuesta(valor) {
  if (typeof valor === "string") return { nominado: "", motivo: valor };
  return { nominado: typeof valor?.nominado === "string" ? valor.nominado : "",
    motivo: typeof valor?.motivo === "string" ? valor.motivo : "" };
}

function respuestaCompleta(r) {
  return PERSONAS.includes(r.nominado) && r.motivo.trim() !== "";
}

function contarRespuestas(p) {
  return CATEGORIAS.filter(c => respuestaCompleta(normalizarRespuesta(todas[p][c.id]))).length;
}

// ---------- Elementos ----------
const selectPersona = document.getElementById("quien-select");
const estadoGuardado = document.getElementById("estado-guardado");
const listaCampos = document.getElementById("lista-campos");
const resumenTexto = document.getElementById("resumen-texto");
const btnEnviar = document.getElementById("btn-enviar");
const btnBorrar = document.getElementById("btn-borrar");
const estadoEnviar = document.getElementById("estado-enviar");
const nav = document.getElementById("nav");
const navToggle = document.getElementById("nav-toggle");

// ---------- Helpers ----------
function mensaje(el, texto) {
  el.textContent = texto;
  el.className = "estado";
  clearTimeout(el._t);
  if (el === estadoEnviar) return; // El resultado del envío permanece visible.
  el._t = setTimeout(() => {
    el.textContent = "";
  }, 4500);
}

function contarPalabras(txt) {
  const n = (txt || "").trim().split(/\s+/).filter(Boolean).length;
  return n === 1 ? "1 palabra" : `${n} palabras`;
}

// ---------- Quién responde ----------
function llenarSelectPersona() {
  selectPersona.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Elige…";
  selectPersona.appendChild(placeholder);
  for (const p of PERSONAS) {
    const opt = document.createElement("option");
    opt.value = p;
    const n = contarRespuestas(p);
    opt.textContent =
      n > 0 ? `${p}  (ya lleva ${n} de ${NUM_CATEGORIAS})` : p;
    selectPersona.appendChild(opt);
  }
  if (persona) selectPersona.value = persona;
}

selectPersona.addEventListener("change", async () => {
  const elegido = selectPersona.value || null;
  if (!elegido) {
    persona = null;
    deshabilitarCampos();
    renderResumen();
    renderProgresoPersona();
    return;
  }
  const ya = persona === elegido;
  if (!ya && !sesionPerfil(elegido)) {
    const ok = await pedirContraseña(elegido);
    if (!ok) {
      selectPersona.value = persona || "";
      return;
    }
  }
  persona = elegido;
  llenarCampos();
  mensaje(estadoGuardado, `Escribiendo como ${persona}. Se guarda solo en este navegador.`);
  renderResumen();
  renderProgresoPersona();
});

// ---------- Contraseña por perfil ----------
// Al elegir un nombre hay que introducir su contraseña personal.
// La contraseña se comprueba en el receptor privado de Google.

async function pedirContraseña(perfil) {
  return new Promise((resolver) => {
    let resuelto = false;
    const terminar = (ok) => {
      if (!resuelto) {
        resuelto = true;
        resolver(ok);
      }
    };
    const d = document.createElement("dialog");
    d.className = "dialog";
    d.innerHTML =
      "<h3>Perfil: " + perfil + "</h3>" +
      "<p>Introduce la contraseña que te hemos dado para escribir como este perfil.</p>" +
      '<form method="dialog">' +
      '<label class="campo__etiqueta" for="contrasena-perfil">Contraseña</label>' +
      '<input id="contrasena-perfil" type="password" class="campo-input" autocomplete="off" required> ' +
      '<p class="estado" role="status"></p>' +
      '<button type="button" class="btn btn--secundario">Cancelar</button>' +
      '<button type="submit" class="btn btn--primario">Desbloquear</button>' +
      "</form>";
    document.body.appendChild(d);
    d.showModal();
    const form = d.querySelector("form");
    const pw = d.querySelector("#contrasena-perfil");
    const err = d.querySelector(".estado");
    d.querySelector('button[type="button"]').addEventListener("click", () => d.close());
    pw.focus();
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const ok = await verificarContraseña(perfil, pw.value);
        if (ok) {
          credenciales.set(perfil, pw.value);
          anadirSesionPerfil(perfil);
          d.close(); // dispara "close" → terminar(false), pero ya habrá terminado
          terminar(true);
        } else {
          err.textContent = "Contraseña incorrecta. Prueba de nuevo.";
        }
      } catch {
        err.textContent = "No se pudo comprobar la contraseña.";
      }
    });
    d.addEventListener("close", () => {
      d.remove();
      terminar(false); // si aún no había terminado (cancelado)
    });
  });
}

// ---------- Categorías ----------
function llenarCampos() {
  listaCampos.innerHTML = "";
  for (const cat of CATEGORIAS) {
    const r = normalizarRespuesta(todas[persona][cat.id]);
    const div = document.createElement("div");
    div.className = "campo revelar visible";
    div.id = "campo-" + cat.id;
    const h3 = document.createElement("h3");
    h3.className = "campo__titulo";
    h3.textContent = cat.nombre;
    const label = document.createElement("label");
    label.className = "campo__etiqueta";
    label.htmlFor = "nominado-" + cat.id;
    label.textContent = "¿A quién eliges para esta categoría?";
    const select = document.createElement("select");
    select.id = label.htmlFor;
    select.className = "campo-input";
    select.appendChild(new Option("Elige una persona…", ""));
    for (const p of PERSONAS) select.appendChild(new Option(p, p));
    select.value = r.nominado;
    const motivoLabel = document.createElement("label");
    motivoLabel.className = "campo__etiqueta";
    motivoLabel.htmlFor = "input-" + cat.id;
    motivoLabel.textContent = "¿Por qué? Cuéntanos el motivo o el momento";
    const ta = document.createElement("textarea");
    ta.id = motivoLabel.htmlFor;
    ta.className = "campo__input";
    ta.rows = 3;
    ta.maxLength = 2000;
    ta.placeholder = "Lo elijo porque… / Me acuerdo de cuando…";
    ta.value = r.motivo;
    const counter = document.createElement("span");
    counter.className = "campo__contador";
    counter.textContent = contarPalabras(ta.value);
    const guardar = () => {
      todas[persona][cat.id] = { nominado: select.value, motivo: ta.value };
      counter.textContent = contarPalabras(ta.value);
      agendarGuardado();
      renderResumen();
      renderProgresoPersona();
    };
    select.addEventListener("change", guardar);
    ta.addEventListener("input", guardar);
    div.append(h3, label, select, motivoLabel, ta, counter);
    listaCampos.appendChild(div);
  }
}

let tGuarda = null;
function agendarGuardado() {
  clearTimeout(tGuarda);
  tGuarda = setTimeout(() => {
    const ok = guardarTodo();
    // Actualiza el select sin perder el foco en el textarea:
    // solo cambia el texto de las opciones.
    for (const opt of selectPersona.options) {
      if (opt.value === "") continue;
      const n = contarRespuestas(opt.value);
      opt.textContent = n > 0 ? `${opt.value}  (ya lleva ${n} de ${NUM_CATEGORIAS})` : opt.value;
    }
    mensaje(estadoGuardado, ok ? "Guardado." : "Ojo: no se ha podido guardar en este navegador.");
  }, 600);
}

function deshabilitarCampos() {
  listaCampos.innerHTML =
    '<p class="nota-vacia">Elige tu nombre arriba para comenzar.</p>';
}

// ---------- Resumen ----------
function renderResumen() {
  resumenTexto.textContent = persona
    ? persona + ": " + contarRespuestas(persona) + " de " + NUM_CATEGORIAS + " categorías completas. Puedes saltarte categorías dejando los dos campos vacíos."
    : "Elige tu perfil para empezar el cuestionario.";
  const listado = document.getElementById("resumen-elecciones");
  listado.replaceChildren();
  if (!persona) return;
  for (const c of CATEGORIAS) {
    const r = normalizarRespuesta(todas[persona][c.id]);
    if (!r.nominado && !r.motivo.trim()) continue;
    const item = document.createElement("li");
    const titulo = document.createElement("strong");
    titulo.textContent = c.nombre + " → " + (r.nominado || "Falta elegir persona");
    const motivo = document.createElement("p");
    motivo.textContent = r.motivo || "Falta escribir el motivo.";
    item.append(titulo, motivo);
    listado.appendChild(item);
  }
}

// ---------- Barra de progreso de la persona ----------
const progresoPersona = document.getElementById("progreso-persona");
const progresoBarra = document.getElementById("progreso-barra");
const progresoRelleno = document.getElementById("progreso-relleno");
const progresoTexto = document.getElementById("progreso-texto");

function renderProgresoPersona() {
  if (!persona) {
    progresoPersona.hidden = true;
    return;
  }
  progresoPersona.hidden = false;
  const n = contarRespuestas(persona);
  const pct = Math.round((n / NUM_CATEGORIAS) * 100);
  progresoRelleno.style.width = pct + "%";
  progresoBarra.setAttribute("aria-valuemax", String(NUM_CATEGORIAS));
  progresoBarra.setAttribute("aria-valuenow", String(n));
  progresoTexto.textContent =
    n === NUM_CATEGORIAS
      ? `🏆 ${persona} ha rellenado las ${NUM_CATEGORIAS} categorías. ¡Listo para enviar!`
      : `${persona}: ${n} de ${NUM_CATEGORIAS} categorías (${pct}%)`;
}

// ---------- Enviar el cuestionario de la persona actual ----------
function textoEnvio() {
  return CATEGORIAS.filter(c => respuestaCompleta(normalizarRespuesta(todas[persona][c.id])))
    .map(c => { const r = normalizarRespuesta(todas[persona][c.id]);
      return c.nombre + "\nElegido: " + r.nominado + "\nMotivo: " + r.motivo.trim(); }).join("\n\n");
}

function destinoConfigurado() {
  if (!URL_APPS_SCRIPT) return null;
  const respuestas = {};
  for (const c of CATEGORIAS) respuestas[c.id] = normalizarRespuesta(todas[persona][c.id]);
  return { url: URL_APPS_SCRIPT,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ version: 3, persona, contrasena: credenciales.get(persona), respuestas }) };
}

function validarCuestionario() {
  for (const c of CATEGORIAS) {
    const r = normalizarRespuesta(todas[persona][c.id]);
    if ((r.nominado || r.motivo.trim()) && !respuestaCompleta(r)) {
      mensaje(estadoEnviar, "Completa la persona y el motivo en «" + c.nombre + "», o deja los dos campos vacíos.");
      document.getElementById((r.nominado ? "input-" : "nominado-") + c.id).focus();
      return false;
    }
  }
  if (!contarRespuestas(persona)) {
    mensaje(estadoEnviar, "Completa al menos una categoría antes de enviar.");
    return false;
  }
  return true;
}

btnEnviar.addEventListener("click", async () => {
  if (!persona) { mensaje(estadoEnviar, "Primero elige tu nombre arriba."); return; }
  if (!validarCuestionario()) return;
  if (!credenciales.has(persona)) {
    if (!await pedirContraseña(persona)) return;
  }
  const destino = destinoConfigurado();
  if (!destino) {
    mensaje(estadoEnviar, "El organizador todavía no ha conectado la hoja de respuestas. Tu borrador está guardado aquí.");
    guardarTodo();
    return;
  }
  const textoOriginal = btnEnviar.textContent;
  btnEnviar.disabled = true;
  btnEnviar.textContent = "✉️ Enviando…";
  try {
    const res = await fetch(destino.url, { method: "POST", headers: destino.headers, body: destino.body });
    if (!res.ok) throw new Error("Error de conexión.");
    const resultado = await res.json();
    if (resultado.ok !== true) throw new Error(resultado.error || "La hoja no ha confirmado el guardado.");
    guardarTodo();
    mensaje(estadoEnviar, "📨 Respuestas guardadas en la hoja. Puedes corregirlas y volver a enviar; se actualizarán sin duplicarse.");
  } catch (e) {
    guardarTodo();
    mensaje(estadoEnviar, "No se ha confirmado el envío. Tu borrador sigue aquí. " + e.message);
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = textoOriginal;
  }
});

// ---------- Borrar ----------
btnBorrar.addEventListener("click", () => {
  const d = document.createElement("dialog");
  d.className = "dialog";
  d.innerHTML =
    "<h3>¿Qué quieres borrar?</h3>" +
    "<p>Se borra lo escrito en este navegador (no afecta a otras máquinas).</p>" +
    '<form method="dialog">' +
    `<button class="btn btn--secundario" value="mia">Borrar los de ${persona || "nadie"}</button> ` +
    '<button class="btn btn--peligro" value="todo">Borrar TODO</button> ' +
    '<button class="btn btn--secundario" value="cancelar">Cancelar</button>' +
    "</form>";
  document.body.appendChild(d);
  d.showModal();
  d.addEventListener("close", () => {
    const v = d.returnValue;
    if (v === "todo") {
      for (const p of PERSONAS) todas[p] = {};
      guardarTodo();
      if (persona) {
        persona = null;
        selectPersona.value = "";
      }
      deshabilitarCampos();
      llenarSelectPersona();
      renderResumen();
      renderProgresoPersona();
      mensaje(estadoEnviar, "Todo borrado.");
    } else if (v === "mia" && persona) {
      todas[persona] = {};
      guardarTodo();
      llenarCampos();
      llenarSelectPersona();
      renderResumen();
      renderProgresoPersona();
      mensaje(estadoEnviar, `Momentos de ${persona} borrados.`);
    }
  });
});

// ---------- Menú móvil ----------
navToggle.addEventListener("click", () => {
  const abierto = nav.classList.toggle("nav--aberto");
  navToggle.setAttribute("aria-expanded", String(abierto));
});
nav.querySelectorAll(".nav__links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("nav--aberto");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

// ============================================================
// Visual puro (no toca los datos):
// estrellas, luz de escenario, ripple, progreso de scroll,
// aparición al scroll, sombra del nav.
// ============================================================

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- Estrellas de fondo ---
(function crearEstrellas() {
  const cont = document.getElementById("estrellas");
  if (reduceMotion || !cont) return;
  const N = 34;
  for (let i = 0; i < N; i++) {
    const s = document.createElement("span");
    const size = 1 + Math.random() * 2.5;
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.animationDelay = (Math.random() * 5).toFixed(2) + "s";
    s.style.animationDuration = (3.5 + Math.random() * 4).toFixed(2) + "s";
    cont.appendChild(s);
  }
})();

// --- Onda (ripple) al pulsar botones ---
document.addEventListener("pointerdown", (ev) => {
  if (reduceMotion) return;
  const btn = ev.target.closest("button.btn");
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const ola = document.createElement("span");
  ola.className = "ola";
  const tam = Math.max(r.width, r.height);
  ola.style.width = tam + "px";
  ola.style.height = tam + "px";
  ola.style.left = (ev.clientX - r.left - tam / 2) + "px";
  ola.style.top = (ev.clientY - r.top - tam / 2) + "px";
  btn.appendChild(ola);
  ola.addEventListener("animationend", () => ola.remove());
});

// --- Barra de progreso de scroll + sombra del nav ---
const barraScroll = document.getElementById("progreso-scroll");
(function progresoScroll() {
  const actualizar = () => {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    const frac = total > 0 ? h.scrollTop / total : 0;
    barraScroll.style.transform = `scaleX(${frac})`;
    nav.classList.toggle("nav--sombra", h.scrollTop > 8);
  };
  barraScroll.style.transform = "scaleX(0)";
  window.addEventListener("scroll", actualizar, { passive: true });
  window.addEventListener("resize", actualizar);
  actualizar();
})();

// --- Aparición al hacer scroll ---
(function revelarAlScroll() {
  const objetivos = document.querySelectorAll(
    ".seccion .tarjeta, .seccion .campo, .seccion .seccion__titulo, .seccion .eyebrow, .seccion__intro, .resumen__texto"
  );
  if (reduceMotion || !("IntersectionObserver" in window) || objetivos.length === 0) {
    objetivos.forEach((el) => el.classList.add("visible"));
    return;
  }
  // Se marcan para que el CSS sepa qué animar (las .campo ya llevan la clase).
  objetivos.forEach((el) => {
    if (!el.classList.contains("campo")) el.classList.add("revelar");
  });
  const obs = new IntersectionObserver(
    (entradas) => {
      for (const ent of entradas) {
        if (ent.isIntersecting) {
          ent.target.classList.add("visible");
          obs.unobserve(ent.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  objetivos.forEach((el) => obs.observe(el));
})();

// ---------- Inicio ----------
document.getElementById("anio").textContent = new Date().getFullYear();
llenarSelectPersona();
deshabilitarCampos();
renderResumen();
renderProgresoPersona();
