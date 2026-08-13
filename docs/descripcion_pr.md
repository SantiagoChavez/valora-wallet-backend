# Propuesta de PR: Security Patches (Anti-PO) & Rate Limiting

## Título del PR
`feat(security): implementar mitigación de salami slicing, topes numéricos y rate limiting`

## Descripción del PR

Este PR implementa una serie de parches de seguridad críticos diseñados específicamente para acorazar la lógica financiera del backend frente a vulnerabilidades de negocio (ataques que buscarían quebrar la plataforma a nivel lógico o matemático).

### 🚀 Cambios Principales

#### 1. Prevención de Salami Slicing (Micro-extracciones)
- Se aplicó una comisión/spread estricta del **1%** en todas las operaciones de conversión de moneda (`EXCHANGE`, `BUY`, `SELL`) dentro de `transactionService.ts`. 
- **Objetivo:** Inhabilitar ataques de alta frecuencia donde un actor malicioso aprovecha redondeos favorables a costo cero. Toda conversión de ida y vuelta genera pérdida, protegiendo las arcas del sistema.

#### 2. Prevención de Number Overflow (IEEE 754)
- Se ajustaron los esquemas de validación de Zod (`transactionSchema.ts`) añadiendo el modificador `.max(1_000_000)` al campo `amount`.
- **Objetivo:** Evitar el colapso del sistema y desbordamientos matemáticos que ocurrirían si se envían cifras excesivas (ej. `999999999999.99`) que corromperían la precisión flotante de Node o la base de datos `NUMERIC(18,8)`.

#### 3. Prevención de DoS y Fallback Spoofing (Rate Limiting)
- Se implementó el middleware `express-rate-limit` a nivel global en `app.ts`.
- Límite configurado a **100 peticiones cada 15 minutos por IP**.
- **Objetivo:** Neutralizar cualquier intento de denegación de servicio (DoS) o spam masivo destinado a agotar recursos del backend o saturar el límite de peticiones hacia las APIs proveedoras externas.

#### 4. Consistencia Matemática y Correcciones Internas
- Se forzó el uso estricto de `.toFixed(8)` seguido de un cast a `Number` en las etapas finales del cálculo transaccional. Esto erradica la acumulación de basura de punto flotante de JavaScript que pudiera desencadenar crashes al insertar en PostgreSQL.
- Se refactorizó y limpió el bloque matemático de `executeConversion` para una lectura más limpia.

---

### 🧪 Verificación de Calidad
- **Tests (103/103):** Se actualizaron las aserciones en `transactions.test.ts` para que coincidan exitosamente con la merma del 1% en la creación de saldos objetivo y cotizaciones. Todo en verde.
