// Global test setup for Vitest
// Prisma mocking is handled per test file via vi.mock + createMockPrisma()

import { vi } from "vitest"

// geoloc.ts does a dynamic import("maxmind") that fails in test environment
// because maxmind is not installed. Mock it globally so it resolves to null.
vi.mock("maxmind", () => ({ default: {} }))
