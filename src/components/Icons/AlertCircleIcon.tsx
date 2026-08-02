import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

const AlertCircleIcon = ({width = 28, height = 28, color = '#EF4444'}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
    <Path
      d="M12 7.5V12.5"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Circle cx="12" cy="16" r="1.15" fill={color} />
  </Svg>
);

export default AlertCircleIcon;
