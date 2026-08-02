import React, {useMemo} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLayoutMode, useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {
  CircleMinusIcon,
  CirclePlusIcon,
  LeftArrowIcon,
  NewXIcon,
  RefreshIcon,
} from '../../components/Icons';
import LinearGradient from 'react-native-linear-gradient';
import {totalSelected} from '../../utils/coupons';
import {useGivePoint} from './useGivePoint';

const NUMBER_SEQUENCE = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const DetailView = ({
  phoneNumber,
  updateLogs,
}: {
  navigation: any;
  phoneNumber: string;
  onClose: () => void;
  updateLogs: () => void;
}) => {
  const {isCompact} = useLayoutMode();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    storeConfig,
    isPointMode,
    mode,
    number,
    user,
    userContext,
    setNumber,
    switchMode,
    refresh,
    onNumberPress,
    onClickCoupon,
    phoneNumberLabel,
    close,
    handleApprove,
    handleApprovePoint,
    handleUsing,
    handleUsingPoint,
  } = useGivePoint(phoneNumber, updateLogs);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.innerContainer}>
          <View
            style={[
              styles.flexRowBox,
              {
                backgroundColor: theme.color.surface.normal.bg1,
                // shadow
                shadowColor: theme.color.etc.absolute.black,
                shadowOffset: {
                  width: 0,
                  height: 6,
                },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 10,
                borderRadius: 35,
                paddingVertical: isCompact ? 48 : 0,
                paddingHorizontal: isCompact ? 24 : 0,
              },
            ]}>
            <Pressable
              onPress={close}
              style={[
                styles.flexBox,
                {gap: 4, position: 'absolute', top: isCompact ? 24 : 32, right: isCompact ? 24 : 32, zIndex: 10},
              ]}>
              <Text
                style={{
                  fontSize: isCompact ? 14 : 20,
                  fontFamily: theme.font.regular,
                  color: theme.color.texticon.onNormal.highemp,
                  lineHeight: isCompact ? 20 : 28,
                }}>
                닫기
              </Text>
              <NewXIcon width={isCompact ? 16 : 20} height={isCompact ? 16 : 20} />
            </Pressable>
            <ScrollView
              // 스크롤 할 때 스크롤바가 보이지 않도록 설정
              showsVerticalScrollIndicator={false}
              style={{flex: 1}}
              contentContainerStyle={[
                {
                  display: 'flex',
                  flexDirection: isCompact ? 'column' : 'row',
                  justifyContent: 'center',
                  alignItems: isCompact ? 'center' : undefined,
                  gap: isCompact ? 16 : 110,
                  paddingBottom: isCompact ? 24 : 0,
                  paddingHorizontal: isCompact ? 4 : 0,
                },
              ]}>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    width: isCompact ? '100%' : 320,
                    height: 'auto',
                    gap: isCompact ? 6 : 10,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: isCompact ? 8 : 54,
                  },
                ]}>
                <Text style={[styles.labelSubText, isCompact && {fontSize: 14, lineHeight: 20}]}>
                  {`고객번호: `}
                  <Text
                    style={[
                      styles.labelSubText,
                      {
                        color: theme.color.texticon.onNormal.primary,
                        fontFamily: 'SFUIDisplay-Semibold',
                      },
                      isCompact && {fontSize: 14, lineHeight: 20},
                    ]}>
                    {phoneNumberLabel()}
                  </Text>
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: theme.color.surface.normal.container10,
                    borderRadius: isCompact ? 10 : 14,
                    padding: isCompact ? 3 : 4,
                    alignSelf: 'stretch',
                    marginBottom: isCompact ? 2 : 4,
                  }}>
                  <Pressable
                    onPress={() => switchMode('earn')}
                    style={{
                      flex: 1,
                      paddingVertical: isCompact ? 7 : 10,
                      borderRadius: isCompact ? 8 : 11,
                      backgroundColor:
                        mode === 'earn' ? theme.color.surface.normal.bg1 : 'transparent',
                      shadowColor: mode === 'earn' ? theme.color.etc.absolute.black : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'earn' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'earn' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: isCompact ? 14 : 18,
                        fontFamily:
                          mode === 'earn'
                            ? theme.font.bold
                            : theme.font.medium,
                        color: mode === 'earn' ? theme.color.texticon.onNormal.highestemp : theme.color.texticon.onNormal.midemp,
                        letterSpacing: -0.2,
                      }}>
                      적립
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('use')}
                    style={{
                      flex: 1,
                      paddingVertical: isCompact ? 7 : 10,
                      borderRadius: isCompact ? 8 : 11,
                      backgroundColor:
                        mode === 'use' ? theme.color.surface.normal.bg1 : 'transparent',
                      shadowColor: mode === 'use' ? theme.color.etc.absolute.black : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'use' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'use' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: isCompact ? 14 : 18,
                        fontFamily:
                          mode === 'use'
                            ? theme.font.bold
                            : theme.font.medium,
                        color: mode === 'use' ? theme.color.texticon.onNormal.highestemp : theme.color.texticon.onNormal.midemp,
                        letterSpacing: -0.2,
                      }}>
                      사용
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.labelBox}>
                  <Text style={[styles.labelTitleText, isCompact && {fontSize: 20, lineHeight: 28}]}>
                    {mode === 'earn'
                      ? isPointMode
                        ? '적립할 포인트를'
                        : '적립할 스탬프 개수를'
                      : isPointMode
                      ? '사용할 포인트를'
                      : '사용할 쿠폰을'}
                  </Text>
                  <Text style={[styles.labelTitleText, isCompact && {fontSize: 20, lineHeight: 28}]}>
                    {mode === 'earn'
                      ? '입력해주세요'
                      : isPointMode
                      ? '입력해주세요'
                      : '선택해주세요'}
                  </Text>
                </View>
                {mode === 'use' && !isPointMode && (
                  <View style={styles.beverageWrapper}>
                    {storeConfig.couponTypes.map(ct => {
                      const remaining =
                        (userContext.possibleCoupons[ct.id] ?? 0) -
                        (userContext.selectedCoupon[ct.id] ?? 0);
                      if (remaining <= 0) return null;
                      return (
                        <View key={ct.id} style={styles.beverageBox}>
                          <View>
                            <Text style={styles.beverageTitleText}>
                              {ct.name} {remaining}장
                            </Text>
                            <Text style={styles.beverageBodyText}>
                              무료 사용가능
                            </Text>
                          </View>
                          <Pressable onPress={onClickCoupon(ct.id)}>
                            <Text style={styles.beverageButtonText}>선택</Text>
                          </Pressable>
                          {remaining > 1 && (
                            <View style={styles.countBadge}>
                              <LinearGradient
                                colors={[theme.color.surface.brand.primary, theme.palette.blue[600]]}
                                locations={[0.4, 1]}
                                start={{x: 0, y: 1}}
                                end={{x: 1, y: 1}}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'row',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderRadius: 20,
                                }}>
                                <Text style={styles.badgeText}>
                                  {remaining}
                                </Text>
                              </LinearGradient>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {isPointMode &&
                  mode === 'earn' &&
                  storeConfig.pointPresets.length > 0 && (
                    <View style={styles.beverageWrapper}>
                      <Text style={styles.beverageBodyText}>빠른 적립</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 10,
                          width: '100%',
                        }}>
                        {storeConfig.pointPresets.map(preset => (
                          <Pressable
                            key={preset.id}
                            onPress={() => setNumber(String(preset.points))}
                            style={({pressed}) => ({
                              backgroundColor:
                                number === String(preset.points)
                                  ? theme.color.texticon.onNormal.primary
                                  : pressed
                                  ? theme.palette.gray[200]
                                  : theme.color.surface.normal.container10,
                              paddingHorizontal: 20,
                              paddingVertical: 14,
                              borderRadius: 14,
                              minWidth: 100,
                              alignItems: 'center',
                            })}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: theme.font.semibold,
                                color:
                                  number === String(preset.points)
                                    ? theme.color.surface.normal.bg1
                                    : theme.color.texticon.onNormal.highestemp,
                                letterSpacing: -0.2,
                              }}>
                              {preset.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: theme.font.regular,
                                color:
                                  number === String(preset.points)
                                    ? 'rgba(255,255,255,0.8)'
                                    : theme.color.texticon.onNormal.midemp,
                                marginTop: 2,
                              }}>
                              {preset.points.toLocaleString()}
                              {storeConfig.pointUnit}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
              </View>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    paddingLeft: isCompact ? 10 : 15,
                    paddingRight: isCompact ? 10 : 15,
                    borderRadius: isCompact ? 24 : 35,
                    width: '100%',
                    maxWidth: isCompact ? 340 : 420,
                    height: 'auto',
                    backgroundColor: theme.color.surface.normal.bg1,
                  },
                ]}>
                <View
                  style={[
                    styles.flexColumnBox,
                    {
                      width: '100%',
                      maxWidth: isCompact ? 280 : 320,
                      height: 'auto',
                    },
                  ]}>
                  <View
                    style={[
                      styles.subLabelBox,
                      {
                        width: '100%',
                        gap: isCompact ? 40 : 120,
                        marginBottom: isCompact ? 4 : 9,
                        justifyContent: 'flex-end',
                        paddingRight: isCompact ? 4 : 9,
                      },
                    ]}>
                    <Text
                      style={{
                        fontFamily: 'Prentendard-Semibold',
                        color: theme.color.texticon.onNormal.highemp,
                        fontSize: isCompact ? 13 : 16,
                        lineHeight: isCompact ? 20 : 26,
                        letterSpacing: -0.2,
                      }}>
                      {isPointMode ? '현재 보유 포인트' : '현재 보유 스탬프'}
                    </Text>
                    <Text
                      style={{
                        fontSize: isCompact ? 18 : 24,
                        lineHeight: isCompact ? 26 : 32,
                        fontFamily: 'Prentendard-Semibold',
                        color: theme.color.texticon.onNormal.primary,
                      }}>
                      {isPointMode
                        ? `${user.stamps.toLocaleString()}${
                            storeConfig.pointUnit
                          }`
                        : `${user.stamps % storeConfig.stampsPerCoupon}/${
                            storeConfig.stampsPerCoupon
                          }개`}
                    </Text>
                  </View>
                  <View
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 20,
                        paddingLeft: 9,
                        paddingRight: 9,
                      },
                    ]}>
                    <View
                      style={[
                        styles.headerNumberContainer,
                        {
                          width: '100%',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: isCompact ? 4 : 8,
                        },
                      ]}>
                      <View style={styles.headerNumberContainer}>
                        {mode === 'use' &&
                          !isPointMode &&
                          totalSelected(userContext.selectedCoupon) > 0 && (
                            <Text
                              style={{
                                color: theme.color.texticon.onNormal.success,
                              }}>
                              {storeConfig.couponTypes
                                .filter(
                                  ct =>
                                    (userContext.selectedCoupon[ct.id] ?? 0) >
                                    0,
                                )
                                .map(
                                  ct =>
                                    `${ct.name} ${
                                      userContext.selectedCoupon[ct.id]
                                    }장`,
                                )
                                .join(', ')}
                            </Text>
                          )}
                        <Text
                          style={[
                            styles.headerNumberText,
                            {
                              fontSize: isCompact ? 28 : 38,
                              lineHeight: isCompact ? 36 : 48,
                              color: number.length > 0 ? theme.color.texticon.onNormal.highestemp : theme.palette.gray[200],
                            },
                          ]}>
                          {number || '0'}
                        </Text>
                        <Text
                          style={[
                            styles.headerNumberText,
                            {
                              fontFamily: theme.font.semibold,
                            },
                          ]}>
                          {isPointMode
                            ? storeConfig.pointUnit
                            : mode === 'use'
                            ? '장'
                            : '개'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.divisor}></View>
                  </View>
                  <View
                    pointerEvents={
                      mode === 'use' && !isPointMode ? 'none' : 'auto'
                    }
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: isCompact ? 6 : 12,
                        opacity: mode === 'use' && !isPointMode ? 0.25 : 1,
                      },
                    ]}>
                    {NUMBER_SEQUENCE.map((row, rowIndex) => (
                      <View key={rowIndex} style={[styles.numberInputContainer, isCompact && {gap: 8}]}>
                        {row.map((num, numberIndex) => (
                          <Pressable
                            key={numberIndex}
                            style={({pressed}) => [
                              {
                                backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                                borderRadius: 10,
                              },
                              styles.numberInputButton,
                              isCompact && {width: 64, height: 44},
                            ]}
                            onPress={() => onNumberPress(num)}>
                            <Text style={[styles.numberInputText, isCompact && {fontSize: 26}]}>{num}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                    <View style={[styles.numberInputContainer, isCompact && {gap: 8}]}>
                      <Pressable style={[styles.numberInputButton, isCompact && {width: 64, height: 44}]}></Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
                          isCompact && {width: 64, height: 44},
                        ]}
                        onPress={() => onNumberPress(0)}>
                        <Text style={[styles.numberInputText, isCompact && {fontSize: 26}]}>0</Text>
                      </Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
                          isCompact && {width: 64, height: 44},
                        ]}
                        onPress={() => onNumberPress('c')}>
                        <LeftArrowIcon />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.confirmContainer}>
                    {mode === 'use' ? (
                      <>
                        {!isPointMode && (
                          <Pressable
                            style={({pressed}) => [
                              styles.confirmButton,
                              {
                                width: pressed ? 142 : 150,
                                backgroundColor: theme.palette.gray[200],
                                shadowColor: theme.palette.gray[200],
                                gap: 6,
                              },
                            ]}
                            onPress={refresh}>
                            <RefreshIcon />
                            <Text
                              style={[
                                styles.confirmButtonText,
                                {
                                  color: theme.color.texticon.onNormal.highestemp,
                                },
                              ]}>
                              입력 초기화
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={({pressed}) => [
                            styles.confirmButton,
                            {
                              width: isPointMode
                                ? pressed
                                  ? '98%'
                                  : '100%'
                                : pressed
                                ? 142
                                : 150,
                              backgroundColor: theme.color.surface.brand.primary,
                              shadowColor: theme.color.surface.brand.primary,
                            },
                          ]}
                          onPress={
                            isPointMode ? handleUsingPoint : handleUsing
                          }>
                          <LinearGradient
                            colors={[theme.color.surface.brand.primary, theme.palette.blue[700]]}
                            locations={[0.3, 1]}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 1}}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 20,
                            }}>
                            <CircleMinusIcon />
                            <Text style={styles.confirmButtonText}>
                              사용하기
                            </Text>
                          </LinearGradient>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        style={({pressed}) => [
                          styles.confirmButton,
                          {
                            width: pressed ? '98%' : '100%',
                            backgroundColor: theme.palette.green[500],
                            shadowColor: theme.palette.green[500],
                          },
                        ]}
                        onPress={
                          isPointMode ? handleApprovePoint : handleApprove
                        }>
                        <LinearGradient
                          colors={[theme.palette.green[500], theme.palette.green[700]]}
                          locations={[0.3, 1]}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 1}}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: 20,
                          }}>
                          <CirclePlusIcon />
                          <Text style={styles.confirmButtonText}>적립하기</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>

                  <View
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      marginTop: 8,
                      height: 26,
                    }}>
                    {mode === 'earn' ? (
                      <Text style={styles.beverageBodyText}>
                        {isPointMode
                          ? `적립 후 포인트: ${(
                              user.stamps + (parseInt(number, 10) || 0)
                            ).toLocaleString()}${storeConfig.pointUnit}`
                          : `적립 후 스탬프: ${
                              (user.stamps + (parseInt(number, 10) || 0)) %
                              storeConfig.stampsPerCoupon
                            }/${storeConfig.stampsPerCoupon}개`}
                      </Text>
                    ) : (
                      <Text style={styles.beverageBodyText}>
                        {isPointMode
                          ? (parseInt(number, 10) || 0) > 0
                            ? `${(parseInt(number, 10) || 0).toLocaleString()}${
                                storeConfig.pointUnit
                              } 사용 예정`
                            : '사용할 포인트를 입력해주세요'
                          : totalSelected(userContext.selectedCoupon) > 0
                          ? `쿠폰 ${totalSelected(
                              userContext.selectedCoupon,
                            )}장 사용 예정`
                          : '쿠폰을 선택해주세요'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundStyle: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  flexColumnBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexCenterBox: {
    flexDirection: 'row',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  contentsText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  flexRowBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  button: {
    flex: 1,
    height: 50,
    backgroundColor: theme.color.surface.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  buttonText: {
    color: theme.color.etc.absolute.white,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    height: 'auto',
    width: 'auto',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: theme.color.etc.absolute.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonClose: {
    backgroundColor: theme.color.surface.brand.primary,
    height: 50,
    width: 120,
    borderRadius: 10,
    elevation: 2,
    justifyContent: 'center',
  },
  counterText: {
    color: theme.color.etc.absolute.white,
    fontSize: 24,
    fontFamily: theme.font.regular,
    lineHeight: 24,
    textAlign: 'center',
  },
  counterInnerText: {
    fontSize: 18,
    fontFamily: theme.font.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  textStyle: {
    color: theme.color.etc.absolute.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  labelBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  subLabelBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  labelTitleText: {
    fontSize: 32,
    fontFamily: theme.font.medium,
    lineHeight: 45,
    letterSpacing: -0.2,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: theme.font.regular,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  numberInputContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  numberInputButton: {
    display: 'flex',
    width: 84,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberInputText: {
    fontSize: 38,
    color: theme.color.texticon.onNormal.highemp,
    fontFamily: 'SFUIDisplay-Semibold',
  },
  headerNumberContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  headerNumberText: {
    fontSize: 32,
    color: theme.color.texticon.onNormal.highestemp,
    fontFamily: 'SFUIDisplay-Semibold',
    lineHeight: 45,
  },
  divisor: {
    width: '100%',
    height: 0.5,
    backgroundColor: theme.palette.gray[200],
  },
  confirmContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  confirmButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    backgroundColor: theme.color.surface.brand.primary,
    borderRadius: 24,
    // shadow
    shadowColor: theme.color.surface.brand.primary,
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmButtonText: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.1,
    color: theme.color.etc.absolute.white,
    fontFamily: theme.font.regular,
  },
  flexBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  beverageWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 40,
  },
  beverageBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.color.surface.normal.container10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beverageTitleText: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.2,
  },
  beverageButtonText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.2,
    textDecorationLine: 'underline',
  },
  countBadge: {
    position: 'absolute',
    right: -8,
    top: -10,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    padding: 2,
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 14,
    shadowColor: theme.color.surface.brand.primary,
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeText: {
    color: theme.color.etc.absolute.white,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontFamily: 'SFUIDisplay-Semibold',
  },
});

export default DetailView;
