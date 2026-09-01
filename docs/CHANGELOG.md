# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [1.4.0] - 2026-09-01

### Changed (Modificado)
- **Servicio de Emails (Nodemailer + Gmail SMTP):** Reemplazo integral del proveedor AWS SES por Nodemailer utilizando el transporte SMTP de Gmail (`service: 'gmail'`).
- **Variables de Entorno:** Eliminación de `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION` y `AWS_SES_SENDER_EMAIL` en favor de `EMAIL_USER` y `EMAIL_PASS` (App Password de Google).
- **Controladores y Transacciones:** Refactorización de `authController` y `transactionService` para consumir el nuevo módulo unificado `emailService.ts`.
- **Testing:** Creación de la suite de pruebas unitarias `emailService.test.ts` con Vitest y actualización de mocks en `passwordReset.test.ts`, `forgotPasswordRateLimit.test.ts` y `emailNotifications.test.ts`.
- **Dependencias:** Desinstalación de `@aws-sdk/client-ses` e incorporación de `nodemailer` y `@types/nodemailer`.

## [1.3.2] - 2026-08-13

### Added (Añadido)
- **Ruta Raíz:** Se agregó el endpoint `GET /` que devuelve un JSON de bienvenida y estado de la API, evitando el error visual `Cannot GET /` en el navegador.

### Changed (Modificado)
- **Documentación de Proyecto (Henry):** Actualización masiva de los README del Frontend y Backend para alinearse al estándar "Sobresaliente" de la rúbrica de Henry.
- **Arquitectura y Git Flow:** Documentación detallada del patrón Screaming Architecture, la metodología ágil (Sprints/INVEST) y el flujo de ramas de 4 etapas (`personal` -> `dev` -> `pre-staging` -> `main`).
- **Idioma Híbrido:** Formalización de la regla de código en inglés y comentarios/commits en español.
- **Seguridad de Infraestructura:** Se aclaró en la documentación que la base de datos PostgreSQL en Railway no expone una URL pública por razones de seguridad (conexión TCP interna).

## [1.3.1] - 2026-08-12

### Security (Seguridad)
- **Mitigación Salami Slicing:** Implementación de un spread/comisión del 1% en las operaciones de conversión de divisas para neutralizar la rentabilidad de ataques de alta frecuencia basados en redondeos.
- **Prevención de Desbordamiento Numérico:** Se incorporó un límite estricto de `.max(1_000_000)` en los validadores Zod de todas las transacciones para proteger el sistema de desbordamientos matemáticos (Number Overflow). Extendido para cubrir también el monto derivado cuando se cotiza/opera especificando el lado destino (`amountSide: "target"`), que antes esquivaba este límite.
- **Protección contra Denegación de Servicio (DoS):** Se añadió el middleware global `express-rate-limit` (máx. 100 peticiones cada 15 min por IP) para prevenir bombardeos masivos de peticiones y proteger la disponibilidad de las APIs externas. Se sumó además un límite propio, por usuario, en `POST /chatbot/message` (20 cada 15 min) — es la única ruta que factura contra la API de Gemini y el límite global por IP no la distinguía de rutas gratis como `/health`.

### Known Issues (Pendientes)
- **PII sin enmascarar en `POST /transactions/transfer/resolve`:** el endpoint devuelve nombre, apellido, alias, CVU, email y documento (DU) completos de cualquier cuenta consultada por email/CVU/alias, sin verificar relación previa con quien consulta. Decisión de equipo (2026-08-13): se evaluó enmascarar y se optó por dejarlo así por ahora para no complicar la UX de confirmación de destinatario antes de la demo. Queda como posible mejora futura reintroducir enmascarado parcial (nombre completo, pero email/CVU/DU ocultos parcialmente). Ver comentario en `resolveTransferController` (`src/controllers/transactionController.ts`).

## [1.3.0] - 2026-08-11

### Added (Añadido)
- **Google OAuth 2.0:** Registro e inicio de sesión con cuenta de Google (`POST /auth/google`). Los usuarios creados por Google quedan con perfil incompleto (`profileComplete: false`) hasta completar celular y DU.
- **Completar/Editar Perfil:** Nuevo endpoint `PATCH /auth/me` para cargar celular, país y documento único. Valida celular real (no línea fija) con `libphonenumber-js` y DU según el país (DNI, CPF, CURP, CI).
- **Middleware `requireCompleteProfile`:** Bloquea operaciones financieras (depósito, compra, venta, exchange) para cuentas con perfil incompleto (`403 IncompleteProfileError`). Cotización (`/quote`) queda exenta.
- **Catálogo de Documentos:** Nuevo endpoint `GET /catalogs/document-types` que devuelve la lista de tipos de documento válidos por país.
- **Edición de Alias:** Nuevo endpoint `PUT /wallet/alias` para personalizar el alias de la billetera.
- **Validación de Celular por País:** Integración de `libphonenumber-js/max` para validar y normalizar números de celular, rechazando líneas fijas.
- **Validación de Documento por País:** Validación dinámica de DU según el país del usuario (AR: 7-8 dígitos, PE: 8, CO: 8-10, MX: 10-18 alfanumérico).
- **Seed Data:** Script `src/database/seed.ts` para poblar la base de datos con 3 usuarios demo con consistencia contable exacta (saldos e historial reconciliados), robustez ante fallos de conexión y soporte para automatización (exitCode=1 en error). Ejecuta dentro de transacción ACID.
- **Tests nuevos:** `phoneValidation.test.ts`, `documentValidation.test.ts`, `requireCompleteProfile.test.ts`, `catalogs.test.ts`, `jwt.test.ts`. Total: 18 suites, 100+ tests pasando.

### Changed (Modificado)
- **TTL del JWT:** Reducido de 24 horas a 15 minutos por seguridad.
- **Estructura de Respuestas Auth:** `walletId` (string) reemplazado por objeto `wallet: { id, cvu, alias }` en register, login, google y me. **Breaking change para el Frontend** (documentado en `docs/informe_frontend.md`).
- **CORS Dinámico:** Ahora acepta la URL de producción fija + cualquier preview de Vercel del mismo proyecto (`valora-wallet-frontend-*.vercel.app`).
- **Schema SQL:** Columnas `du` y `password_hash` ahora son nullable para soportar cuentas Google. Migraciones `ALTER TABLE` incluidas para bases existentes.
- **Esquemas Zod:** Registro ahora valida `country`, `du`, `phone` y `dateOfBirth` con reglas dinámicas por país.

### Security (Seguridad)
- **JWT TTL 15 min:** Reduce la ventana de exposición ante tokens comprometidos.
- **Perfil Completo Obligatorio:** Impide operar financieramente sin celular y documento verificado.
- **Rechazo de Líneas Fijas:** Solo acepta celulares reales, preparando el terreno para verificación SMS/WhatsApp.
- **Borrado Acotado en Seed:** El script de seed solo borra cuentas `demo.%@valora.com`, nunca cuentas reales.

## [1.2.1] - 2026-08-04

### Changed (Modificado)
- **Estandarización de Códigos de Error Zod:** Actualización del código de error esperado a `VALIDATION_ERROR` en `auth.test.ts` para alinearse perfectamente con el middleware centralizado `errorHandler.ts`.
- **Inyección de Cabecera en Transacciones:** Configuración de la cabecera `Authorization: Bearer <token>` en todas las llamadas de integración de `transactions.test.ts` tras resolver el registro del usuario con los campos requeridos.
- **Resultado:** Suite de pruebas completamente estabilizada con 30/30 tests pasando de forma exitosa en verde.

## [1.2.0] - 2026-08-04

### Added (Añadido)
- **Justificación de Diseño de Base de Datos:** Documentación detallada en `README.md` que justifica las decisiones de modelado relacional, uso de UUIDs v4, precisión financiera con `NUMERIC(18,8)`, restricciones `CHECK` anti-sobregiros, índices de rendimiento y cascada.
- **Flujo de Cierre de Sesión:** Documentación del mecanismo stateless y descentralizado para el Cierre de Sesión (Logout) del token JWT en el cliente.
- **Enlaces y Guía de Despliegue:** Enlaces de producción para frontend y backend, y guía paso a paso del flujo de integración continua (CI/CD) conectado a Railway.

### Fixed (Corregido)
- **Robustez SSL en Producción:** Corrección de la lógica de evaluación de `DB_SSL_REJECT_UNAUTHORIZED` en `src/database/db.ts`. Ahora por defecto se rechazan certificados no válidos (TLS estricto) a menos que la variable esté explícitamente configurada en `"false"`, previniendo potenciales vulnerabilidades Man-in-the-Middle y manteniendo consistencia con `deploy.ts`.


## [1.1.0] - 2026-07-31

### Added (Añadido)
- Módulo de autenticación seguro implementado con `bcrypt` para el hasheo de contraseñas y `jsonwebtoken` (JWT) para la generación y verificación de tokens.
- Utilidades de JWT (`src/utils/jwt.ts`) tipadas y validadas contra variables de entorno en tiempo de ejecución.
- Middleware de autorización (`src/middlewares/authMiddleware.ts`) para proteger rutas que requieren inicio de sesión, extendiendo la interfaz Request de Express.
- Rutas públicas y protegidas en el backend (`/auth/register`, `/auth/login`, `/auth/me`) bajo el prefijo `/auth`.
- Suite de pruebas de integración completa (`src/tests/auth.test.ts`) utilizando Vitest y Supertest, que valida flujos exitosos y fallidos de registro, login y obtención del perfil actual.

### Changed (Modificado)
- **Tipado de Express:** Se optimizaron las importaciones de tipos de Express (`Request`, `Response`, `NextFunction`) en `authMiddleware.ts` y controladores mediante `import type` para evitar importaciones redundantes en tiempo de ejecución.
- **Transacciones de DB:** Rediseño de `registerController` para ejecutar secuencialmente la creación de `User`, `Wallet` y `Balance` dentro de una transacción atómica de PostgreSQL con un cliente del pool (`BEGIN`/`COMMIT`/`ROLLBACK`), asegurando consistencia e impidiendo registros incompletos.
- **Suite de Pruebas:** Remoción de `pool.end()` de las suites `auth.test.ts` y `dbModels.test.ts` para habilitar pruebas paralelas estables y evitar el error "Cannot use a pool after calling end".

### Security (Seguridad)
- **Firma explícita de JWT:** Se configuró explícitamente el algoritmo de firma `HS256` en `jwt.sign` y `jwt.verify`.
- **Validación del Payload:** Se agregó una verificación estructurada pos-decodificación en `verifyToken` para comprobar el tipo y presencia de `userId` y `email` en la estructura `JwtPayload` antes de retornar el objeto.

## [1.0.0] - 2026-07-28

### Added (Añadido)
- **Estructura del Proyecto:** Inicialización del backend con Express, TypeScript, tsx y Vitest.
- **Modelo de Base de Datos PostgreSQL:** Diseño físico del esquema relacional en `src/database/schema.sql` con las tablas `users`, `wallets`, `balances` y `transactions`.
- **Índices de Rendimiento:** Creación de índices específicos en la tabla `transactions` para optimizar las consultas por billetera.
- **Pruebas de Integración:** Suite de pruebas en `src/tests/dbModels.test.ts` para validar operaciones DML básicas de los modelos de base de datos.
- **Script de Inicialización:** Automatización del despliegue de base de datos local y remota mediante `npm run db:init` (`src/database/deploy.ts`).
