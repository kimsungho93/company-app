---
paths:
  - "src/features/auth/ui/campus/**"
  - "src/features/auth/ui/AuthLayout*"
  - "src/features/auth/ui/AuthCard*"
---

# 인증 화면의 3D 캠퍼스

웨이퍼 배경은 공장 정문 장면으로 교체됐다. 이전 로그인 설계 문서의 웨이퍼·인트로 저장소 규칙은 적용하지 않는다.

- `AuthLayout`이 배경과 `<Outlet />`을 조립한다. 로그인·회원가입 이동에서 배경을 유지하고 폼의 인증 로직과 연결하지 않는다.
- `CampusBackdrop`은 동작 줄이기·일시정지·로딩 실패를 처리한다. Three.js는 동적 import하며 실패해도 SVG 배경과 폼이 남아야 한다.
- 정적 환경은 `campusEnvironment`, 수목·재질은 `campusLandscape`·`campusSurfaceTextures`, 사람 형상은 `campusActorModels`, 차량 형상은 `campusCarModels`, 조립과 이동은 `campusActors`, 경로·게이트 계산은 `campusMotion`, 렌더링 수명주기는 `campusRenderer`가 담당한다.
- 사람의 진입/퇴장 차선·열린 출입구·게이트 위치를 함께 변경한다. 반복 위치는 화면 밖 또는 건물 내부로 두고 차는 보행로에 진입시키지 않는다.
- 매 프레임 React 상태를 변경하지 않는다. GPU 완료를 기다리는 동안 새 프레임을 쌓지 않고 픽셀 비율과 그림자를 제한하며 비활성 탭·화면 밖·일시정지에서는 연속 렌더링을 멈춘다.
- 해제 시 RAF·관찰자·이벤트·Three.js geometry/material/texture·InstancedMesh·그림자·WebGL 동기화 객체와 렌더러를 정리한다. 공유 자원은 중복 해제하지 않는다. 하늘·차량 반사 환경맵의 렌더 타깃과 CI 이미지 로딩 콜백도 해제한다. 차량 반사 환경은 저비용 조명 장면에서 초기 1회 생성한다.
- 폼은 기존 다크 테마 토큰을 유지한다. 캠퍼스의 밝은 팔레트는 장면 영역에 한정하고 폼의 포커스·오류·대비를 보존한다.
- 캔버스는 장식용 `aria-hidden`이다. 폼 제목의 IBS 식별과 애니메이션 제어 버튼의 접근 가능한 이름을 유지한다.
- 이동 계산 테스트와 실제 브라우저의 움직임·정지·실패 대체 화면·모바일 폼을 검증한다. mock 인증 테스트를 서버 통합 성공으로 보고하지 않는다.

- 건물 CI는 공식 원본 자산과 비율을 유지한다. 좌측 하단 `SKHNIX 2 CAMPUS`는 사용자가 지정한 표기이며 IBS 서비스 브랜드와 구분한다.
