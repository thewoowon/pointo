import React, {useCallback} from 'react';
import {Image, StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';
import {useAuth, useTheme} from '../../hooks';
import {useFocusEffect} from '@react-navigation/native';

const StandbyScreen = ({navigation}: any) => {
  const {storeCode} = useAuth();
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      if (!storeCode) {
        console.log('storeCode is not found');
        return;
      }
      const db = getFirestore();
      const sessionRef = doc(db, 'sessions', `session_${storeCode}`);

      const unsubscribe = onSnapshot(sessionRef, doc => {
        if (doc.exists) {
          const data = doc.data();
          console.log('Standby Current data: ', data);
          if (!data) {
            console.log('No data found');
            return;
          }
          if (data.mode === 'waiting') {
            console.log(
              '관리자가 조회 버튼을 눌렀어요! 전화번호 입력 화면으로 변경합니다.',
            );
            // 전화번호 입력 UI로 변경하는 코드 실행
            navigation.navigate('NumberInput');
          }
        }
      });

      // 🔥 구독 취소 (cleanup function)
      return () => unsubscribe();
    }, [storeCode]),
  ); // ✅ 의존성 배열 `[]` → 최초 1회 실행
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.container}>
          <Image
            style={{width: 'auto', height: 'auto', flex: 1}}
            source={require('../../assets/images/pexels-steve-1690351.jpg')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundStyle: {
    flex: 1,
  },
});

export default StandbyScreen;
