# Stoqly — Directorio de capacidades

> **Versión:** Junio 2026  
> Este documento recoge todo lo que Stoqly puede hacer hoy, lo que está en construcción y el camino hacia un asistente de hogar proactivo y completo.

---

## Qué es Stoqly

Stoqly es un sistema de inteligencia doméstica. Parte del control de la despensa y evoluciona hacia un asistente que cubre todas las necesidades del hogar: alimentación, salud, higiene, belleza, suplementación y cuidado de bebés. El asistente se llama **Stoqly** (o el nombre que el usuario elija) y actúa como un vecino que conoce la casa y ayuda a gestionarla.

El modelo es escalable: desde una persona sola hasta un hogar con varios miembros, y desde un domicilio hasta una red de hogares o espacios gestionados.

---

## Módulo 1 — Despensa y alimentación ✅ Activo

### Lo que puedes hacer

**Registrar productos**
- Manual: nombre, cantidad, unidad, fecha de caducidad, zona
- Por código de barras con la cámara del móvil o la webcam
- Por etiqueta NFC/RFID (integración con TrackRFID para hogares con etiquetado físico)
- Desde Stoqly por voz o texto: "Stoqly, tengo dos botes de tomate frito"

**Gestionar la despensa**
- Ver todos los productos organizados por zona (nevera, congelador, armarios, bodega…)
- Filtrar por zona, caducidad, categoría
- Editar cantidad, fecha, notas de cualquier producto
- Mover productos entre zonas

**Productos frescos sin fecha de caducidad**
- Sistema especial para frutas, verduras, hierbas y otros frescos
- Calcula automáticamente los días desde la compra y la vida útil estimada
- Barra de frescura visual — avisa cuando algo está al límite antes de que se estropee

**Alertas de caducidad**
- Productos que caducan en los próximos 7 días
- Productos ya caducados
- Badge de urgencia visible en el sidebar con el total combinado
- Los productos marcados para donar no cuentan como alerta (ya tienes el plan)

**Donación al Banco de Alimentos**
- Botón "Donar" en cada producto próximo a caducar
- El producto queda como "Pendiente de llevar" — visible en Alertas
- Confirmar entrega: botón en la UI o diciéndole a Stoqly "ya los he llevado"
- Stoqly registra la donación y elimina el producto del inventario

**Recibir compra**
- Escanear productos con la cámara al llegar del supermercado
- Detección automática de nombre, cantidad y fecha de caducidad por código de barras
- Registro masivo rápido de la compra completa

**Lista de la compra**
- Añadir productos manualmente o a través de Stoqly
- Stoqly puede añadir directamente: "añade leche a la lista"
- Organizada por supermercado preferido
- Eliminar duplicados con un botón o diciéndole a Stoqly "elimina lo repetido"
- Stoqly puede eliminar un producto concreto: "quita los huevos de la lista"

**¿Qué cocino?**
- Planificador de menús para cualquier ocasión
- Usa los ingredientes que tienes en casa como base
- Para menús de celebración propone el menú ideal y luego indica qué tienes y qué necesitas comprar
- Respeta las alergias de todos los miembros del hogar

---

## Asistente Stoqly ✅ Activo

Stoqly es el cerebro conversacional del producto. Está construida sobre Claude (Anthropic) y tiene acceso completo al estado del hogar en tiempo real.

### Lo que Stoqly puede hacer ahora

**Responder preguntas sobre la despensa completa**
- "¿Tengo leche entera?" → responde con las unidades exactas que hay
- "¿Qué se me va a caducar esta semana?"
- "¿Qué puedo cenar con lo que tengo?"
- Conoce toda la despensa sin límite de productos

**Responder sobre salud y suplementos**
- "¿Cuándo me toca tomar el magnesio?"
- "¿Qué medicamentos tengo caducados?"
- "¿Cuántas pastillas me quedan de ibuprofeno?"
- Avisa automáticamente si hay medicamentos caducados o con stock bajo

**Responder sobre el bebé**
- "¿A qué hora fue la última toma de Martina?"
- "¿Cuántas tomas ha hecho hoy?"
- "¿Cuánto pesa el bebé?"
- Conoce todos los perfiles de bebé del hogar con edad, tomas y mediciones

**Ejecutar acciones directas**
- Añadir un producto a la despensa
- Marcar un producto como consumido (total o parcial)
- Descartar un producto
- Añadir/eliminar productos de la lista de la compra
- Quitar duplicados de la lista de la compra
- Confirmar entrega al Banco de Alimentos
- Navegar al usuario a cualquier sección de la app (incluyendo /baby, /supplements, /medications)
- Buscar farmacias cercanas por código postal (OpenStreetMap + Overpass API)
- Orientar sobre el punto SIGRE más cercano para medicamentos caducados

**Farmacias y SIGRE**
- "¿Hay alguna farmacia cerca?" → lista las 4 más cercanas con distancia y enlace a Maps
- "Tengo medicamentos caducados, ¿dónde los llevo?" → busca farmacias con contenedor SIGRE y explica cómo usarlo
- Funciona con el código postal del perfil del usuario

**Ayuda contextual**
- Sabe en qué página estás y adapta su ayuda
- Explica cómo usar cualquier función de la app
- Te lleva a la sección correcta con un clic

**Personalización**
- Nombre del asistente elegible por el usuario
- Tono con o sin humor
- Conoce las alergias de todos los miembros del hogar — nunca sugiere algo que las incumpla
- Modo de accesibilidad: voz, vibración, silencioso, combinado

**Contexto completo del hogar**
- Despensa: todos los productos sin límite
- Suplementos activos del adulto (separados de los del bebé)
- Medicamentos activos del adulto con alertas de caducidad
- Bebés: edad, tomas de hoy, última toma, peso y talla más recientes
- Lista de la compra con IDs para actuar directamente
- Patrones de consumo: aprende cada cuántos días se usa cada producto
- Perfil deportivo: deporte, nivel, días por semana
- Perfil nutricional: calorías y macros recomendados según peso, altura y objetivo
- Donaciones pendientes para llevar al Banco de Alimentos

**Voz bidireccional (web panel)**
- TTS: Stoqly habla con voz natural (ElevenLabs) o voz del navegador como fallback
- STT: el usuario habla y Stoqly escucha (Web Speech API)
- Wake word: botón manual para activar escucha sin necesidad de abrir el widget

---

## Multi-hogar y usuarios ✅ Activo

- Cada cuenta puede tener varios hogares (según plan)
- Cambio de hogar activo desde el sidebar — todo el contenido cambia instantáneamente
- Cada hogar tiene sus propias zonas, productos, alertas, lista de la compra y bebés
- Los miembros del hogar tienen roles: Propietario, Administrador, Miembro, Observador
- Las alergias de cada miembro se tienen en cuenta en las sugerencias de Stoqly

**Invitar miembros al hogar**
- Invitar por email desde Ajustes — funciona aunque el invitado no tenga cuenta todavía
- Se genera un enlace de invitación seguro (expira en 7 días)
- Se envía un email con el enlace (vía Resend)
- Si el invitado no tiene cuenta, al registrarse es redirigido a la página de aceptación
- Si ya tiene cuenta, puede aceptar directamente desde `/invite/:token`
- Al aceptar: se une al hogar y este se establece como su hogar activo
- Verificación de email: solo puede aceptar la persona a quien se invitó

---

## Módulo 2 — Cosméticos e Higiene ✅ Activo

**Registrar productos de belleza**
- Manual desde el panel: nombre, categoría (rostro, cuerpo, cabello, maquillaje, otros), cantidad
- Configura el PAO (Period After Opening): 1, 2, 3, 6, 9, 12, 18, 24 o 36 meses

**Control PAO por producto**
- Registra cuándo abres cada producto con el botón "Abrir hoy"
- Barra visual de vida útil: verde / ámbar / rojo según porcentaje consumido
- Indicador de días restantes o días de retraso si ya caducó

**Consejo de uso con IA**
- Stoqly genera automáticamente el consejo de uso de cada cosmético: cuándo aplicarlo, frecuencia, qué evitar combinar

---

## Módulo 3 — Suplementos ✅ Activo

**Registrar suplementos**
- Nombre, cantidad, unidad (cáps., comp., ml, mg, sobres, u)
- Dosis (ej: "1 cápsula en ayunas"), frecuencia (diario, cada 8h, cada 12h, semanal, según necesidad)
- Escáner de código de barras para añadir rápido
- Notas opcionales

**Control de stock**
- Barra de stock visual por suplemento
- Alerta de stock bajo (configurable por producto)
- Reponer con un clic (+20 unidades)
- Consumir con un clic (−1 unidad)

**Editar suplementos**
- Edición inline desde el panel: nombre, cantidad, unidad, dosis, frecuencia, notas

**Separación adulto / bebé**
- Los suplementos del adulto y del bebé están separados
- Desde el módulo Bebés se gestionan los del bebé

**Stoqly integrado**
- Conoce todos los suplementos activos del adulto
- Avisa si hay stock bajo
- Navega a /supplements cuando lo necesitas

---

## Módulo 4 — Medicamentos ✅ Activo

**Registrar medicamentos**
- Nombre, cantidad, unidad (comp., cáps., ml, mg, sobres, ampollas)
- Dosis y frecuencia de toma
- Fecha de caducidad con alertas automáticas
- Escáner de código de barras
- Notas opcionales

**Sistema de alertas inteligente**
- Borde rojo: medicamento caducado
- Borde ámbar: caduca en menos de 60 días
- Badges en la tarjeta: "Caducado", "Caduca pronto", "Stock bajo"
- Contador en el header: caducados / próximos a caducar / stock bajo

**Acciones rápidas**
- Consumir −1 unidad
- Reponer +20 unidades
- Buscar farmacia cercana (si stock bajo)
- Llevar al SIGRE (si caducado)
- Editar: nombre, cantidad, unidad, dosis, frecuencia, caducidad, notas
- Eliminar

**Panel de farmacias cercanas**
- Busca las 4 farmacias más cercanas al código postal del usuario (OpenStreetMap)
- Muestra nombre, dirección, distancia, teléfono, horario
- Botón de ruta directa a Google Maps
- Modo SIGRE: explica que todas las farmacias tienen el contenedor naranja para medicamentos caducados

**Separación adulto / bebé**
- Los medicamentos del adulto y del bebé están separados
- Desde el módulo Bebés se gestionan los pediátricos

**Stoqly integrado**
- Conoce todos los medicamentos activos del adulto con fechas de caducidad
- Avisa si hay caducados o stock bajo
- Puede buscar farmacias desde el chat

---

## Módulo 5 — Bebés ✅ Activo

**Perfiles de bebé**
- Crear varios perfiles: nombre, fecha de nacimiento, género
- El sistema calcula automáticamente la edad en meses
- Selector entre perfiles dentro del módulo

**Registro de tomas**
- Tipos: Pecho izquierdo, Pecho derecho, Biberón (con ml), Sólidos (con gramos)
- Duración en minutos para tomas de pecho
- Notas opcionales por toma
- Historial de tomas con hora exacta

**Resumen de tomas en tiempo real**
- Última toma: tipo y tiempo transcurrido ("hace 2h")
- Total de tomas hoy
- Total de ml ingeridos hoy (biberones)

**Mediciones y crecimiento**
- Registro de peso (kg), talla (cm) y perímetro cefálico (cm)
- Historial de mediciones con fecha
- Últimos valores visibles en el resumen del perfil

**Stock pediátrico**
- Suplementos del bebé separados del adulto
- Medicamentos pediátricos separados del adulto
- Añadir/editar/eliminar desde el módulo Bebés

**Stoqly integrado**
- Conoce todos los bebés del hogar: nombre, edad en meses, género
- Sabe cuántas tomas ha habido hoy y cuándo fue la última
- Conoce el peso y talla más recientes
- Navega a /baby cuando el usuario pregunta por el bebé

---

## Perfil del usuario ✅ Activo

**Datos personales**
- Nombre, email, código postal
- Alergias predefinidas (gluten, lactosa, frutos secos, huevo, pescado, marisco, soja, sésamo, mostaza, sulfitos, cacahuetes, apio, moluscos, altramuces)
- Alergias personalizadas adicionales (texto libre)

**Perfil nutricional**
- Peso (kg), altura (cm), edad
- Nivel de actividad: sedentario / ligero / moderado / activo / muy activo
- Objetivo: perder peso / mantenimiento / ganar masa muscular / dieta específica
- Stoqly calcula calorías y proteínas recomendadas (fórmula Mifflin-St Jeor) y las usa en sus sugerencias

**Perfil deportivo**
- Deporte practicado, nivel (principiante / intermedio / avanzado / competición)
- Días por semana de entrenamiento
- Stoqly adapta sus sugerencias de nutrición, hidratación y suplementación al deporte

**Accesibilidad**
- Modo: voz / vibración / silencioso / combinado
- Tamaño de texto: normal / grande / extra grande
- Alto contraste
- Velocidad de voz del asistente

**Preferencias de Stoqly**
- Nombre del asistente personalizable
- Humor activado/desactivado

---

## Planes y tiers

| Plan       | Precio        | Domicilios | Personas | Módulos incluidos |
|------------|---------------|------------|----------|-------------------|
| Hogar      | Gratis        | 1          | Hasta 5  | Alimentación, Stoqly básica |
| Experto    | 9,99€/año     | Hasta 3    | Hasta 10 | + Historial de consumo, Cosméticos, Medicamentos |
| Premium    | 19,99€/año    | Hasta 5    | Ilimitadas | + Estadísticas de ahorro, Alertas sanitarias AESAN, Stoqly avanzada |
| Enterprise | A consultar   | Sin límites | Sin límites | Gestión empresarial, ERP, TrackRFID integrado |

---

## Aprendizaje proactivo ✅ Activo (en segundo plano)

Stoqly ya aprende los patrones de consumo del hogar aunque el usuario no lo sepa:
- Registra cada vez que se consume un producto
- Calcula el intervalo medio de recompra por producto
- Detecta cuándo algo lleva más tiempo del habitual sin aparecer en la despensa
- Stoqly puede anticipar: "Normalmente compras leche cada 8 días, llevas 7 sin comprar — ¿la añado?"

---

## En construcción — Roadmap próximo

**App móvil completa**
- Pantallas de Suplementos, Medicamentos y Bebés en la app móvil (actualmente solo en web)
- Voz completa en móvil: TTS/STT nativo con expo-speech
- Wake word por voz en segundo plano
- Notificaciones push para alertas urgentes

**Historial y estadísticas**
- Gasto mensual en alimentación
- Ranking de productos más consumidos
- Alimentos más desperdiciados

**Integración con wearables** *(pendiente de valorar)*
- Apple HealthKit, Google Fit para ajustar calorías según actividad real

**Accesibilidad ampliada**
- Perfil para cuidadores: gestionar el hogar de otra persona
- Integración con pedido a domicilio de supermercado

---

## Arquitectura técnica

**Stack**
- Monorepo pnpm con Turborepo
- API: Fastify + TypeScript + Prisma ORM + PostgreSQL
- Web Panel: React + Vite + TanStack Query + React Router
- App móvil: Expo (React Native) — en desarrollo activo
- IA: Anthropic Claude (Haiku para Stoqly en tiempo real)
- TTS: ElevenLabs + fallback Web Speech API
- STT: Web Speech API (navegador)
- Mapas/Farmacias: OpenStreetMap Nominatim + Overpass API (sin coste)
- NFC/RFID: integración con TrackRFID (producto Domtrace)

**Seguridad**
- Autenticación JWT
- Aislamiento por hogar: ningún usuario puede ver datos de otro hogar
- Variables de entorno para claves de API — nunca en código

**Escalabilidad**
- Arquitectura multi-tenant desde el diseño inicial
- Cada hogar es un tenant independiente
- Preparado para escalar a miles de hogares sin cambios de arquitectura

---

*Documento actualizado por Claude · Stoqly / Domtrace · Junio 2026*
