// src/app/core/prueba-pte-debug.helper.ts
// Helper de logging uniforme para depurar marcado como "PruebaPte".
export const PP_TAG = 'PruebaPte';

export function ppDebug(label: string, data?: unknown) {
  // Usamos debug para poder filtrar en consola; si algo crítico, cambiar a console.warn
  if (data !== undefined) {
    console.debug(`${PP_TAG} ▶︎ ${label}`, data);
  } else {
    console.debug(`${PP_TAG} ▶︎ ${label}`);
  }
}
