import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getExchangeRates } from "../services/exchangeRateService.js";

describe("Exchange Rate Service Integration Tests", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        // Clear all mocks before each test to ensure deterministic behavior
        vi.restoreAllMocks();
    });

    afterEach(() => {
        // Restore the original fetch implementation
        global.fetch = originalFetch;
    });

    it("should throw an error when the external API fails and cache is empty (Unhappy Path)", async () => {
        // Mocking fetch to simulate a 500 Internal Server Error from Frankfurter API
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        }) as typeof fetch;

        // We expect the service to fail gracefully and throw our custom Spanish error
        await expect(getExchangeRates()).rejects.toThrow(
            "Imposible realizar cotización porque las cotizaciones se cayeron o no hay forma de cotizar"
        );
    });
});