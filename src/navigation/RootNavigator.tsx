import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import AuthStack from './AuthStack';
import MainTab from './MainTab';
import {useAuth} from '../hooks';

const RootNavigator = () => {
  const {mode, isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'}}>
        <ActivityIndicator size="large" color="#0288D1" />
      </View>
    );
  }

  return isAuthenticated ? <MainTab mode={mode} /> : <AuthStack />;
};

export default RootNavigator;
