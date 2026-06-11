# Stoqly — Hoja de Ruta del Portal Web
> Documento vivo. Leer ANTES de cada sesión.
> Cada ❌ tiene sus dependencias y cómo conecta con el resto.

---

## MODELO DE CATEGORÍAS — El corazón del sistema

Stoqly no es solo una app de despensa de comida.
Es un **gestor de inventario doméstico completo** organizado por categorías activables.
Cada categoría tiene su propia lógica, alertas, zonas y funcionalidades específicas.

### Categorías del sistema

| Categoría | Icono | Qué controla | Alertas específicas | Tier |
|---|---|---|---|---|
| **Alimentación** | 🥫 | Despensa, nevera, congelador | Caducidad, alérgenos, donación | Free |
| **Bodega** | 🍷 | Vinos, cavas, espirituosas | Ventana óptima de consumo, oxidación botellas abiertas, maridaje | Free |
| **Cosméticos** | 🧴 | Cremas, sérum, maquillaje, champú | PAO (Period After Opening), caducidad | Hogar |
| **Medicamentos** | 💊 | Medicamentos, vitaminas, suplementos | Tomas pendientes, stock bajo, SIGRE para caducados | Hogar |
| **Limpieza** | 🧹 | Detergentes, lejía, productos de limpieza | Caducidad, **alerta si hay bebés** (productos peligrosos cerca) | Free |
| **Bebés** | 👶 | Fórmula, papillas, medicamentos pediátricos | Tomas, introducción sólidos, alérgenos, máxima prioridad AESAN | Hogar |

### Cómo funcionan las categorías en el sistema

**En ajustes**: el usuario activa las categorías que usa. Por defecto solo Alimentación.
Al activar Bodega → se crea una zona "Bodega/Vinos" y se habilita el módulo de maridaje.
Al activar Cosméticos → se crea zona "Baño/Belleza" y se habilita PAO.
Al activar Bebés → se habilita el módulo bebés completo con máxima prioridad en alertas.
Al activar Limpieza con bebés activo → Stoqly avisa si un producto de limpieza peligroso está en zona accesible.

**En la despensa**: los filtros de zona incluyen las categorías activas.
**En las alertas**: cada categoría tiene su sección con sus propias alertas.
**En Stoqly**: el system prompt incluye solo las categorías activas del usuario.

### Bodega/Vinos — funcionalidades específicas
- Registro de botella: nombre, bodega, añada, varietal, región, temperatura de conservación
- **Ventana óptima de consumo**: Stoqly calcula cuándo está en su mejor momento y avisa
- **Botella abierta**: alerta cuando supera el tiempo óptimo (blancos/rosados: 3-5 días; tintos: 3-7 días; espumosos: 1-2 días)
- **Maridaje**: "Tengo solomillo esta noche — ¿qué vino de mi bodega me recomiendas?"
- Stoqly tiene conocimiento de maridaje: varietal + plato → sugerencia del vino concreto que tienes
- Integración futura con apps de cata (Vivino, etc.)

### Limpieza + bebés — alerta de seguridad
- Al activar bebés, Stoqly revisa los productos de limpieza registrados
- Si un producto contiene lejía, amoniaco, cloro u otros compuestos peligrosos Y está en una zona accesible → alerta
- Stoqly sugiere: "Mueve la lejía a un armario con cierre de seguridad"
- En el futuro: detectar componentes peligrosos vía código de barras + base de datos de ingredientes

---

## DECISIONES DE DISEÑO — Estado

### D1. Geolocalización ✅ RESUELTA
- Código postal en User. Botón GPS al buscar servicio cercano.

### D2. Alergias por persona ✅ RESUELTA
- `allergens` en User. Stoqly recibe todos los miembros con sus alergias.

### D3. Registro desde el portal ✅ RESUELTA
- Pantalla /registro con onboarding conversacional de 5 pasos.

### D4. Stoqly sabe para quién cocina ✅ RESUELTA
- System prompt incluye miembros del hogar y sus alergias individuales.

### D5. Multi-hogar — PENDIENTE
- Personas con segunda residencia no saben qué tienen en la otra casa.
- Onboarding: "¿Tienes más de una casa?" → crea segundo hogar con nombre propio
- Panel: selector de hogar activo en la cabecera
- Cada hogar tiene su despensa, zonas, lista y supermercado propios
- Stoqly sabe en qué hogar estás
- **Tier Pro** — Free: 1 hogar. Pro: ilimitados.
- Afecta: Schema, Layout, contexto Stoqly

### D6. Editar zonas — PENDIENTE
- Zonas predefinidas no editables. Hay gente con trastero, segunda nevera, armario especial.
- En Ajustes > Mi hogar: añadir, renombrar, cambiar icono, eliminar zonas
- Al eliminar, productos pasan a "Sin zona" (API ya implementada)
- **Tier Free**
- Afecta: Settings, PantryPage, API pantry (CRUD ya existe)

### D7. Módulo bebés y lactantes — PENDIENTE
- Máxima responsabilidad. Un error en alimentación de bebé tiene consecuencias graves.
- Onboarding/ajustes: "¿Hay bebés en casa?" → activa módulo
- Perfil bebé: nombre, fecha nacimiento (calcula semanas/meses), peso
- Control de tomas: pecho (duración) / biberón (ml), alerta próxima toma
- Introducción de sólidos: calendario guiado AEP, 3 días observación por alimento
- Medicamentos pediátricos: dosis por peso, pauta, alerta de toma
- Alerta sanitaria máxima: AESAN retira fórmula → notificación inmediata sin filtro horario
- Botón emergencia alergia → protocolo + 112
- **Tier Hogar**
- Afecta: Schema (model Baby), API /baby, /baby page, Alertas, Stoqly prompt

### D8. Acceso compartido al hogar — PENDIENTE
- Varios miembros de la misma casa deben ver y gestionar la despensa juntos.
- **Flujo actual (parcialmente implementado)**:
  - El owner invita a otro usuario por email desde Ajustes > Personas en casa
  - El invitado necesita tener cuenta Stoqly → si no la tiene, recibe email de invitación
  - Una vez en el hogar, ve la despensa compartida, puede añadir/consumir/descartar
  - Puede añadir productos a la lista de compra compartida
  - Cada uno mantiene sus propias alergias
- **Lo que falta**:
  - Email de invitación al invitado si no tiene cuenta (necesita Resend)
  - El invitado puede unirse al hogar desde el link del email
  - Historial de quién añadió/consumió qué producto (ya está en Movement con `performedBy`)
  - Notificación a los miembros cuando alguien añade algo urgente
- **Tier Free** — hogar compartido básico disponible para todos
- Afecta: Email (Resend), API /auth/join-household, Ajustes, Movimientos

### D9. Alergias personalizadas — PENDIENTE
- La lista predefinida (gluten, lactosa...) no cubre todo. Ej: frutas tropicales, castañas, apio específico.
- **Diseño**:
  - En Ajustes > Tus alergias: además de los chips predefinidos, campo libre para añadir alergia personalizada (texto)
  - Las alergias personalizadas se guardan igual que las predefinidas en el array `allergens` del User
  - Stoqly las trata exactamente igual que las estándar en recetas y alertas
  - Al escanear un producto (futuro), cruzar su lista de ingredientes con las alergias personalizadas
- **Tier Free** — disponible para todos
- Afecta: Settings UI, Stoqly prompt (ya recibe el array completo), escáner futuro

### D10. Modo compra en el supermercado — PENDIENTE
- El usuario en el súper necesita: ver la lista, escanear lo que coge, añadir cosas nuevas, ver el importe.
- **Flujo completo**:
  - Modo "Estoy en el súper": activa cámara para escanear códigos de barras
  - Al escanear un producto: se marca en la lista (si estaba) o se añade como nuevo
  - Importe acumulado en tiempo real (con precios de Open Food Facts o estimados)
  - Al terminar: todos los productos escaneados entran automáticamente en la despensa
  - Umbral de envío gratuito: si el supermercado tiene delivery, mostrar cuánto falta para envío gratis
- **Umbral de envío gratis** por supermercado (configuración en ajustes):
  - Mercadona: gratis desde 50€ (actualizable)
  - Carrefour: gratis desde 30€
  - Personalizable por el usuario
- **Comparativa de precios**: mostrar precio del mismo producto en otro supermercado (requiere API de precios)
  - Primera versión: scraping de Open Food Facts (tiene precios de algunos productos)
  - Versión avanzada: integración con APIs de supermercados (Mercadona tiene API pública informal)
- **Tier Hogar** — modo básico. **Tier Pro** — comparativa precios + delivery automático
- Afecta: ShoppingPage, escáner, API items (añadir desde compra), Layout

### D11. Accesibilidad avanzada — PENDIENTE
- Stoqly debe ser certificable por la ONCE (Organización Nacional de Ciegos Españoles).
- La ONCE da un respaldo social enorme si el producto es verdaderamente accesible.
- **Qué requiere la ONCE**:
  - Compatibilidad total con JAWS (lector de pantalla Windows) y NVDA
  - Compatible con VoiceOver (iOS) y TalkBack (Android)
  - Todos los elementos interactivos con `aria-label` correcto
  - Navegación completa por teclado (Tab, Enter, flechas)
  - Contraste mínimo WCAG AA (4.5:1 texto normal, 3:1 texto grande)
  - No depender solo del color para comunicar información
- **Patrones de vibración para ciegos** (dispositivos móviles):
  - Alerta urgente: 3 pulsos cortos + 1 largo
  - Alerta normal: 2 pulsos cortos
  - Confirmación acción: 1 pulso suave
  - Error: 2 pulsos largos
  - Stoqly hablando: pulso continuo suave mientras habla
  - Estos patrones deben ser configurables y explicados al usuario
- **Modo alto contraste**: paleta alternativa con contraste WCAG AAA
- **Tamaño de texto**: normal / grande / muy grande (afecta a todo el panel)
- **Sin animaciones**: para personas con sensibilidad vestibular
- **Enfoque visible**: indicador de foco claro para navegación por teclado
- **Tier Free** — accesibilidad básica. Full ONCE certification → objetivo a medio plazo
- Afecta: TODO el frontend, diseño global, app móvil

### D12. Productos frescos sin fecha de caducidad — PENDIENTE
- **Problema**: Las patatas, verduras, frutas y tubérculos no tienen fecha de caducidad impresa. El sistema actual los trata igual que una conserva, lo que no tiene sentido.
- **Diseño completo**:

  **Schema** — nuevos campos en Item:
  - `fechaCompra: DateTime?` — cuándo se compró (independiente de `openedAt` que es para PAO)
  - `tipoFresco: String?` — categoría de fresco para calcular vida útil automáticamente
  - `vidaUtilDias: Int?` — estimación en días desde la compra (calculada automáticamente por tipo)
  - `conservacion: String?` — nota de conservación óptima (autorellenada por Stoqly/Open Food Facts)

  **Tipos de frescos y su lógica**:
  | Tipo | Vida útil | Conservación | Recetas al final |
  |---|---|---|---|
  | Tubérculos (patata, boniato) | 15-21 días | Lugar fresco, oscuro y seco. NUNCA nevera. No junto a cebollas. | Puré, tortilla, gratén |
  | Raíces (zanahoria, remolacha) | 10-14 días | Nevera en bolsa perforada | Crema, zumo, ensalada rallada |
  | Verduras de hoja (espinaca, lechuga) | 3-5 días | Nevera, envueltas en papel húmedo | Salteado, crema, smoothie |
  | Tomate | 4-7 días | NUNCA nevera (pierde sabor y textura) | Pisto, salsa, gazpacho |
  | Alliums (cebolla, ajo, puerro) | 20-30 días | Lugar seco y oscuro. NUNCA junto a patatas. | Sofrito, crema, sopa |
  | Frutas climatéricas (plátano, mango, aguacate) | 3-7 días (maduros) | Fuera nevera hasta maduros, luego nevera o pelar y congelar | Smoothie, helado, guacamole |
  | Frutas no climatéricas (fresas, uvas, cerezas) | 2-4 días | Nevera desde el principio, sin lavar | Mermelada, zumo, macedonía |
  | Cítricos (naranja, limón, mandarina) | 7-14 días | Temperatura ambiente o nevera | Zumo, ralladura, marmelada |
  | Hierbas aromáticas (perejil, cilantro) | 3-5 días | Nevera como un ramo en agua | Usar todo en un pesto o congelar |

  **Modal de añadir producto** — modo "Producto fresco":
  - Toggle: "Tiene fecha de caducidad" / "Es un producto fresco"
  - En modo fresco: mostrar "Fecha de compra" + selector de tipo (tubérculo, verdura hoja, fruta...)
  - Stoqly calcula automáticamente la vida útil estimada y la muestra: "Estimado: aguantan ~18 días"
  - Mostrar el consejo de conservación específico al añadirlo

  **Stoqly — lógica de frescos en el system prompt**:
  - Los frescos se incluyen en el contexto con días desde la compra y % de vida útil restante
  - Al 50% de vida útil: "Tienes X que llevan Y días — aún perfectos, pero empieza a pensar en usarlos"
  - Al 80%: "Las espinacas llevan 4 días — es el momento de cocinarlas. ¿Te sugiero una receta rápida?"
  - Al 100%+: "Las fresas llevan 5 días — pueden estar al límite. ¿Las uses hoy o las congelamos?"
  - Cuando ve varios frescos parecidos: "Tienes zanahoria, cebolla y tomate — con eso sale un pisto o una crema de verduras"

- **Afecta a**: Schema (migración), AddItemModal (toggle fresco), API items, Stoqly system prompt, Alertas (nueva sección frescos), DashboardPage

---

## PORTAL WEB — Estado por pantalla

### /login
- ✅ Formulario email + contraseña
- ✅ Enlace "Crear cuenta gratis"

### /registro — Onboarding conversacional
- ✅ Cuenta · Nombre · Supermercado · Código postal · Bienvenida
- ❌ "¿Hay bebés en casa?" (D7)
- ❌ "¿Tienes más de una casa?" (D5)
- ❌ Alergias en el onboarding (D9)

### /home — Dashboard
- ✅ Saludo · Stats · Caducan pronto · Zonas
- ❌ "Stoqly sugiere" — receta del día
- ❌ Banner urgente si hay caducados hoy
- ❌ Stoqly proactivo al abrir
- ❌ Selector de hogar activo (D5, tier Pro)

### /pantry — Despensa
- ✅ Tabla · Filtros · Búsqueda · Añadir · Consumir · Descartar · Editar
- ❌ Ficha individual /pantry/:id
- ❌ Aviso alérgeno al añadir producto (D9)

### /alerts — Alertas
- ✅ Caducados · Caducan pronto · Flujo Gestionar (consumir/donar/descartar)
- ✅ Modal donación Banco de Alimentos (datos fijos por ahora)
- ❌ Localización real por código postal (D1)
- ❌ Farmacia SIGRE real (D1)
- ❌ Alertas medicamentos (D7)
- ❌ Alertas PAO cosméticos
- ❌ Alertas bebés máxima prioridad (D7)

### /shopping — Lista de la compra
- ✅ Lista agrupada · Checkbox · Añadir · Eliminar · Badge Stoqly
- ❌ Modo "Estoy en el súper" con escáner (D10)
- ❌ Importe acumulado en tiempo real (D10)
- ❌ Umbral envío gratis por supermercado (D10)
- ❌ Comparativa precios entre supermercados (D10, tier Pro)
- ❌ Stoqly sugiere variante sin alérgeno (D2, D9)

### /settings — Ajustes (diseño completo)

**Sección 1 — Mi cuenta**
- ✅ Nombre
- ✅ Email (no editable)
- ✅ Código postal

**Sección 2 — Mi Stoqly**
- ✅ Nombre del asistente
- ✅ Modo de aviso (Voz / Vibración / Silencioso / Combinado)
- ✅ Velocidad de voz
- ✅ Humor activado/desactivado

**Sección 3 — Mi hogar**
- ✅ Nombre del hogar
- ✅ Supermercado principal
- ❌ Umbral de envío gratis por supermercado (Ej: Mercadona gratis desde 50€)
- ❌ Zonas de la despensa — editar, añadir, eliminar (D6)

**Sección 4 — Personas en casa**
- ✅ Lista de miembros con rol
- ✅ Invitar por email
- ✅ Eliminar miembro
- ❌ Email de invitación automático si el invitado no tiene cuenta (D8)

**Sección 5 — Categorías activas** ← NUEVA, clave para todo el sistema
- ✅ Alimentación (siempre activa, no se puede desactivar)
- ❌ 🍷 Bodega/Vinos — activa módulo maridaje y zona Bodega
- ❌ 🧴 Cosméticos y belleza — activa PAO y zona Baño/Belleza
- ❌ 💊 Medicamentos — activa tomas, SIGRE y zona Farmacia
- ❌ 🧹 Limpieza — activa alertas de seguridad (especialmente con bebés)
- ❌ 👶 Bebés — activa módulo bebés completo, máxima prioridad alertas (D7)
- Al activar cada categoría → se crea la zona correspondiente automáticamente

**Sección 6 — Mis alergias**
- ✅ Alergias predefinidas (chips: Gluten, Lactosa, Frutos secos...)
- ❌ Alergias personalizadas — campo libre + botón añadir (D9)
  - Ejemplo: "frutas tropicales", "castañas", "apio"
  - Se guardan igual que las predefinidas, Stoqly las trata igual

**Sección 7 — Accesibilidad** (D11)
- ❌ Alto contraste (paleta WCAG AA)
- ❌ Tamaño de texto (Normal / Grande / Muy grande)
- ❌ Sin animaciones (sensibilidad vestibular)
- ❌ Patrones de vibración personalizados (para ciegos — objetivo ONCE)
- ❌ Navegación por teclado completa (aria-labels en todos los elementos)

**Sección 8 — Segunda casa** (D5, tier Pro)
- ❌ "¿Tienes más de una casa?" → crear hogar adicional con nombre propio

**Sección 9 — Mi suscripción**
- ❌ Tier actual (Free / Hogar / Pro) con lo que incluye
- ❌ Botón para subir de plan
- ❌ Historial de facturas

### /baby/:id — Módulo bebés (nuevo, tier Hogar)
- ❌ Perfil · Tomas · Sólidos · Medicamentos pediátricos · Emergencia

### /impact — Impacto social
- ❌ Kg donados · SIGRE · CO₂ evitado · Badge Ciudadano Stoqly

---

## WIDGET STOQLY
- ✅ Chat · Quick actions · Contexto despensa · Ejecuta acciones
- ✅ Miembros del hogar con alergias en system prompt
- ❌ Conoce alergias personalizadas (D9)
- ❌ Conoce si hay bebés (D7)
- ❌ Sabe en qué hogar estás (D5)
- ❌ Stoqly proactivo al abrir
- ❌ Micrófono + voz (tier Hogar)

---

## API
- ✅ Auth · Items · Pantry · Tags · Albarán · Expediciones · Stoqly · Shopping · Profile
- ❌ Email invitación a hogar (Resend) (D8)
- ❌ Unirse a hogar por link (D8)
- ❌ Multi-hogar: seleccionar hogar activo (D5)
- ❌ Baby: CRUD bebés, tomas, sólidos, medicamentos (D7)
- ❌ Bancos Alimentos por código postal (D1)
- ❌ Farmacias SIGRE por código postal (D1)
- ❌ Precios por supermercado (D10)
- ❌ Medicamentos completo
- ❌ Cosméticos PAO

---

## ORDEN RECOMENDADO

### Ahora — Completar /settings
1. **D9**: Alergias personalizadas (campo libre + chips) — impacto inmediato, fácil
2. **D6**: Editar zonas de la despensa en ajustes
3. **D7**: Pregunta bebés en casa → perfil básico del bebé
4. **D5**: Pregunta segunda casa → crear hogar adicional

### Bloque siguiente — Funcionalidad shopping
5. **D10**: Modo compra básico (escanear y tachar de la lista)
6. **D10**: Importe acumulado + umbral envío gratis
7. **D8**: Email de invitación a nuevos miembros del hogar

### Bloque — Dashboard y ficha
8. "Stoqly sugiere" en /home
9. Ficha de producto /pantry/:id
10. Localización real Banco de Alimentos + SIGRE

### Bloque — Módulos tier Hogar
11. Módulo bebés completo (D7)
12. Módulo medicamentos
13. Módulo cosméticos PAO
14. Accesibilidad ONCE (D11) — proceso largo, empezar con aria-labels y contraste

### Bloque final — Monetización y app
15. /impact · Landing page · Suscripción y pago
16. App móvil completa
