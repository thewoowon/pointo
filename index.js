/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {initializeAppCheck} from './src/services/appCheck';

// App Check는 Firestore/Auth 첫 요청보다 먼저 시작되어야 한다. 컴포넌트의
// useEffect는 이미 늦을 수 있어(AuthContext가 마운트 즉시 세션을 복원한다)
// 엔트리에서 건다. await하지 않는 이유는 초기화 실패로 앱 부팅을 막지 않기 위함.
initializeAppCheck();

AppRegistry.registerComponent(appName, () => App);
