import SupervisorScreen from '../screens/supervisor';
import ClientScreen from '../screens/client';

/**
 * 로그인 후 진입하는 메인 영역. 탭바는 노출하지 않고 mode에 따라
 * 관리자(Supervisor) / 고객(Client) 스택 중 하나만 렌더한다.
 * mode가 바뀌면 컴포넌트 타입이 바뀌어 자연스럽게 새로 마운트된다.
 */
const MainTab = ({mode}: {mode: 'supervisor' | 'client'}) =>
  mode === 'supervisor' ? <SupervisorScreen /> : <ClientScreen />;

export default MainTab;
