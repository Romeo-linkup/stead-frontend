import { getCurrentUser } from '../auth/session.js';

export function canActOrgWide(user = getCurrentUser()) {
  if (!user) return false;
  if (user.role === 'owner') return true;
  if (user.role === 'admin' && user.all_districts === true) return true;
  return false;
}

export function userDistrictIds(user = getCurrentUser()) {
  if (!user) return [];
  if (user.role === 'owner') return null;
  if (user.role === 'admin' && user.all_districts === true) return null;
  if (Array.isArray(user.district_ids) && user.district_ids.length > 0) return user.district_ids;
  if (user.district_id != null) return [user.district_id];
  return [];
}

export function seeMultipleDistricts(user = getCurrentUser()) {
  if (!user) return false;
  if (canActOrgWide(user)) return true;
  const ids = userDistrictIds(user);
  return ids.length > 1;
}
