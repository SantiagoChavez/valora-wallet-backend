# Reporte de Integración - Cambios de Backend (Onboarding)

Este documento detalla los cambios realizados en el Backend que impactan directamente al equipo de **Frontend**. Por favor, revisen estos puntos para actualizar la integración en el Dashboard/App.

---

## 1. Cambios en el Registro de Usuarios (`POST /auth/register`)

El registro ahora soporta la estrategia Multi-País. Se agregaron dos nuevos campos **obligatorios** al payload.

### 📥 Payload de Solicitud (Body)
```json
{
  "email": "usuario@mail.com",
  "password": "Password123!",
  "firstName": "Juan",
  "lastName": "Pérez",
  "dateOfBirth": "15/05/1995",
  "phone": "+5493511234567",
  "country": "AR",
  "du": "12345678"
}
```

> [!IMPORTANT]  
> - **`country`**: Debe ser un valor válido del enumerador: `"AR"`, `"PE"`, `"CO"` o `"MX"`. (Por defecto es `"AR"` si se omite, pero se recomienda enviarlo explícitamente).
> - **`du`** (Documento Único): Su validación (Regex) cambia dinámicamente según el país enviado:
>   - **AR**: 7 u 8 dígitos.
>   - **PE**: 8 dígitos.
>   - **CO**: 8 a 10 dígitos.
>   - **MX**: 10 a 18 caracteres alfanuméricos.

---

## 2. Nueva Estructura de Respuesta en Endpoints de Autenticación

Los endpoints `POST /auth/register`, `POST /auth/login`, `POST /auth/google` y `GET /auth/me` ahora devuelven una estructura mucho más enriquecida para evitar que el frontend deba hacer peticiones extra para obtener el CVU/Alias.

### 📤 Respuesta Exitosa (200 / 201)
*Antes se devolvía un string suelto `walletId`. Ahora se devuelve un objeto `wallet` completo.*

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": {
      "id": "uuid-del-usuario",
      "email": "usuario@mail.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "dateOfBirth": "15/05/1995",
      "phone": "+5493511234567",
      "country": "AR",
      "du": "12345678"
    },
    "wallet": {
      "id": "uuid-de-la-billetera",
      "cvu": "0000123400000000000056",
      "alias": "valora.juan.482"
    }
  }
}
```

> [!WARNING]  
> **Acción requerida (Front):** Actualizar el mapeo de variables. Donde antes leían `response.data.walletId`, ahora deben leer `response.data.wallet.id`. Además, ya pueden acceder a `response.data.wallet.cvu` y `response.data.wallet.alias` directamente en el Login/Registro para poblar la UI.

---

## 3. Nuevo Endpoint: Edición de Alias

Al registrarse, el backend genera un alias por defecto (ej. `valora.juan.482`). Hemos implementado un endpoint para que el usuario pueda cambiarlo por uno personalizado.

- **Método:** `PUT`
- **Ruta:** `/wallet/alias`
- **Headers Requeridos:** `Authorization: Bearer <token>`

### 📥 Payload (Body)
```json
{
  "alias": "juan.perez.valora"
}
```
*El alias debe tener entre 6 y 100 caracteres. Solo puede contener letras minúsculas, números y puntos (`.`).*

### 📤 Respuestas
- **200 OK:** El alias se actualizó correctamente y retorna el objeto de la wallet actualizado.
- **409 Conflict:** El alias elegido ya está en uso por otra persona.

```json
// Ejemplo de Error 409
{
  "success": false,
  "error": "DuplicateAliasError",
  "message": "Este alias ya está en uso por otro usuario."
}
```

> [!TIP]  
> **Acción requerida (Front):** Implementar la UI (modal o sección de configuración) para editar el alias. Asegúrense de manejar el código `409` para mostrar un mensaje amigable indicando que el alias no está disponible.
