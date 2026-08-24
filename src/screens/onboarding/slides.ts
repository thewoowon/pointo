import type {ImageSourcePropType} from 'react-native';

/**
 * 온보딩 4장의 내용. 이미지는 디자인이 준 목업을 그대로 쓴다 —
 * 2번(고객/관리자 화면)은 말풍선과 "고객 화면 / 관리자 화면" 라벨까지
 * 이미지에 박혀 있어서 코드에서 다시 그리지 않는다.
 *
 * `aspect`는 원본 이미지의 w/h. 화면 밖으로 흘려보내는(bleed) 연출에
 * 필요해서 들고 있다 — 그런 슬라이드는 한 변만 %로 주고 나머지는
 * aspectRatio로 파생시키므로, 측정 없이 어느 기기에서도 비율이 맞는다.
 */
export type SlideMedia =
  /** 목업 한 장을 통째로 보여준다 (여백 안에 contain) */
  | {kind: 'single'; compact: Source; expanded: Source}
  /** 고객 화면 / 관리자 화면 두 장을 나란히 */
  | {kind: 'pair'; compact: [Source, Source]; expanded: [Source, Source]}
  /** 일러스트를 가로로 꽉 채우고 양옆을 잘라낸다 */
  | {kind: 'wide'; source: Source; aspect: number}
  /** 목업을 왼쪽으로 흘리고 오른쪽에 캡션 */
  | {
      kind: 'callout';
      compact: Source;
      expanded: Source;
      aspect: {compact: number; expanded: number};
      caption: string;
    };

type Source = ImageSourcePropType;

export type Slide = {
  id: string;
  title: string;
  subtitle?: string;
  media: SlideMedia;
};

export const SLIDES: Slide[] = [
  {
    id: 'what',
    title: '포인토는 POS 설치 없이\n간편하게 단골 관리를 할 수 있는\n서비스에요',
    media: {
      kind: 'single',
      compact: require('../../assets/images/onboarding/mobile/pointo_mobile_onboarding_1.png'),
      expanded: require('../../assets/images/onboarding/tablet/pointo_tablet_onboarding_1.png'),
    },
  },
  {
    id: 'two-devices',
    title: '포인트를 적립 또는 사용할 때에는\n관리자님과 고객님의 화면이\n모두 켜져 있어야해요',
    media: {
      kind: 'pair',
      compact: [
        require('../../assets/images/onboarding/mobile/pointo_mobile_onboarding_2-1.png'),
        require('../../assets/images/onboarding/mobile/pointo_mobile_onboarding_2-2.png'),
      ],
      expanded: [
        require('../../assets/images/onboarding/tablet/pointo_tablet_onboarding_2-1.png'),
        require('../../assets/images/onboarding/tablet/pointo_tablet_onboarding_2-2.png'),
      ],
    },
  },
  {
    id: 'qr-fallback',
    title: '여분의\n고객용 기기가 없다면?',
    subtitle:
      '관리자모드에서 QR을 고객님께 보여드리면\n고객님의 스마트폰에서 번호입력이 가능해요',
    media: {
      kind: 'callout',
      compact: require('../../assets/images/onboarding/mobile/pointo_mobile_onboarding_4.png'),
      expanded: require('../../assets/images/onboarding/tablet/pointo_tablet_onboarding_4.png'),
      aspect: {compact: 665 / 1404, expanded: 1752 / 1231},
      caption: '누르면\nQR화면이 나와요',
    },
  },
  {
    id: 'kiosk',
    title: '키오스크처럼 사용할 수 있는\n여분의 기기가 있다면\n매장에 거치해두고 사용해요',
    subtitle: '대기모드에서 터치만 하면\n바로 번호입력!',
    media: {
      kind: 'wide',
      // 모바일·태블릿이 같은 원본을 쓴다 (디자인 제공 그대로)
      source: require('../../assets/images/onboarding/mobile/pointo_mobile_onboarding_3.png'),
      aspect: 1448 / 1086,
    },
  },
];
