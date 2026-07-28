// ============================================================================
// main.js — lógica de la confirmación de asistencia
// ============================================================================
(() => {
  'use strict';

  // ---- Estado --------------------------------------------------------
  let grupos = [];
  let indiceBusqueda = [];
  let grupoActual = null;
  let decisionPendiente = null;

  const LLAVE_BLOQUEO = 'rsvp_boda_confirmado_v1';

  // ---- Referencias del DOM -------------------------------------------
  const inputBusqueda = document.getElementById('buscarNombre');
  const listaSugerencias = document.getElementById('listaSugerencias');
  const ayudaBusqueda = document.getElementById('ayudaBusqueda');
  const errorBusqueda = document.getElementById('errorBusqueda');

  const tarjetaBuscador = document.getElementById('tarjetaBuscador');
  const tarjetaFormulario = document.getElementById('tarjetaFormulario');
  const tarjetaMensaje = document.getElementById('tarjetaMensaje');

  const nombreGrupoEl = document.getElementById('nombreGrupo');
  const contadorPersonasEl = document.getElementById('contadorPersonas');
  const listaPersonasEl = document.getElementById('listaPersonas');
  const btnCambiarBusqueda = document.getElementById('btnCambiarBusqueda');

  const tituloMensajeEl = document.getElementById('tituloMensaje');
  const textoMensajeEl = document.getElementById('textoMensaje');

  const modal = document.getElementById('modalConfirmar');
  const modalTitulo = document.getElementById('modalTitulo');
  const modalError = document.getElementById('modalError');
  const btnCancelarModal = document.getElementById('btnCancelarModal');
  const btnConfirmarModal = document.getElementById('btnConfirmarModal');

  // ---- Utilidades ------------------------------------------------------
  function normalizar(texto) {
    return (texto || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function esAcompanante(nombre) {
    const marcador = (window.CONFIG && CONFIG.ACOMPANANTE_PLACEHOLDER) || 'acompanante';
    return normalizar(nombre) === normalizar(marcador);
  }

  function obtenerBloqueoLocal() {
    try { return JSON.parse(localStorage.getItem(LLAVE_BLOQUEO) || '{}'); }
    catch { return {}; }
  }
  function guardarBloqueoLocal(grupo, decision) {
    const bloqueo = obtenerBloqueoLocal();
    bloqueo[grupo] = decision;
    localStorage.setItem(LLAVE_BLOQUEO, JSON.stringify(bloqueo));
  }

  // ---- Carga de invitados desde Supabase ---------------------------------
  async function cargarInvitados() {
    const url = (window.CONFIG && CONFIG.SUPABASE_URL) || '';
    const key = (window.CONFIG && CONFIG.SUPABASE_ANON_KEY) || '';
    if (!url || url.includes('PEGA_AQUI') || !key || key.includes('PEGA_AQUI')) {
      console.error('Falta configurar SUPABASE_URL / SUPABASE_ANON_KEY en config.js');
      return [];
    }
    try {
      const res = await fetch(`${url}/rest/v1/grupos?select=grupo,miembros,estado,decision`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error('Respuesta no OK');
      return await res.json();
    } catch (err) {
      console.error('No se pudo cargar la lista de invitados:', err);
      errorBusqueda.textContent = 'No pudimos cargar la lista de invitados. Intenta de nuevo más tarde.';
      errorBusqueda.hidden = false;
      return [];
    }
  }

  // ---- Índice de búsqueda ------------------------------------------------
  function construirIndice(listaGrupos) {
    const indice = [];
    listaGrupos.forEach(grupo => {
      (grupo.miembros || []).forEach(nombre => {
        if (esAcompanante(nombre)) return;
        indice.push({ nombre, grupo: grupo.grupo, datos: grupo });
      });
    });
    return indice;
  }

  function renderizarSugerencias(coincidencias) {
    listaSugerencias.innerHTML = '';
    if (!coincidencias.length) {
      listaSugerencias.hidden = true;
      return;
    }
    coincidencias.slice(0, 8).forEach(item => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `${item.nombre}<small>${item.grupo}</small>`;
      btn.addEventListener('click', () => seleccionarGrupo(item.datos));
      li.appendChild(btn);
      listaSugerencias.appendChild(li);
    });
    listaSugerencias.hidden = false;
  }

  inputBusqueda.addEventListener('input', () => {
    const consulta = normalizar(inputBusqueda.value);
    errorBusqueda.hidden = true;

    if (consulta.length < 2) {
      renderizarSugerencias([]);
      ayudaBusqueda.hidden = false;
      return;
    }
    ayudaBusqueda.hidden = true;

    const coincidencias = indiceBusqueda.filter(item => normalizar(item.nombre).includes(consulta));
    renderizarSugerencias(coincidencias);

    if (!coincidencias.length) {
      errorBusqueda.hidden = false;
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.rsvp-buscador')) renderizarSugerencias([]);
  });

  // ---- Agrupar titulares con sus cupos de acompañante --------------------
  function armarTitulares(miembros) {
    const titulares = [];
    miembros.forEach(nombre => {
      if (esAcompanante(nombre)) {
        const ultimo = titulares[titulares.length - 1];
        if (ultimo) ultimo.acompanantes.push(nombre);
        else titulares.push({ nombre: 'Invitado', acompanantes: [nombre] });
        return;
      }
      titulares.push({ nombre, acompanantes: [] });
    });
    return titulares;
  }

  function contarPersonas(titulares) {
    return titulares.reduce((total, t) => total + 1 + t.acompanantes.length, 0);
  }

  // ---- Seleccionar un grupo desde la búsqueda -----------------------------
  function seleccionarGrupo(datosGrupo) {
    grupoActual = datosGrupo;
    renderizarSugerencias([]);
    inputBusqueda.value = '';

    const bloqueo = obtenerBloqueoLocal();
    const yaRespondio = datosGrupo.estado === 'respondido' || bloqueo[datosGrupo.grupo];
    if (yaRespondio) {
      mostrarMensajeFinal(datosGrupo.decision || bloqueo[datosGrupo.grupo]);
      return;
    }

    tarjetaBuscador.hidden = true;
    tarjetaMensaje.hidden = true;
    tarjetaFormulario.hidden = false;

    nombreGrupoEl.textContent = datosGrupo.grupo;

    const titulares = armarTitulares(datosGrupo.miembros);
    const total = contarPersonas(titulares);
    contadorPersonasEl.innerHTML = `<strong>${total}</strong> ${total === 1 ? 'persona en este grupo' : 'personas en este grupo'}`;

    listaPersonasEl.innerHTML = '';
    titulares.forEach((titular, idx) => {
      listaPersonasEl.appendChild(crearTarjetaPersona(titular, idx));
    });

    tarjetaFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  btnCambiarBusqueda.addEventListener('click', () => {
    tarjetaFormulario.hidden = true;
    tarjetaBuscador.hidden = false;
    inputBusqueda.focus();
  });

  // ---- Construir la tarjeta de un titular (+ sus acompañantes) -----------
  function crearTarjetaPersona(titular, idx) {
    const sabores = (window.CONFIG && CONFIG.ICE_CREAM_FLAVORS) || [];
    const opcionesSabor = sabores.map(s => `<option value="${s}">${s}</option>`).join('');

    const li = document.createElement('li');
    li.className = 'rsvp-persona';
    li.dataset.idx = idx;

    li.innerHTML = `
      <p class="rsvp-persona-nombre">
        <input type="text" class="rsvp-input" data-campo="nombre" value="${titular.nombre}" aria-label="Nombre del invitado" />
      </p>
      <div class="rsvp-grid" data-rol="titular">
        <div>
          <label class="rsvp-label">Celular</label>
          <input type="tel" inputmode="tel" class="rsvp-input" data-campo="celular" placeholder="300 000 0000" />
        </div>
        <div>
          <label class="rsvp-label">Correo electrónico</label>
          <input type="email" class="rsvp-input" data-campo="correo" placeholder="nombre@correo.com" />
        </div>
        <div class="rsvp-campo-ancho">
          <label class="rsvp-label">Sabor de helado</label>
          <select class="rsvp-input" data-campo="sabor">
            <option value="" disabled selected>Elige un sabor</option>
            ${opcionesSabor}
          </select>
        </div>
      </div>
    `;

    titular.acompanantes.forEach((_, idxAcomp) => {
      li.appendChild(crearBloqueAcompanante(idxAcomp, opcionesSabor));
    });

    return li;
  }

  function crearBloqueAcompanante(idx, opcionesSabor) {
    const bloque = document.createElement('div');
    bloque.className = 'rsvp-acompanante-inline';
    bloque.dataset.acompananteIdx = idx;
    bloque.innerHTML = `
      <div data-rol="acompanante">
        <label class="rsvp-label">Nombre del acompañante</label>
        <input type="text" class="rsvp-input" data-campo="nombre" placeholder="Nombre completo" />
      </div>
      <div class="rsvp-campo-ancho" data-rol="acompanante">
        <label class="rsvp-label">Sabor de helado</label>
        <select class="rsvp-input" data-campo="sabor">
          <option value="" disabled selected>Elige un sabor</option>
          ${opcionesSabor}
        </select>
      </div>
    `;
    return bloque;
  }

  // ---- Recolectar y validar los datos del formulario ----------------------
  function recolectarPersonas() {
    const resultado = [];
    listaPersonasEl.querySelectorAll('.rsvp-persona').forEach(li => {
      const camposTitular = li.querySelector('[data-rol="titular"]');
      resultado.push({
        tipo: 'titular',
        nombre: li.querySelector('[data-campo="nombre"]').value.trim(),
        celular: camposTitular.querySelector('[data-campo="celular"]').value.trim(),
        correo: camposTitular.querySelector('[data-campo="correo"]').value.trim(),
        sabor: camposTitular.querySelector('[data-campo="sabor"]').value,
      });
      li.querySelectorAll('.rsvp-acompanante-inline').forEach(bloque => {
        resultado.push({
          tipo: 'acompanante',
          nombre: bloque.querySelector('[data-campo="nombre"]').value.trim(),
          celular: '',
          correo: '',
          sabor: bloque.querySelector('[data-campo="sabor"]').value,
        });
      });
    });
    return resultado;
  }

  function validarFormulario() {
    let valido = true;
    listaPersonasEl.querySelectorAll('.rsvp-persona').forEach(li => {
      const camposTitular = li.querySelector('[data-rol="titular"]');
      if (!camposTitular.querySelector('[data-campo="celular"]').value.trim()) valido = false;
      const correo = camposTitular.querySelector('[data-campo="correo"]').value.trim();
      if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) valido = false;
      if (!camposTitular.querySelector('[data-campo="sabor"]').value) valido = false;

      li.querySelectorAll('.rsvp-acompanante-inline').forEach(bloque => {
        if (!bloque.querySelector('[data-campo="nombre"]').value.trim()) valido = false;
        if (!bloque.querySelector('[data-campo="sabor"]').value) valido = false;
      });
    });
    return valido;
  }

  // ---- Botones Sí / No → abren el modal -----------------------------------
  document.querySelectorAll('[data-decision]').forEach(btn => {
    btn.addEventListener('click', () => {
      const decision = btn.dataset.decision;
      if (decision === 'si' && !validarFormulario()) {
        alert('Revisa que todos los campos estén completos antes de continuar.');
        return;
      }
      decisionPendiente = decision;
      abrirModal(decision);
    });
  });

  function abrirModal(decision) {
    modalTitulo.textContent = decision === 'si'
      ? '¿Confirmas que sí asistirán a la boda?'
      : '¿Confirmas que no podrán asistir a la boda?';
    modalError.hidden = true;
    modal.hidden = false;
  }
  function cerrarModal() {
    modal.hidden = true;
  }
  btnCancelarModal.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) cerrarModal(); });

  btnConfirmarModal.addEventListener('click', async () => {
    btnConfirmarModal.disabled = true;
    btnConfirmarModal.textContent = 'Enviando...';
    try {
      await enviarConfirmacion(decisionPendiente);
      guardarBloqueoLocal(grupoActual.grupo, decisionPendiente);
      cerrarModal();
      mostrarMensajeFinal(decisionPendiente);
    } catch (err) {
      console.error(err);
      if (err && err.codigo === 'YA_REGISTRADO') {
        cerrarModal();
        mostrarMensajeFinal(decisionPendiente);
      } else {
        modalError.textContent = 'No pudimos enviar tu confirmación. Intenta de nuevo.';
        modalError.hidden = false;
      }
    } finally {
      btnConfirmarModal.disabled = false;
      btnConfirmarModal.textContent = 'Sí, confirmar';
    }
  });

  async function enviarConfirmacion(decision) {
    const url = (window.CONFIG && CONFIG.SUPABASE_URL) || '';
    const key = (window.CONFIG && CONFIG.SUPABASE_ANON_KEY) || '';
    const grupo = grupoActual.grupo;

    const miembros = decision === 'si'
      ? recolectarPersonas()
      : armarTitulares(grupoActual.miembros).flatMap(t => {
          const lista = [{ tipo: 'titular', nombre: t.nombre, celular: '', correo: '', sabor: '' }];
          t.acompanantes.forEach(() => lista.push({ tipo: 'acompanante', nombre: '', celular: '', correo: '', sabor: '' }));
          return lista;
        });

    if (!url || url.includes('PEGA_AQUI') || !key || key.includes('PEGA_AQUI')) {
      console.warn('Supabase no configurado. Simulando envío:', { grupo, decision, miembros });
      return;
    }

    const encabezados = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    // 1) Marca el grupo como respondido. La política de la tabla solo permite
    //    este update si el grupo seguía en estado "pendiente" — si alguien ya
    //    había respondido, esto actualiza 0 filas (bloqueo real del lado del servidor).
    const resUpdate = await fetch(`${url}/rest/v1/grupos?grupo=eq.${encodeURIComponent(grupo)}`, {
      method: 'PATCH',
      headers: { ...encabezados, Prefer: 'return=representation' },
      body: JSON.stringify({ estado: 'respondido', decision }),
    });
    if (!resUpdate.ok) throw new Error('No se pudo actualizar el grupo');
    const filasActualizadas = await resUpdate.json();
    if (!filasActualizadas.length) {
      const error = new Error('YA_REGISTRADO');
      error.codigo = 'YA_REGISTRADO';
      throw error;
    }

    // 2) Guarda el detalle de cada persona del grupo.
    const filas = miembros.map(m => ({ grupo, decision, ...m }));
    const resInsert = await fetch(`${url}/rest/v1/respuestas`, {
      method: 'POST',
      headers: encabezados,
      body: JSON.stringify(filas),
    });
    if (!resInsert.ok) throw new Error('No se pudo guardar el detalle de la respuesta');
  }

  function mostrarMensajeFinal(decision) {
    tarjetaBuscador.hidden = true;
    tarjetaFormulario.hidden = true;
    tarjetaMensaje.hidden = false;
    if (decision === 'si') {
      tituloMensajeEl.textContent = '¡Nos vemos en la boda!';
      textoMensajeEl.textContent = 'Gracias por confirmar tu asistencia. Cualquier detalle adicional te lo compartiremos pronto.';
    } else {
      tituloMensajeEl.textContent = 'Te extrañaremos';
      textoMensajeEl.textContent = 'Gracias por avisarnos. Un abrazo enorme y esperamos verte pronto en otra ocasión.';
    }
    tarjetaMensaje.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Inicio --------------------------------------------------------------
  (async function iniciar() {
    grupos = await cargarInvitados();
    indiceBusqueda = construirIndice(grupos);
  })();

})();
