import { describe, expect, it } from "vitest";
import { DOCUMENTO_POR_PAIS, validarDocumento } from "../utils/documentValidation";

describe("documentValidation", () => {
  it("tiene los 19 países de LATAM mapeados", () => {
    expect(Object.keys(DOCUMENTO_POR_PAIS)).toHaveLength(19);
  });

  it("acepta un documento alfanumérico de 5 a 15 caracteres para un país conocido", () => {
    const result = validarDocumento("12345678", "AR");
    expect(result).toEqual({ valido: true, label: "DNI" });
  });

  it("acepta un documento válido para un país fuera del set original (Brasil)", () => {
    const result = validarDocumento("A1B2C3D4E5", "BR");
    expect(result).toEqual({ valido: true, label: "CPF" });
  });

  it("rechaza un documento demasiado corto (menos de 5 caracteres)", () => {
    const result = validarDocumento("1234", "AR");
    expect(result.valido).toBe(false);
  });

  it("rechaza un documento demasiado largo (más de 15 caracteres)", () => {
    const result = validarDocumento("1234567890123456", "UY");
    expect(result.valido).toBe(false);
  });

  it("rechaza un documento con caracteres no alfanuméricos", () => {
    const result = validarDocumento("1234-5678", "AR");
    expect(result.valido).toBe(false);
  });

  it("usa el label 'Documento' por defecto si el país no está en el mapa", () => {
    const result = validarDocumento("12345678", "US");
    expect(result).toEqual({ valido: true, label: "Documento" });
  });
});
