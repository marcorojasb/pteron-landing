# Contrato de desarrollo de Pteron Landing

Estado: activo. Este repositorio contiene la web pública de **Pteron**.

## Alcance y autoridad

`pteron-landing` es un proyecto independiente del ecosistema Patagua. Su raíz
canónica es:

```text
/Users/marcorojasbelmar/Developer/pteron-landing
```

No pertenece a `/Users/marcorojasbelmar/Developer/patagua`, no se registra en
`00-control-plane/patagua.dev/registry/projects.md` y los estados operativos de
Patagua (`paused`, `reactivated`, `deploy-signaled`, etc.) no gobiernan este
repositorio.

La landing forma parte del producto Pteron y debe conservar la doctrina de
producto definida en:

```text
/Users/marcorojasbelmar/Developer/pteron/AGENTS.md
```

Este archivo es el contrato operativo local de mayor proximidad para la landing.
Si existe una contradicción, detente y solicita aclaración antes de actuar.

## Autorización para trabajo local

Una petición del usuario para diseñar, implementar, corregir, auditar o verificar
la landing autoriza el trabajo local necesario dentro de este repositorio. Esto
incluye inspeccionar y editar archivos, iniciar el servidor local, usar el
navegador, capturar pantallas y ejecutar comprobaciones proporcionales al cambio.
No se requiere una reactivación ni una aprobación de fase de Patagua.

Esta autorización no incluye:

- instalar o actualizar dependencias;
- abrir `.env*`, credenciales, volcados o datos privados;
- usar servicios externos, proveedores o bases de datos;
- desplegar o modificar Vercel, DNS o dominios;
- hacer commit, push, merge, reset o reescribir historial;
- borrar fuente o realizar otras operaciones destructivas.

Cada una de esas acciones requiere autorización específica.

## Antes de actuar

1. Lee este archivo completo y, cuando la tarea afecte promesas o identidad de
   producto, consulta el contrato de Pteron indicado arriba.
2. Revisa `git status --short` y preserva cambios y archivos ajenos.
3. Trabaja sobre el estado actual de la landing; no copies interfaz desde
   `/Users/marcorojasbelmar/Developer/pteron/old`.
4. Para cambios visuales, comprueba al menos escritorio y móvil con capturas
   reales antes de cerrar el trabajo.
5. Para animaciones o video, verifica también los estados de carga, reproducción,
   desplazamiento, movimiento reducido y fallo del recurso.

## Doctrina visual y de contenido

- Pteron está construido por profesores, para profesores.
- Debe transmitir seguridad, conocimiento y oficio, sin grandilocuencia.
- El profesor mantiene siempre su criterio.
- La interfaz y el discurso deben ser sobrios, concretos y breves.
- Una sección tiene una idea dominante y una acción clara.
- No prometer capacidades que el producto actual no pueda demostrar.
- Respetar accesibilidad, legibilidad y `prefers-reduced-motion`.
- No aceptar recortes accidentales, espacios vacíos inexplicables, saltos de
  layout, pantallas negras ni recursos que nunca terminan de cargar.

## Calidad

- Los cambios deben verificarse de forma proporcional al riesgo.
- Una captura aislada no basta para validar una animación: revisa su inicio,
  estados intermedios y final.
- Conserva los artefactos de verificación fuera del producto publicado.
- No declares terminado un ajuste visual sin inspeccionar el resultado renderizado.
