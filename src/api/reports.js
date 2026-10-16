import { post, request } from './exercises';

// Segnalazioni dei contenuti nei gruppi, lato admin (backend/api/admin/reports.php).
// status: 'open' | 'resolved' | 'dismissed'
export const listAdminReports = (status = 'open') =>
  request(`admin/reports.php?status=${encodeURIComponent(status)}`);

// action: 'resolve' | 'dismiss' | 'rename_group' {name} | 'rename_user' {username}; note obbligatoria
export const adminReportAction = (action, id, extra = {}) => post('admin/reports.php', { action, id, ...extra });
