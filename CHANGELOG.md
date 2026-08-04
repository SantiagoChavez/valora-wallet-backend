# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.0] - 2026-08-04

### Added (Añadido)
- **Justificación de Diseño de Base de Datos:** Documentación detallada en `README.md` que justifica las decisiones de modelado relacional, uso de UUIDs v4, precisión financiera con `NUMERIC(18,8)`, restricciones `CHECK` anti-sobregiros, índices de rendimiento y cascada.
- **Flujo de Cierre de Sesión:** Documentación del mecanismo stateless y descentralizado para el Cierre de Sesión (Logout) del token JWT en el cliente.
- **Enlaces y Guía de Despliegue:** Enlaces de producción para frontend y backend, y guía paso a paso del flujo de integración continua (CI/CD) conectado a Railway.

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
