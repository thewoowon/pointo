import React from 'react';
import Svg, {Path, Rect} from 'react-native-svg';

// 고객 셀프 서비스용 QR 코드 진입 아이콘 (포인토 웹 링크).
const QrIcon = ({width = 24, height = 24, color = 'black'}) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* 좌상단 파인더 */}
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 5C3 3.89543 3.89543 3 5 3H8C9.10457 3 10 3.89543 10 5V8C10 9.10457 9.10457 10 8 10H5C3.89543 10 3 9.10457 3 8V5ZM8 5H5V8H8V5Z"
      fill={color}
    />
    {/* 우상단 파인더 */}
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 5C14 3.89543 14.8954 3 16 3H19C20.1046 3 21 3.89543 21 5V8C21 9.10457 20.1046 10 19 10H16C14.8954 10 14 9.10457 14 8V5ZM19 5H16V8H19V5Z"
      fill={color}
    />
    {/* 좌하단 파인더 */}
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 16C3 14.8954 3.89543 14 5 14H8C9.10457 14 10 14.8954 10 16V19C10 20.1046 9.10457 21 8 21H5C3.89543 21 3 20.1046 3 19V16ZM8 16H5V19H8V16Z"
      fill={color}
    />
    {/* 우하단 데이터 모듈 */}
    <Rect x="14" y="14" width="3" height="3" rx="0.5" fill={color} />
    <Rect x="18" y="14" width="3" height="3" rx="0.5" fill={color} />
    <Rect x="14" y="18" width="3" height="3" rx="0.5" fill={color} />
    <Rect x="18" y="18" width="3" height="3" rx="0.5" fill={color} />
  </Svg>
);

export default QrIcon;
