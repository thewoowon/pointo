module.exports = {
  root: true,
  extends: '@react-native',
  // functions/lib은 tsc 빌드 산출물이다. RN용 babel 파서로는 파싱할 수 없어
  // `yarn lint`가 항상 에러로 끝나던 것을 제외한다. (소스는 functions/src)
  ignorePatterns: ['functions/lib/'],
};
