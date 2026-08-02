import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

const ClockIcon = ({width = 28, height = 28, color = '#2974FF'}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path
      d="M12 7.5V12L15 13.8"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ClockIcon;
