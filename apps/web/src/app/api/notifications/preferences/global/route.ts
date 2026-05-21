/**
 * GET/PATCH /api/notifications/preferences/global
 * Alias that re-exports the parent preferences handler.
 * Some clients call this URL for workspace-level default preferences.
 */
export { GET, PATCH } from '../route'
