// Shared MSW server: intercepts fetch at the network layer, so tests exercise the real api client.
import { setupServer } from 'msw/node'

export const server = setupServer()
