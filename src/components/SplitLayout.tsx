import React from 'react';
import {View, StyleSheet, StyleProp, ViewStyle} from 'react-native';
import {useLayoutMode} from '../hooks';

/**
 * Responsive master-detail visibility for a list + detail pair.
 *
 * - expanded → both panels visible side by side (`isSplit`)
 * - compact  → one panel at a time, toggled by `showDetail`
 *
 * Use this hook to adopt the pattern on large existing screens without
 * restructuring their JSX: gate each panel with `showList` / `showDetailPanel`
 * instead of scattering `!isCompact || ...` expressions. For new screens prefer
 * the {@link SplitLayout} component.
 */
export function useMasterDetail(showDetail: boolean) {
  const {isExpanded} = useLayoutMode();
  return {
    isSplit: isExpanded,
    showList: isExpanded || !showDetail,
    showDetailPanel: isExpanded || showDetail,
  } as const;
}

type SplitLayoutProps = {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** compact: which panel is visible. Ignored on expanded (both show). */
  showDetail: boolean;
  /** expanded: fixed detail-panel width. Omit for a flexible (flex:1) panel. */
  detailWidth?: number;
  /** expanded: gap between the two panels. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Master-detail layout primitive. Branches once, at this boundary — callers pass
 * plain `list` / `detail` nodes and never check the layout mode themselves.
 *
 * - expanded → `[ list | detail ]` side by side
 * - compact  → single panel, `showDetail ? detail : list`
 */
export function SplitLayout({
  list,
  detail,
  showDetail,
  detailWidth,
  gap,
  style,
}: SplitLayoutProps) {
  const {isExpanded} = useLayoutMode();

  if (isExpanded) {
    return (
      <View style={[styles.row, gap != null ? {gap} : null, style]}>
        <View style={styles.flex}>{list}</View>
        <View style={detailWidth != null ? {width: detailWidth} : styles.flex}>
          {detail}
        </View>
      </View>
    );
  }

  return <View style={[styles.flex, style]}>{showDetail ? detail : list}</View>;
}

const styles = StyleSheet.create({
  row: {flex: 1, flexDirection: 'row'},
  flex: {flex: 1},
});

export default SplitLayout;
