(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const nav = document.querySelector('[data-nav]');
  const year = document.querySelector('[data-year]');
  const toast = document.querySelector('[data-toast]');
  const copyEmailButton = document.querySelector('[data-copy-email]');

  if (year) year.textContent = new Date().getFullYear();

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Abrir navegación');
    nav?.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  };

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Abrir navegación' : 'Cerrar navegación');
    nav?.classList.toggle('is-open', !open);
    document.body.classList.toggle('nav-open', !open);
  });

  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const demoData = {
    local: {
      path: 'Planificación · 4° medio',
      status: 'Modo local',
      scope: 'Pterón no puede acceder fuera de esta carpeta.',
      title: 'Secuencia didáctica: funciones exponenciales',
      heading: 'Objetivo de la clase',
      copy: 'Modelar situaciones de crecimiento y decrecimiento mediante funciones exponenciales, justificando las decisiones tomadas a partir de distintas representaciones.',
      suggestion: 'Incorporar una comparación entre representación tabular y gráfica antes de formalizar el modelo.',
      label: 'Permisos',
      count: '1 carpeta',
      inspector: `
        <div class="permission-visual">
          <div class="folder-icon-large"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3z"/></svg></div>
          <strong>Acceso acotado</strong>
          <p>Pterón ve únicamente la carpeta elegida para esta sesión.</p>
        </div>
        <div class="boundary-list">
          <span><i>✓</i> Leer documentos autorizados</span>
          <span><i>✓</i> Crear copias de trabajo</span>
          <span><i>—</i> Sobrescribir originales</span>
          <span><i>—</i> Enviar datos sin permiso</span>
        </div>`
    },
    evidence: {
      path: 'Fuentes · inspección',
      status: 'Evidencia visible',
      scope: 'Las fuentes permanecen dentro del proyecto activo.',
      title: 'Secuencia didáctica: funciones exponenciales',
      heading: 'Propuesta vinculada a evidencia',
      copy: 'La sugerencia se relaciona con el objetivo curricular y con dos ejemplos presentes en los materiales autorizados.',
      suggestion: 'Comparar representaciones antes de formalizar el modelo para hacer visible la variación entre términos.',
      label: 'Fuentes',
      count: '3 vínculos',
      inspector: `
        <div class="permission-visual">
          <div class="folder-icon-large"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/><path d="m7 10 2 2 4-5"/></svg></div>
          <strong>Propuesta verificable</strong>
          <p>Cada relación puede abrirse y revisarse antes de aplicar el cambio.</p>
        </div>
        <div class="boundary-list">
          <span><i>1</i> Bases curriculares · OA 3</span>
          <span><i>2</i> Unidad 2 · actividad 4</span>
          <span><i>3</i> Notas de clase · 18/07</span>
          <span><i>✓</i> Fragmentos disponibles</span>
        </div>`
    },
    privacy: {
      path: 'Revisión · datos sensibles',
      status: 'Proceso detenido',
      scope: 'Ningún dato será procesado hasta que el docente decida.',
      title: 'Lista de curso: revisión preventiva',
      heading: 'Se detectó información identificable',
      copy: 'El archivo contiene nombres, RUT, calificaciones y una referencia a antecedentes NEE/PIE. Pterón detuvo el procesamiento antes de leer el contenido completo.',
      suggestion: 'Anonimizar los identificadores y excluir antecedentes sensibles antes de continuar.',
      label: 'Protección',
      count: '4 alertas',
      inspector: `
        <div class="permission-visual" style="border-color:#ddb7b2;background:#fff8f7">
          <div class="folder-icon-large" style="background:#f4e8e6;color:#a54c46"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 15H4z"/><path d="M12 9v4"/><circle cx="12" cy="16" r=".7"/></svg></div>
          <strong>Acción requerida</strong>
          <p>Elige cómo tratar los datos antes de que el flujo continúe.</p>
        </div>
        <div class="boundary-list">
          <span><i>!</i> 32 nombres completos</span>
          <span><i>!</i> 32 RUT</span>
          <span><i>!</i> Calificaciones</span>
          <span><i>!</i> Antecedentes NEE/PIE</span>
        </div>`
    },
    export: {
      path: 'Artefacto · exportación',
      status: 'Copia de trabajo',
      scope: 'El original permanece intacto durante la exportación.',
      title: 'Secuencia didáctica: versión revisada',
      heading: 'Documento listo para revisión final',
      copy: 'La estructura fue ajustada en una copia de trabajo. Puedes aceptar, editar o descartar cada cambio antes de generar el archivo.',
      suggestion: 'Exportar como DOCX conservando títulos, tablas, referencias y notas de trazabilidad.',
      label: 'Exportar',
      count: '3 formatos',
      inspector: `
        <div class="permission-visual">
          <div class="folder-icon-large"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5"/><path d="M12 11v6M9 14l3 3 3-3"/></svg></div>
          <strong>Artefacto editable</strong>
          <p>Elige un formato y revisa el destino antes de generar la copia.</p>
        </div>
        <div class="boundary-list">
          <span><i>W</i> Documento DOCX</span>
          <span><i>P</i> Documento PDF</span>
          <span><i>M</i> Markdown</span>
          <span><i>✓</i> Original sin cambios</span>
        </div>`
    }
  };

  const fields = {
    path: document.querySelector('[data-demo-path]'),
    status: document.querySelector('[data-demo-status]'),
    scope: document.querySelector('[data-demo-scope]'),
    title: document.querySelector('[data-demo-title]'),
    heading: document.querySelector('[data-demo-heading]'),
    copy: document.querySelector('[data-demo-copy]'),
    suggestion: document.querySelector('[data-suggestion-copy]'),
    label: document.querySelector('[data-inspector-label]'),
    count: document.querySelector('[data-inspector-count]'),
    inspector: document.querySelector('[data-inspector-content]')
  };

  document.querySelectorAll('[data-demo-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.demoTab;
      const data = demoData[key];
      if (!data) return;

      document.querySelectorAll('[data-demo-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
      Object.entries(fields).forEach(([field, element]) => {
        if (!element) return;
        if (field === 'inspector') element.innerHTML = data.inspector;
        else element.textContent = data[field];
      });
      showToast({
        local: 'Alcance local visible.',
        evidence: 'Fuentes abiertas para inspección.',
        privacy: 'Procesamiento detenido preventivamente.',
        export: 'Opciones de exportación preparadas.'
      }[key]);
    });
  });

  document.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
    const suggestion = document.querySelector('[data-demo-suggestion]');
    suggestion?.classList.add('is-applied');
    showToast('Cambio aplicado en una copia de trabajo.');
  });

  document.querySelector('[data-action="inspect"]')?.addEventListener('click', () => {
    document.querySelector('[data-demo-tab="evidence"]')?.click();
  });

  copyEmailButton?.addEventListener('click', async () => {
    const address = 'pteron@patagua.dev';
    try {
      await navigator.clipboard.writeText(address);
      const label = copyEmailButton.querySelector('span');
      const original = label.textContent;
      label.textContent = 'Correo copiado';
      window.setTimeout(() => { label.textContent = original; }, 1800);
    } catch {
      window.location.href = `mailto:${address}`;
    }
  });

  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  }
})();
