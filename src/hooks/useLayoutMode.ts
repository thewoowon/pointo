import {useWindowDimensions} from 'react-native';

export type LayoutMode = 'compact' | 'expanded';

// Single source of truth for responsive branching.
//
// 768 = tablet threshold. It matches the breakpoint already used across the app
// (previously scattered as inline `screenWidth < 768` and inside useDeviceType),
// so switching to this hook preserves existing layout behavior.
//
// Branch on layout *mode* at screen / navigator boundaries — not on device class
// (`isTablet`). Window width reflects reality: an iPad in Split View can be
// compact, and we want it to lay out as compact.
export const BREAKPOINTS = {
  expanded: 768,
} as const;

export function useLayoutMode() {
  const {width, height, fontScale} = useWindowDimensions();
  const mode: LayoutMode = width >= BREAKPOINTS.expanded ? 'expanded' : 'compact';

  return {
    mode,
    width,
    height,
    fontScale,
    isCompact: mode === 'compact',
    isExpanded: mode === 'expanded',
  } as const;
}

export default useLayoutMode;
