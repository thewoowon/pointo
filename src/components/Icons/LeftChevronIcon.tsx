import React from 'react';
import Svg, {Path} from 'react-native-svg';

/** 뒤로가기용 왼쪽 꺾쇠 */
const LeftChevronIcon = ({width = 24, height = 24, color = '#1F1F1F'}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 5L8 12L15 19"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default LeftChevronIcon;
