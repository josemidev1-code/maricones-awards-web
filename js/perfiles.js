/* Maricones Awards: la contraseña se verifica únicamente en el servidor. */
"use strict";

async function verificarContraseña(perfil, contrasena) {
  if (!URL_APPS_SCRIPT) throw new Error("La hoja de respuestas todavía no está conectada.");
  const res = await fetch(URL_APPS_SCRIPT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ version: 3, accion: "autenticar", persona: perfil, contrasena })
  });
  if (!res.ok) throw new Error("No se pudo contactar con el servidor.");
  const resultado = await res.json();
  if (resultado.ok !== true && resultado.error !== "Contraseña incorrecta. Vuelve a elegir tu perfil.") {
    throw new Error(resultado.error || "No se pudo verificar la contraseña.");
  }
  return resultado.ok === true && resultado.autenticado === true;
}

// La sesión dura solo mientras esta pestaña esté abierta.
const PERFILS_SESION = new Set();
function sesionPerfil(perfil) { return PERFILS_SESION.has(perfil); }
function anadirSesionPerfil(perfil) { PERFILS_SESION.add(perfil); }
function cerrarSesionPerfil(perfil) { PERFILS_SESION.delete(perfil); }
