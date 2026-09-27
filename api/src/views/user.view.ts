import type { UserRow } from '../models/user.model';
import type { VehicleRow } from '../models/vehicle.model';

// Never leaks password_hash: the view whitelists fields instead of deleting some.
export function userView(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    walletBalancePaisa: u.wallet_balance_paisa,
  };
}

export function vehicleView(v: VehicleRow) {
  return {
    id: v.id,
    name: v.name,
    plate: v.plate,
    capacity: v.capacity,
    isOnline: v.is_online,
    currentZoneId: v.current_zone_id,
  };
}
