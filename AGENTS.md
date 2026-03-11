# AGENTS.md

## Project Overview

**Fefme** (Fediverse timeline for ME)는 마스토돈을 위한 클라이언트 사이드 알고리즘 타임라인입니다. 모든 계산은 브라우저에서 수행되며 백엔드가 없는 개인정보 보호 중심 아키텍처입니다.

- **Demo:** <https://lens0021.github.io/fefme/>
- **Build Output:** GitHub Pages 배포를 위해 `docs/` 폴더를 사용합니다.

## 핵심 로직 및 아키텍처

### 타임라인 캐시 동작 (Blue/Green)

사용자 경험의 일관성을 위해 듀얼 캐시 전략을 사용합니다.

- **Visible Timeline (Blue):** 현재 화면에 보이는 안정적인 캐시입니다. 세션 동안 순서가 바뀌지 않으며, 읽음 처리(Seen)만 업데이트됩니다.
- **Next Timeline (Green):** 백그라운드에서 새로 고쳐진 데이터를 담는 캐시입니다. 명시적인 새로고침(버블 클릭 등)시에만 Blue 캐시로 승격됩니다.
- **승격 로직:** `src/core/coordinator/cache.ts`에서 `VISIBLE_TIMELINE_STALE` 플래그를 통해 관리됩니다.

### 스코어링 시스템

다요소 가중치 스코어링 파이프라인을 구현합니다.
`Raw Posts → Individual Scorers → Weighted Scores → Time Decay → Diversity Penalty → Final Sorted Feed`

- **Scorers:** `src/core/scorer/post/`에 위치하며 모든 스코어러는 `Scorer` 베이스 클래스를 확장합니다.
- **Diversity:** `DiversityFeedScorer`를 통해 특정 주제가 타임라인을 독점하는 것을 방지합니다.

### 주요 컴포넌트 역할

- **Orchestrator:** `src/core/index.ts` (`FeedCoordinator`) - 전체 알고리즘 및 데이터 흐름 제어
- **State Management:** `src/core/coordinator/state.ts` (타임라인, 가중치, 로딩 상태)
- **API Client:** `src/core/api/api.ts` (`MastoApi` 싱글톤) - 캐싱, 속도 제한, Mutex 제어 포함
- **Storage:** `src/core/Storage.ts` (IndexedDB/localForage) - 대용량 포스트 및 사용자 데이터 저장

## 기술적 특이사항 및 Gotchas

### OAuth & GitHub Pages 우회

GitHub Pages는 Query String을 지원하지 않으므로 `App.tsx`에서 다음과 같은 우회로직을 사용합니다.

- `/?code=xyz` 형태의 URL을 `/#/callback?code=xyz`로 리다이렉트하여 `HashRouter`에서 처리할 수 있게 합니다.

### 저장소 전략

- **IndexedDB:** 포스트 캐시, 사용자 데이터(팔로워, 태그), 알고리즘 설정 등 대용량 데이터
- **localStorage:** OAuth 토큰, 서버 URL, UI 환경설정 등 소량의 메타데이터

### 구현 주의사항

- **Buffer Polyfill:** `class-transformer` 작동을 위해 `App.tsx`에서 `buffer`를 임포트해야 합니다.
- **Decorator:** 데이터 모델 변환을 위해 TS 데코레이터가 활성화되어 있습니다.
- **Concurrency:** API 호출 및 스코어링 시 레이스 컨디션을 방지하기 위해 `async-mutex`를 사용합니다.
- **Strict Mode:** 현재 TypeScript strict mode가 비활성화되어 있습니다 (의도적).

## 주요 TODO

- `CoordinatorProvider` / `useCoordinator` 명칭을 `FeedCoordinator`와 일치하도록 변경 검토
- 거대한 알고리즘 모듈(`feed.ts`, `state.ts`)을 더 작은 역할 단위로 분리
- `Post` 객체의 `score` 속성을 명시적으로 관리하여 타임라인 안정성 강화
