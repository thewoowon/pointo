import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  FlexAlignType,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAnalytics, useLayoutMode, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {SLIDES, type Slide} from './slides';
import {markOnboardingSeen, type OnboardingSlot} from './storage';

/** 슬롯별로 온보딩이 끝난 뒤 갈 곳. replay는 왔던 화면으로 되돌아간다. */
const NEXT_ROUTE: Record<OnboardingSlot, string | null> = {
  intro: 'Login',
  setup: 'Switcher',
  replay: null,
};

type Styles = ReturnType<typeof createStyles>;

/** 목업 영역의 실측 크기 */
type Box = {w: number; h: number};

/**
 * 4장짜리 사용법 온보딩.
 *
 * 핵심 메시지는 2번 장표다 — "적립하려면 관리자 화면과 고객 화면이 둘 다 켜져
 * 있어야 한다". 기기를 한 대만 두고 관리자/고객 중 하나로 들어간 점주는 아무것도
 * 할 수 없는데, 그 이유를 화면 안 어디에서도 설명해주지 않아서 그대로 이탈한다.
 * 3·4번은 그 다음 질문("기기가 한 대뿐인데?")에 대한 답 — 거치용 여분 기기, 또는
 * 고객 폰을 두 번째 기기로 쓰는 QR.
 */
const OnboardingScreen = ({navigation, route}: any) => {
  const slot: OnboardingSlot = route?.params?.slot ?? 'intro';

  const theme = useTheme();
  const {isExpanded, width} = useLayoutMode();
  const styles = useMemo(
    () => createStyles(theme, isExpanded),
    [theme, isExpanded],
  );

  const {logEvent} = useAnalytics();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    logEvent('onboarding_started', {slot});
    // 진입 시 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 회전하면 페이지 폭이 바뀐다. 스크롤 오프셋은 옛 폭 기준이라 그대로 두면
  // 페이지 중간에 걸린다 — 현재 인덱스로 다시 스냅시킨다.
  useEffect(() => {
    listRef.current?.scrollToOffset({offset: index * width, animated: false});
    // width 변화에만 반응 (index 변화는 스크롤이 이미 처리했다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const finish = useCallback(async () => {
    logEvent('onboarding_completed', {slot});
    await markOnboardingSeen(slot);
    const next = NEXT_ROUTE[slot];
    if (next) {
      navigation.reset({index: 0, routes: [{name: next}]});
    } else {
      navigation.goBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, navigation]);

  const handleNext = async () => {
    if (isLast) {
      await finish();
      return;
    }
    listRef.current?.scrollToIndex({index: index + 1, animated: true});
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.container10}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.progress}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.id}
              style={[styles.progressBar, i === index && styles.progressBarOn]}
            />
          ))}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={s => s.id}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={({item}) => (
            <View style={[styles.page, {width}]}>
              <Text style={styles.title}>{item.title}</Text>
              {!!item.subtitle && (
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              )}
              <SlideMedia
                slide={item}
                isExpanded={isExpanded}
                styles={styles}
              />
            </View>
          )}
        />

        <View style={styles.footer}>
          <Pressable
            onPress={handleNext}
            hitSlop={12}
            style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
            <Text style={styles.footerText}>{isLast ? '완료' : '다음'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
};

/**
 * 장표마다 목업을 놓는 방식이 다르다. 3·4번은 목업을 화면 밖으로 흘려보내고
 * 부모의 overflow:'hidden'으로 잘라낸다.
 *
 * 크기는 영역을 실측해서 두 변을 모두 숫자로 못 박는다. RN Image는 한 변만
 * 지정하면 나머지를 원본 픽셀 크기로 잡아버리고(aspectRatio도 이 경우엔 먹지
 * 않는다), 그러면 목업이 화면의 두 배 크기로 튀어나온다.
 */
const SlideMedia = ({
  slide,
  isExpanded,
  styles,
}: {
  slide: Slide;
  isExpanded: boolean;
  styles: Styles;
}) => {
  const media = slide.media;
  const [box, setBox] = useState<Box | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const {width: w, height: h} = e.nativeEvent.layout;
    setBox(prev => (prev && prev.w === w && prev.h === h ? prev : {w, h}));
  }, []);

  const extra =
    media.kind === 'pair'
      ? styles.mediaRow
      : media.kind === 'wide'
      ? styles.mediaBottom
      : media.kind === 'callout'
      ? [styles.mediaRow, styles.mediaTop]
      : null;

  return (
    <View style={[styles.media, extra]} onLayout={handleLayout}>
      {!!box && renderMedia(slide, isExpanded, styles, box)}
    </View>
  );
};

const renderMedia = (
  slide: Slide,
  isExpanded: boolean,
  styles: Styles,
  box: Box,
) => {
  const media = slide.media;

  switch (media.kind) {
    case 'single':
      return (
        <Image
          source={isExpanded ? media.expanded : media.compact}
          style={{width: box.w, height: box.h}}
          resizeMode="contain"
        />
      );

    case 'pair': {
      const [customer, supervisor] = isExpanded
        ? media.expanded
        : media.compact;
      return (
        <>
          <Image
            source={customer}
            style={styles.pairItem}
            resizeMode="contain"
          />
          <Image
            source={supervisor}
            style={styles.pairItem}
            resizeMode="contain"
          />
        </>
      );
    }

    case 'wide': {
      // 모바일: 폭을 화면보다 넉넉히 키워 양옆을 잘라낸다. 왼쪽을 조금만 잘라서
      // 사람이 화면 왼쪽 끝에 붙어 서 있는 구도를 만든다(디자인).
      // 태블릿: 자를 필요 없이 영역 안에 가운데로 앉힌다.
      const target = isExpanded ? box.w * 0.58 : box.w * 1.55;
      const h = Math.min(target / media.aspect, box.h);
      const w = h * media.aspect;
      const marginLeft = isExpanded ? 0 : -(w - box.w) * 0.3;
      const alignSelf: FlexAlignType = isExpanded ? 'center' : 'flex-start';
      return (
        <Image
          source={media.source}
          style={{width: w, height: h, marginLeft, alignSelf}}
          resizeMode="contain"
        />
      );
    }

    case 'callout': {
      // 목업을 왼쪽으로 흘리고, 남는 자리에 QR 버튼을 가리키는 캡션.
      const aspect = isExpanded ? media.aspect.expanded : media.aspect.compact;
      const w = isExpanded ? box.w * 0.72 : box.h * aspect;
      const h = w / aspect;
      return (
        <>
          <Image
            source={isExpanded ? media.expanded : media.compact}
            style={{width: w, height: h, marginLeft: -w * 0.1}}
            resizeMode="contain"
          />
          <Text style={styles.caption}>{media.caption}</Text>
        </>
      );
    }
  }
};

const createStyles = (t: Theme, isExpanded: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.color.surface.normal.container10,
    },
    safeArea: {
      flex: 1,
    },

    progress: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: t.spacing[3],
      marginTop: isExpanded ? t.spacing[10] : t.spacing[6],
    },
    progressBar: {
      width: isExpanded ? 82 : 68,
      height: 3,
      borderRadius: t.radius.full,
      backgroundColor: t.palette.slate[300],
    },
    progressBarOn: {
      backgroundColor: t.palette.slate[600],
    },

    page: {
      flex: 1,
      paddingTop: isExpanded ? t.spacing[16] : t.spacing[12],
    },
    title: {
      fontSize: isExpanded ? 22 : 20,
      lineHeight: isExpanded ? 33 : 30,
      fontFamily: t.font.bold,
      color: t.color.texticon.onNormal.highestemp,
      textAlign: 'center',
      paddingHorizontal: t.spacing[6],
    },
    subtitle: {
      marginTop: t.spacing[4],
      fontSize: isExpanded ? 16 : 15,
      lineHeight: isExpanded ? 26 : 24,
      fontFamily: t.font.regular,
      color: t.color.texticon.onNormal.midemp,
      textAlign: 'center',
      paddingHorizontal: t.spacing[6],
    },

    // 목업이 놓이는 영역. 가로 패딩이 없다 — 화면 밖으로 흘리는 연출을 위해
    // 여기서 잘라낸다.
    media: {
      flex: 1,
      marginTop: isExpanded ? t.spacing[10] : t.spacing[8],
      overflow: 'hidden',
    },
    mediaRow: {
      flexDirection: 'row',
    },
    mediaBottom: {
      justifyContent: 'flex-end',
    },
    mediaTop: {
      alignItems: 'flex-start',
    },
    pairItem: {
      flex: 1,
      height: '100%',
      marginHorizontal: isExpanded ? t.spacing[6] : t.spacing[2],
    },
    caption: {
      flex: 1,
      marginTop: isExpanded ? t.spacing[16] : t.spacing[10],
      marginLeft: t.spacing[3],
      marginRight: t.spacing[4],
      fontSize: isExpanded ? 17 : 15,
      lineHeight: isExpanded ? 26 : 23,
      fontFamily: t.font.bold,
      color: t.color.texticon.onNormal.highestemp,
    },

    footer: {
      alignItems: 'center',
      paddingVertical: isExpanded ? t.spacing[8] : t.spacing[6],
    },
    footerText: {
      fontSize: isExpanded ? 17 : 16,
      fontFamily: t.font.semibold,
      color: t.color.texticon.onNormal.primary,
    },
  });

export default OnboardingScreen;
