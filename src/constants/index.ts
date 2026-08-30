/**
 * 앱 버전. package.json을 단일 출처로 삼는다 — 상수로 따로 적어두면 릴리즈마다
 * 같이 올리는 걸 잊고 어긋나고, 그러면 의견 보내기에 실려 오는 버전이 거짓말을
 * 해서 재현 자체가 불가능해진다.
 */
import {version} from '../../package.json';

export const APP_VERSION: string = version;
