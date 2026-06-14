# Registro de paridad de accesibilidad — Web vs Móvil

Este documento mantiene sincronizado el estado de conformidad WCAG 2.1 AA entre el panel web
(`apps/web-panel/src/pages/AccessibilityPage.tsx`) y la app móvil
(`apps/mobile/app/more/accessibility.tsx`), para que ambas declaraciones digan lo mismo sobre lo mismo.

**Última actualización del registro:** 2026-06-14

## Estado general

| Lado | Estado declarado | Última revisión declarada |
|------|-------------------|----------------------------|
| Web (`AccessibilityPage.tsx`) | ✅ Conforme con WCAG 2.1 AA | 2026-06-14 |
| Móvil (`app/more/accessibility.tsx`) | ✅ Conforme con WCAG 2.1 AA | 2026-06-14 |

## Criterios revisados en esta ronda (2026-06-14)

| Criterio | Web | Móvil | Notas |
|----------|-----|-------|-------|
| 1.4.10 — Reajuste (Reflow) | ✅ Conforme — `@media (max-width: 860px)` + `min()`/`calc()` en paneles flotantes | ✅ Conforme — layouts RN basados en flex/porcentajes, sin scroll horizontal en pantallas estrechas | En móvil no se requirió cambio de código, solo reclasificación en la declaración |
| 1.4.11 — Contraste de componentes no textuales (≥ 3:1) | ✅ Conforme — variable CSS `--border-strong` (`#6E7A8A` estándar / `#AAAACC` alto contraste) en `index.css`, aplicada a iconos/controles | ✅ Conforme — color `borderStrong` añadido a `src/theme.ts` (`#6E7A8A` estándar / `#FFFFFF` alto contraste), aplicado como borde 1px en `speakBtn` y `sendBtn` (`app/(tabs)/stoqly.tsx`) y en `CollapsedAdd` (`src/components/ui.tsx`) | Pendiente: revisar si `Pill`/`OptionCard` en `src/components/ui.tsx` necesitan el mismo borde (actualmente usan `t.border`, no `t.borderStrong`) |
| 2.5.3 — Etiqueta en nombre | ✅ Conforme — `aria-label` en grupo de botones de tamaño de texto (`role="group" aria-labelledby="a11y-font-label"`) | ✅ Conforme — `accessibilityRole="button"` + `accessibilityLabel` añadidos a `speakBtn`, `sendBtn` y `CollapsedAdd` | Botones de QUICK_ACTIONS y `Pill`/`OptionCard` ya cumplían (RN deriva el nombre accesible del texto visible) |

## Pendientes de seguimiento

- `apps/mobile/(tabs)/stoqly.tsx` usa el tema `theme` directamente (no `useA11yTheme()`), por lo que `speakBtn`/`sendBtn` no cambian con el modo alto contraste. No bloquea 1.4.11 (el borde estándar ya cumple ≥ 3:1), pero sería ideal unificarlo con el resto de la app que sí usa `useA11yTheme()`.
- Revisar `Pill` y `OptionCard` en `src/components/ui.tsx` para aplicar `borderStrong` si se quiere cobertura más amplia del criterio 1.4.11 (no es obligatorio: son controles con etiqueta de texto, no solo icono).
- Las 4 modificaciones de `apps/web-panel` (`index.css`, `AccessibilityPanel.tsx`, `StoqlyWidget.tsx`, `AccessibilityPage.tsx`) y las 4 de `apps/mobile` (`src/theme.ts`, `app/(tabs)/stoqly.tsx`, `src/components/ui.tsx`, `app/more/accessibility.tsx`) más este registro están pendientes de commit/push.

## Cómo usar este registro

Cada vez que se cambie algo relevante para WCAG 2.1 AA (o 2.2 en el futuro) en web o en móvil:

1. Aplicar el cambio equivalente en el otro lado (código + declaración de accesibilidad).
2. Añadir una fila nueva a la tabla "Criterios revisados" indicando fecha, criterio, estado en cada lado y archivos tocados.
3. Actualizar `LAST_REVIEW` en ambas declaraciones (`AccessibilityPage.tsx` y `app/more/accessibility.tsx`) a la misma fecha.
4. Actualizar la fecha de "Última actualización del registro" arriba.
