import {useWindowDimensions} from 'react-native';

export type DeviceType = 'phone' | 'tablet';

const TABLET_BREAKPOINT = 768;

const useDeviceType = (): DeviceType => {
  const {width} = useWindowDimensions();
  return width >= TABLET_BREAKPOINT ? 'tablet' : 'phone';
};

export default useDeviceType;
