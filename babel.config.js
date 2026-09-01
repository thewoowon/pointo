module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // reanimated 4부터 워클릿 변환은 react-native-worklets가 담당한다.
    'react-native-worklets/plugin',
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: `.env.${process.env.NODE_ENV || 'development'}`,
        blacklist: null,
        whitelist: null,
        safe: true,
        allowUndefined: true,
      },
    ],
  ],
  env: {
    // 릴리즈 번들에서 console.log를 제거한다.
    // 세션/유저 문서를 통째로 찍는 로그가 있어 고객 전화번호가 기기 로그
    // (iOS Console.app, adb logcat)로 새어나갔다.
    // error/warn은 크래시 진단에 필요하므로 남긴다.
    production: {
      plugins: [['transform-remove-console', {exclude: ['error', 'warn']}]],
    },
  },
};
