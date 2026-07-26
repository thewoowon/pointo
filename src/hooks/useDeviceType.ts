import {useLayoutMode} from './useLayoutMode';

export type DeviceType = 'phone' | 'tablet';

/**
 * @deprecated Prefer {@link useLayoutMode} (compact / expanded). Kept as a thin
 * alias so existing callers keep working: phone = compact, tablet = expanded,
 * same 768 threshold. New code should branch on layout mode, not device class.
 */
const useDeviceType = (): DeviceType =>
  useLayoutMode().isExpanded ? 'tablet' : 'phone';

export default useDeviceType;
