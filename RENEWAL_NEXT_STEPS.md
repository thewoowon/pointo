# 포인또 리뉴얼 — 다음 단계 핸드오프

> 2026-07-26 기준. 커밋 `a0fe2c5`(feat: 디자인 시스템 구축 및 포인또 블루 브랜드 전면 전환)까지 완료.
> 브랜치: `feature/pointto`. 이 문서는 남은 리뉴얼 작업을 새 세션에서 이어가기 위한 것.

## ✅ 지금까지 완료
- **디자인 토큰 시스템** — `src/theme/`: `primitives.ts`(192색), `semantic.ts`(surface/texticon/border/etc), `typography.ts`(Pretendard 패밀리), `spacing.ts`(Tailwind 4px 그리드, `spacing[1]=4`), `radius.ts`(none/xs/sm/md/lg/xl/xxl/full), `index.ts`(`theme = {color, palette, font, spacing, radius}`).
- **ThemeProvider + useTheme** (`src/contexts/ThemeContext.tsx`), App.tsx 배선. 단일 모드(다크모드 미구현).
- **반응형** — `src/hooks/useLayoutMode.ts`(compact/expanded, 768 단일 소스), `useDeviceType`은 호환 별칭(@deprecated). `src/components/SplitLayout.tsx`(+`useMasterDetail` 훅) 프리미티브, MainScreen에 적용.
- **전 화면 색·폰트 마이그레이션 완료** — 오렌지·탄 → 블루 `#2974FF`. 적립=그린(success)/사용=블루 상태 색코딩 확정. 폰트 오타 수정.
- **데드코드 정리** — DetailScreen 삭제.

## 🎨 토큰 소비 두 패턴 (중요)
1. **단일 컴포넌트 화면** → hook 방식:
   ```tsx
   const theme = useTheme();
   const styles = useMemo(() => createStyles(theme), [theme]);
   // ... const createStyles = (theme: Theme) => StyleSheet.create({ color: theme.color... })
   ```
   적용됨: auth 4화면, ModeSelection, MainScreen, DetailView, SwitcherScreen.
2. **모듈 상수/서브컴포넌트/모듈 StyleSheet 구조** → 정적 import 방식(훅 불가):
   ```tsx
   import {semanticColors as c, primitives as pal, fontFamily as f} from '../../theme';
   // c.surface.brand.primary · pal.blue[300] · f.medium
   ```
   적용됨: client 전부(NumberInput/Dashboard×2/Terms/Standby), supervisor StoreSettings/Statistics.
   ⚠️ primitives 별칭은 **`pal`** 사용(`p`는 흔한 로컬 변수명이라 no-shadow 충돌).

## 🔜 다음 작업 1 — spacing/radius 토큰화 후속

**배경:** 대량 마이그레이션 라운드에서 색·폰트만 토큰화하고 spacing/radius 숫자는 매직넘버로 남겨둠(범위·위험 관리). 이제 일괄 토큰화할 차례.

**이미 spacing/radius까지 된 화면(참고 예시):** auth SignIn/EmailAuth/StoreRegister, ModeSelection.
**아직 매직넘버로 남은 화면:** Terms, 그리고 색·폰트만 한 나머지 전부 — MainScreen, DetailView, NumberInput, DashboardView, DashboardScreen, StoreSettings, Statistics, Switcher.

**방법:**
- 훅 방식 화면: `padding: 20` → `padding: theme.spacing[5]`, `borderRadius: 20` → `theme.radius.xl` 등.
- 정적 방식 화면: `import {spacing as sp, radius as r} from '../../theme'` 추가 후 `sp[5]`, `r.xl`.
- 스케일 매핑: spacing은 4px 그리드라 4→[1], 8→[2], 12→[3], 16→[4], 20→[5], 24→[6], 32→[8], 40→[10] (반그리드 6→[1.5], 10→[2.5], 14→[3.5]). radius는 t-shirt로 스냅(예: 5→sm, 10→md, 14→lg, 20→xl).
- **제외 유지:** 컴포넌트 치수(maxWidth/height), fontSize/lineHeight(타입스케일 미정), shadow 수치, borderWidth(hairline).
- 스크립트 일괄이 효율적(색 마이그레이션 때처럼 python 정규식). 단 spacing은 문맥 무관하게 값→토큰 1:1이라 색보다 안전.

## 🔜 다음 작업 2 — DashboardView Modal → Stack screen

**현재:** [src/screens/client/NumberInputScreen.tsx](src/screens/client/NumberInputScreen.tsx) 에서 번호 입력 후 결과(DashboardView)를 `<Modal presentationStyle="overFullScreen">`로 띄움(약 396~406행 근처, `ctx.viewModalContext`).
**할 일:** 이 전체화면 결과를 Stack 스크린으로 전환. 근거: 태블릿 master-detail 분기가 네비게이터 경계에서 일어나야 하고, RN Modal의 StatusBar/focus/z-index 이슈 제거.
**유지:** SignupModal, PrivacyPolicyModal은 정당한 Modal이라 그대로 둠(전환 대상 아님).
**주의:** onSnapshot 실시간 세션 로직·navigation 흐름은 그대로 유지, 프레젠테이션 레이어만 변경. `useDashboard` 훅 상태 공유 방식 확인 필요.

## ⏳ 미결정/보류 (디자이너 확인 필요)
- **border 정책** — DS에 border 토큰 없음(=보더 미사용 방침). 현재 헤더 구분선·입력 외곽선은 `surface.container10`/`palette.gray[200]`로 임시 대체 + 주석. 리디자인에서 "보더 없앨지" 확정 필요.
- **의도적 유지 항목** — 모달 스크림 `rgba(0,0,0,x)`, 프로스트 `rgba(255,255,255,x)`, 레거시 폰트 `SFUIDisplay-*`(스토어코드 등 디스플레이용).

## 🧪 검증 명령
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"          # 0 이어야
# 특정 화면 잔여 하드코딩(색/폰트):
grep -oE "#[0-9A-Fa-f]{3,8}|'Pretendard-[A-Za-z]+'" src/screens/<경로>.tsx | sort | uniq -c
```
