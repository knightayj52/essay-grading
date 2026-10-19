(async function init() {
  handleAuthRedirect();
  if (!loadToken()) {
    // 전에 로그인한 적이 있으면 조용히 재로그인 시도 (로그인 유지)
    if (localStorage.getItem(LS.LOGGED_BEFORE) === '1' && !location.hash && !CONFIG.CLIENT_ID.startsWith('YOUR_')) {
      // 무한 리다이렉트 방지: 1회만
      if (!sessionStorage.getItem('eg_silent_tried')) { sessionStorage.setItem('eg_silent_tried', '1'); login(true); return; }
    }
    showLogin(); renderApiKeyStatus(); return;
  }
  sessionStorage.removeItem('eg_silent_tried');
  const cached = localStorage.getItem(LS.USER); if (cached) { try { state.user = JSON.parse(cached); } catch (e) {} }
  await fetchUserInfo();
  renderUserChip();

  state.sheetId = localStorage.getItem(LS.SHEET_ID);
  if (!state.sheetId) { showConnect(); renderApiKeyStatus(); return; }
  try {
    await checkAndMigrateSheet(false);  // 접근 확인 + 구조 보완
    showApp();
  } catch (e) {
    showConnect(); $('connect-status').textContent = '연결 확인 실패: ' + e.message + ' · 기존 연결은 보존했습니다. 새로고침하거나 시트를 다시 선택하세요.';
  }
})();
