# Valora Wallet — Backend

API REST para **Valora Wallet**, billetera digital multi-moneda para freelancers y trabajadores remotos en LATAM. Permite gestionar balances en USD, EUR y ARS, ejecutar compra/venta/intercambio con tasas reales, enviar comprobantes por email y consultar un asistente financiero con IA.

## 🚀 Enlaces de Despliegue (Demo #1)

- **Backend API (Railway):** [https://valora-wallet-backend.up.railway.app](https://valora-wallet-backend.up.railway.app) (o tu URL de producción en Railway)
- **Base de Datos PostgreSQL (Railway):** Instancia de base de datos activa y provisionada.
- **Frontend (Vercel):** [https://valora-wallet.vercel.app](https://valora-wallet.vercel.app) (o tu URL de producción en Vercel)

## Stack

- **Runtime:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL (Railway)
- **Autenticación:** JWT
- **Emails:** AWS SES vía Vercel Functions
- **Chatbot:** Google Gemini API (gemini-2.5-flash)
- **Testing:** Vitest
- **Despliegue:** Railway

## Requisitos

- Node.js 20+
- Cuenta de PostgreSQL local o acceso a la instancia de Railway
- Variables de entorno (ver `.env.example`)

## Instalación y setup local

```bash
git clone https://github.com/<org-o-usuario>/valora-wallet-backend.git
cd valora-wallet-backend
npm install
cp .env.example .env   # completar con tus valores locales
npm run db:init        # inicializa el esquema de la base de datos (PostgreSQL)
npm run dev             # levanta el servidor en modo desarrollo
```

## Variables de entorno

| Variable                | Descripción                                            |
| ----------------------- | ------------------------------------------------------ |
| `DATABASE_URL`          | Connection string de PostgreSQL                        |
| `DB_SSL_REJECT_UNAUTHORIZED` | Valida estrictamente certificados SSL de la base de datos (por defecto `true`). Colocar `false` para omitir. |
| `JWT_SECRET`            | Secreto para firmar los tokens JWT                     |
| `AWS_ACCESS_KEY_ID`     | Credencial de AWS SES                                  |
| `AWS_SECRET_ACCESS_KEY` | Credencial de AWS SES                                  |
| `AWS_SES_REGION`        | Región de AWS SES                                      |
| `AWS_SES_SENDER_EMAIL`  | Email remitente verificado en AWS SES                  |
| `GEMINI_API_KEY`        | API key de Google Gemini                               |
| `FRONTEND_URL`          | URL del frontend en Vercel, usada para configurar CORS |
| `PORT`                  | Puerto local (default 3000)                            |

## Estructura del proyecto

```
src/
  ├── controllers/     # Lógica de cada endpoint
  ├── models/           # Modelos de datos (users, wallets, balances, transactions)
  ├── routes/            # Definición de rutas de la API
  ├── middlewares/     # Auth, validaciones, manejo de errores
  ├── services/           # Integraciones externas (Frankfurter, ExchangeRate-API, Gemini, AWS SES)
  └── tests/                # Suite de tests con Vitest
```

## 📊 Modelo de Datos y Justificación de Diseño (PostgreSQL)

El diseño de la base de datos sigue las mejores prácticas de modelado relacional para garantizar consistencia, integridad de los datos y alto rendimiento. El modelo consta de 4 tablas principales:

- **`users`** — Almacena las cuentas de los usuarios (datos personales, email y contraseña hasheada).
- **`wallets`** — Representa la billetera digital vinculada al usuario (relación 1:1).
- **`balances`** — Registra los saldos disponibles por moneda para cada billetera (relación 1:N).
- **`transactions`** — Funciona como un ledger (libro contable) inmutable de todas las operaciones (compras, ventas, exchanges, depósitos).

### Justificación de las Decisiones de Diseño (Criterio de Rúbrica)

Para cumplir con los más altos estándares de calidad y auditoría, se tomaron las siguientes decisiones de ingeniería y diseño:

* **Separación de Responsabilidades (Relación 1:1 entre `users` y `wallets`):**
  Se desacopló la entidad de identidad del usuario (`users`) de su billetera financiera (`wallets`). Esto encapsula la lógica de negocio, facilita el mantenimiento de seguridad independiente (por ejemplo, auditoría de accesos) y deja abierta la arquitectura para escenarios futuros como múltiples billeteras por usuario.
* **Normalización Multi-moneda Dinámica (Relación 1:N entre `wallets` y `balances`):**
  En lugar de almacenar los saldos como columnas estáticas en la tabla `wallets` (ej. `balance_usd`, `balance_ars`), se diseñó una tabla independiente `balances` vinculada por clave foránea (`wallet_id`). Esto permite dar soporte a nuevas monedas de manera dinámica sin necesidad de alterar la estructura física (DDL) de la base de datos.
* **Consistencia y Seguridad con Clave Única Compuesta (`UNIQUE`):**
  Se definió una restricción única compuesta en la tabla `balances` utilizando la tupla `(wallet_id, currency_code)`. Esto garantiza a nivel físico y lógico que nunca existan saldos duplicados de una misma moneda para una billetera, manteniendo la consistencia de los balances.
* **Precisión Financiera Exacta (`NUMERIC(18,8)`):**
  Los montos en las tablas `balances` y `transactions` se definen utilizando el tipo de dato `NUMERIC(18,8)` en lugar de tipos de coma flotante (`FLOAT` o `REAL`). Los floats presentan imprecisiones inherentes por redondeo binario de la norma IEEE 754, inviables en aplicaciones fintech. El tipo `NUMERIC` garantiza precisión contable exacta hasta el octavo decimal (adecuado tanto para monedas tradicionales como para criptoactivos).
* **Garantía Anti-Sobregiros a Nivel Motor (`CHECK constraint`):**
  Se incorporó la restricción `CHECK (amount >= 0)` en la tabla `balances`. De esta manera, el propio motor de base de datos rechaza cualquier operación que intente restar un monto superior al saldo actual, blindando al sistema contra giros en descubierto de forma nativa.
* **Libro de Transacciones Inmutable (`transactions`):**
  La tabla `transactions` registra de forma histórica e inalterable todas las operaciones financieras. No permite actualizaciones (`UPDATE`) ni borrados, garantizando que el historial de transacciones sirva como una pista de auditoría confiable. Almacena las tasas de cambio históricas y el saldo resultante (`resulting_balance`) para evitar recálculos costosos y facilitar la conciliación de saldos.
* **Optimización de Consultas mediante Índices Apropiados:**
  Se implementó un índice no agrupado en `transactions(wallet_id)` (`idx_transactions_wallet_id`). La consulta más frecuente e importante a nivel de negocio en esta tabla es el filtrado del historial de transacciones de una billetera. El índice evita escaneos secuenciales completos de la tabla, manteniendo las búsquedas en tiempo constante $O(1)$ o logarítmico $O(\log N)$ a medida que crece el ledger.
* **Integridad Referencial con Eliminación en Cascada (`ON DELETE CASCADE`):**
  Las claves foráneas de `wallets`, `balances` y `transactions` include la directiva `ON DELETE CASCADE` hacia sus respectivas dependencias jerárquicas superiores. Esto asegura que si se elimina un usuario, se purguen automáticamente todas sus entidades asociadas, previniendo la existencia de registros huérfanos en cumplimiento con los estándares de diseño relacional.

## API Endpoints (Módulo de Autenticación)

### Arquitectura de Transacciones Atómicas (Registro Seguro)
Para garantizar la integridad referencial y prevenir estados inconsistentes o datos huérfanos, la creación de la cuenta de usuario, su billetera y su saldo inicial en dólares (`USD`) se realiza mediante una **Transacción Atómica de PostgreSQL** utilizando un cliente dedicado del pool (`pool.connect()`).
- Si alguna de las operaciones falla (`User`, `Wallet` o `Balance`), se ejecuta un `ROLLBACK` automático para revertir cualquier inserción previa.
- Si todas las operaciones se completan de manera exitosa, se efectúa un `COMMIT` y se libera el cliente de vuelta al pool.

```mermaid
graph TD
    A[Petición POST /auth/register] --> B[Validar Datos y Email]
    B --> C[Hashear Contraseña]
    C --> D[Obtener Cliente del Pool y BEGIN]
    D --> E[Insertar en 'users']
    E --> F[Insertar en 'wallets']
    F --> G[Insertar en 'balances' USD]
    G --> H[COMMIT]
    H --> I[Liberar Cliente]
    I --> J[Responder 201 Created]
    E -.->|Fallo| K[ROLLBACK]
    F -.->|Fallo| K
    G -.->|Fallo| K
    K --> L[Liberar Cliente y Retornar Error]
```

### Registro de Usuario
- **Ruta:** `POST /auth/register`
- **Autenticación:** Pública (Ninguna).
- **Descripción:** Registra un nuevo usuario de forma atómica en el sistema. Crea automáticamente su billetera asociada y le asigna un saldo inicial de `0.00000000 USD`.
- **Request Body (JSON):**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "PasswordSegura123!",
    "firstName": "Santiago",
    "lastName": "Chavez"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "c138d8f0-1be4-434c-b4db-01de7c7bd488",
      "email": "usuario@ejemplo.com",
      "firstName": "Santiago",
      "lastName": "Chavez"
    },
    "walletId": "f782f9d8-9db8-40a2-a60d-fb964a2f7c00"
  }
  ```

### Inicio de Sesión
- **Ruta:** `POST /auth/login`
- **Autenticación:** Pública (Ninguna).
- **Descripción:** Valida las credenciales de un usuario y retorna su información junto con un token JWT de acceso.
- **Request Body (JSON):**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "PasswordSegura123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "c138d8f0-1be4-434c-b4db-01de7c7bd488",
      "email": "usuario@ejemplo.com",
      "firstName": "Santiago",
      "lastName": "Chavez"
    },
    "walletId": "f782f9d8-9db8-40a2-a60d-fb964a2f7c00"
  }
  ```

### Perfil del Usuario Autenticado
- **Ruta:** `GET /auth/me`
- **Autenticación:** Requerida (`Authorization: Bearer <token>`).
- **Descripción:** Obtiene los datos del perfil, la billetera y los saldos del usuario actualmente autenticado mediante el token JWT.
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "c138d8f0-1be4-434c-b4db-01de7c7bd488",
      "email": "usuario@ejemplo.com",
      "firstName": "Santiago",
      "lastName": "Chavez"
    },
    "walletId": "f782f9d8-9db8-40a2-a60d-fb964a2f7c00",
    "balances": [
      {
        "id": "...",
        "wallet_id": "...",
        "currency_code": "USD",
        "amount": "100.00000000",
        "created_at": "...",
        "updated_at": "..."
      }
    ]
  }
  ```

### Cierre de Sesión (Logout)
* **Mecanismo:** Descentralizado / Stateless.
* **Descripción:** Al utilizar autenticación basada en tokens JWT sin estado (stateless), el servidor no mantiene sesiones persistentes en memoria o base de datos. El cierre de sesión se gestiona íntegramente en el cliente (frontend) mediante las siguientes acciones:
  1. Eliminar el token JWT almacenado localmente (ej. `localStorage.removeItem('token')` o borrar las cookies asociadas).
  2. Limpiar el estado de autenticación en el gestor de estado global (Redux, Context API, etc.).
  3. Redirigir al usuario a la pantalla de Login.
  Esto garantiza que cualquier petición subsiguiente no incluya la cabecera `Authorization: Bearer <token>`, denegando automáticamente el acceso al usuario y liberando memoria en el servidor.

### Protección de Rutas (Middleware)
Todas las rutas que requieran autenticación pasan a través del middleware `authMiddleware.ts`. Este middleware realiza las siguientes validaciones:
1. **Presencia del Token:** Verifica que exista la cabecera `Authorization`.
2. **Formato:** Valida que el formato del header corresponda a `Bearer <token>`.
3. **Firma y Algoritmo:** Valida la firma del token con el `JWT_SECRET` utilizando el algoritmo explícito `HS256` para evitar ataques de manipulación de algoritmos (JWT algorithm confusion).
4. **Vigencia:** Valida que el token no haya expirado.
5. **Inyección de Contexto:** Si el token es válido, decodifica el payload (que contiene `userId` y `email`) e inyecta la información en el objeto `req.user`, extendiendo la interfaz `Request` de Express para que los controladores subsiguientes tengan acceso a la identidad del usuario de manera segura.

## Ejecución de Pruebas

Para ejecutar la suite completa de pruebas (modelos de datos y sistema de autenticación) con Vitest y Supertest, ejecuta el siguiente comando:

```bash
npm run test
```

## Scripts disponibles

```bash
npm run dev        # desarrollo con hot-reload
npm run build      # build de producción
npm run start      # levanta el build de producción
npm run test        # corre la suite de Vitest
npm run db:init    # inicializa y despliega el esquema SQL en la base de datos (PostgreSQL)
```

## ⚙️ Despliegue en Producción (Railway y Vercel)

El backend de **Valora Wallet** se encuentra configurado para un flujo de Integración y Despliegue Continuo (CI/CD) conectado a **Railway**:

1. **Conexión Automática:** Cada push a la rama `main` del repositorio de GitHub dispara un deploy automático en Railway.
2. **Infraestructura de Base de Datos:** Se utiliza un servicio provisionado de PostgreSQL dentro de Railway, el cual mantiene la base de datos persistente.
3. **Configuración de Entorno:** Las variables de entorno críticas (definidas en `.env.example`) se configuran directamente en el panel de control del servicio de Railway, asegurando que ningún dato sensible o credencial de API se exponga en el repositorio.
4. **CORS:** El backend restringe el acceso de orígenes cruzados permitiendo únicamente peticiones provenientes de la URL del frontend desplegado en **Vercel** (configurado a través de `FRONTEND_URL`) y del entorno de desarrollo local.

## Known issues

_(agregar acá cualquier decisión técnica relevante, como la de mantener versiones de dependencias por temas de compatibilidad)_

## Equipo

- Santiago Chavez — Backend Core (modelo de datos, autenticación, despliegue, testing)
- Daniel Sardinas — Lógica de negocio + IA (compra/venta/intercambio, tasas de cambio, chatbot Gemini)
- Gerardo Acosta — Frontend Lead (colaborador en este repo)
- Analía Pérez Juliá — Integración AWS SES, documentación, coordinación y tareas de Frontend.


# Guia de Endpoints para Insomnia

Esta es la guia paso a paso para probar tu backend localmente utilizando **Insomnia**.

> ⚠️ **IMPORTANTE: Configuracion de Base de Datos**
> Antes de empezar, asegurate de que tu archivo `.env` contenga la siguiente variable al final. Esto soluciona el error `self-signed certificate` con la base de datos de Railway:
> ```env
> DB_SSL_REJECT_UNAUTHORIZED=false
> ```
> *Si acabas de agregar esto, no olvides reiniciar tu servidor (`npm run dev`) antes de probar en Insomnia.*

---

## 1. Autenticacion (`/auth`)

### 1.1 Registrar un Usuario
*   **Metodo:** `POST`
*   **URL:** `http://localhost:3000/auth/register`
*   **Descripcion:** Crea una cuenta nueva de usuario. Empezaremos creando a un usuario llamado "Carlos".
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request. Selecciona `POST` y pega la URL.
    2. Ve a la pestana **Body**, selecciona **JSON**.
    3. Pega este contenido:
    ```json
    {
      "email": "carlos.prueba@email.com",
      "password": "PasswordSeguro123!",
      "firstName": "Carlos",
      "lastName": "Lopez",
      "dateOfBirth": "10/10/1995",
      "phone": "+525512345678"
    }
    ```
    4. Haz clic en **Send**. Deberias recibir una respuesta indicando que el registro fue exitoso.

### 1.2 Iniciar Sesion (Obtener el Token)
*   **Metodo:** `POST`
*   **URL:** `http://localhost:3000/auth/login`
*   **Descripcion:** Inicia sesion con el usuario recien creado para obtener el Token de Autorizacion.
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `POST` con la URL.
    2. En **Body** -> **JSON**, ingresa las credenciales:
    ```json
    {
      "email": "carlos.prueba@email.com",
      "password": "PasswordSeguro123!"
    }
    ```
    3. Haz clic en **Send**.
    4. **COPIA EL TOKEN:** En la respuesta veras un campo `token` (un texto largo que empieza con "ey..."). Copia ese texto. Lo vas a necesitar para los siguientes endpoints.

### 1.3 Obtener Mi Perfil 🔒
*   **Metodo:** `GET`
*   **URL:** `http://localhost:3000/auth/me`
*   **Descripcion:** Devuelve los datos del perfil de Carlos. Requiere autenticacion.
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `GET` con la URL.
    2. Ve a la pestana **Auth** y selecciona **Bearer Token**.
    3. En el campo **Token**, pega el texto que copiaste en el paso anterior.
    4. Haz clic en **Send**. *(No requiere Body)*.

---

## 2. Transacciones (`/transactions`)

### 2.1 Realizar un Deposito 🔒
*   **Metodo:** `POST`
*   **URL:** `http://localhost:3000/transactions/deposit`
*   **Descripcion:** Ingresa dinero en la billetera de Carlos. En este ejemplo, vamos a depositar 500 Dolares (USD).
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `POST` con la URL.
    2. En la pestana **Auth**, selecciona **Bearer Token** y pega el token.
    3. En **Body** -> **JSON**, pega lo siguiente:
    ```json
    {
      "currency": "USD",
      "amount": 500
    }
    ```
    4. Haz clic en **Send**.

### 2.2 Realizar un Exchange (Cambio de Moneda) 🔒
*   **Metodo:** `POST`
*   **URL:** `http://localhost:3000/transactions/exchange`
*   **Descripcion:** Cambia una parte del dinero depositado a otra moneda. Aqui cambiaremos 100 USD a ARS (Pesos Argentinos).
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `POST` con la URL.
    2. En la pestana **Auth**, selecciona **Bearer Token** y pega el token.
    3. En **Body** -> **JSON**, pega lo siguiente:
    ```json
    {
      "fromCurrency": "USD",
      "toCurrency": "ARS",
      "amount": 100
    }
    ```
    4. Haz clic en **Send**.

---

## 3. Saldos (`/balances`)

### 3.1 Ver Saldos Actuales 🔒
*   **Metodo:** `GET`
*   **URL:** `http://localhost:3000/balances`
*   **Descripcion:** Muestra los saldos que tiene Carlos. Deberias ver los USD restantes (400) y los ARS que obtuvo del exchange.
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `GET` con la URL.
    2. En la pestana **Auth**, selecciona **Bearer Token** y pega el token.
    3. Haz clic en **Send**. *(No requiere Body)*.

---

## 4. Estado de Salud (`/health`)

### 4.1 Comprobar el Servidor
*   **Metodo:** `GET`
*   **URL:** `http://localhost:3000/health`
*   **Descripcion:** Sirve simplemente para confirmar que el servidor backend esta encendido y funcionando.
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `GET` con la URL.
    2. Haz clic en **Send**. *(No requiere Auth ni Body)*.
    3. Recibiras una respuesta indicando `{"status": "ok"}`.

## 5. Asistente Financiero (Chatbot)

### 5.1 Enviar Mensaje a la IA
*   **Metodo:** `POST`
*   **URL:** `http://localhost:3000/chatbot/message`
*   **Descripcion:** Envía una consulta de texto al asistente financiero. El servidor inyectará automáticamente los saldos del usuario para generar respuestas contextuales. Requiere autenticación.
*   **Como probarlo en Insomnia:**
    1. Crea un nuevo Request `POST` con la URL.
    2. En la pestana **Auth**, selecciona **Bearer Token** y pega el token.
    3. En **Body** -> **JSON**, pega lo siguiente:
    ```json
    {
      "message": "¿Me alcanza el saldo para comprar un café de 5 euros?"
    }
    ```
    4. Haz clic en **Send**.
    5. **Respuesta Exitosa (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "reply": "Si tienes saldo suficiente. Actualmente cuentas con 55 EUR en tu billetera."
      }
    }
    ```