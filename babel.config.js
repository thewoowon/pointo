module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
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
    // reanimated 4부터 워클릿 변환은 react-native-worklets가 담당한다.
    // ⚠️ 반드시 plugins 배열의 마지막이어야 한다. 앞에 두면 뒤따르는 플러그인이
    //    변환한 코드를 워클릿으로 못 잡아 런타임에
    //    "`scheduleOnUI` can only be used with worklets"로 터진다.
    'react-native-worklets/plugin',
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
