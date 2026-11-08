(function () {
  if (!window.electronAPI || !window.electronAPI.isElectron) return;
  
  window.exportDatabaseJSON = async function () {
    const dataStr = JSON.stringify(getFullStateObject(), null, 2);
    const filePath = await window.electronAPI.saveFile(dataStr, `clinic_database_${new Date().toISOString().split('T')[0]}.json`);
    if (filePath) showCustomAlert('تم حفظ الداتا بنجاح', 'success');
  };
  window.importDatabaseJSON = async function () {
    const content = await window.electronAPI.openFile();
    if (!content) return;
    setFullStateObject(JSON.parse(content)); await saveData(); refreshAllUI();
    showCustomAlert('تم استعادة البيانات!', 'success');
  };
  window.downloadAppFile = function () { showCustomAlert('استخدم زر حفظ الداتا لأخذ نسخة احتياطية.', 'success'); };

  window.saveLockSettings = function () {
    const currPass = document.getElementById('admin-pass-input').value;
    const newPass = document.getElementById('admin-pass-new').value.trim();
    const newURL = document.getElementById('network-server-url').value.trim();
    if (currPass !== adminPassword) { showCustomAlert('كلمة السر خطأ!'); return; }
    if (newPass) adminPassword = newPass;
    ['reception', 'surgeries', 'surgery-reports', 'invoices', 'medical-records', 'cash-inventory', 'attendance', 'shift-reports', 'total-shifts', 'salaries', 'stores', 'main-store', 'services', 'doctors', 'nursing'].forEach(t => {
      const chk = document.getElementById(`lock-chk-${t}`); if (chk) lockedTabs[t] = chk.checked;
    });
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-pass-new').value = '';
    
    if (newURL && newURL !== serverURL) {
      (async () => {
        try {
          const res = await fetch(newURL + '/sync'); const data = await res.json();
          if (data && Object.keys(data).length > 1) {
            setFullStateObject(data); serverURL = newURL; refreshAllUI();
            showCustomAlert('تم سحب البيانات من السيرفر!', 'success');
          } else { serverURL = newURL; await saveData(); showCustomAlert('تم رفع البيانات للسيرفر!', 'success'); }
        } catch (e) { showCustomAlert('فشل الاتصال بالسيرفر!'); }
        closeLockSettingsModal();
      })();
    } else { serverURL = newURL; saveData(); closeLockSettingsModal(); showCustomAlert('تم الحفظ', 'success'); }
  };

  function addServerControls() {
    const lockModal = document.getElementById('lock-settings-modal');
    if (!lockModal || document.getElementById('desktop-server-section')) return;
    const networkInput = document.getElementById('network-server-url');
    if (!networkInput) return;
    const div = document.createElement('div');
    div.id = 'desktop-server-section'; div.className = 'border-t pt-2 mt-2 space-y-2';
    div.innerHTML = `
      <div class="flex items-center justify-between bg-emerald-50 p-2 rounded border border-emerald-300">
        <span class="text-[10px] font-bold text-emerald-900">سيرفر المزامنة</span>
        <span id="server-status-badge" class="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">متوقف</span>
      </div>
      <div class="grid grid-cols-2 gap-1">
        <button onclick="window.desktopStartServer()" class="bg-emerald-600 text-white font-bold py-1 rounded text-[10px]">تشغيل السيرفر</button>
        <button onclick="window.desktopStopServer()" class="bg-red-600 text-white font-bold py-1 rounded text-[10px]">إيقاف</button>
      </div>
      <div id="server-info-box" class="text-[9px] font-bold text-center bg-blue-50 p-2 rounded border border-blue-200 text-blue-800 hidden">
        <div>الرابط:</div>
        <div id="server-url-display" class="text-[12px] font-black text-blue-900 mt-1 bg-white p-1 rounded border" dir="ltr"></div>
      </div>`;
    const parent = networkInput.closest('.border-t') || networkInput.parentElement.parentElement;
    parent.parentElement.insertBefore(div, parent.nextSibling);
    updateStatus();
  }

  async function updateStatus() {
    if (!window.electronAPI) return;
    const s = await window.electronAPI.getServerStatus();
    const badge = document.getElementById('server-status-badge');
    const info = document.getElementById('server-info-box');
    const url = document.getElementById('server-url-display');
    if (!badge) return;
    if (s.running) {
      badge.className = 'text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded'; badge.textContent = 'يعمل ✓';
      info.classList.remove('hidden'); url.textContent = `http://${s.ip}:${s.port}`;
    } else {
      badge.className = 'text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded'; badge.textContent = 'متوقف';
      info.classList.add('hidden');
    }
  }

  window.desktopStartServer = async function () {
    const r = await window.electronAPI.startServer(5000);
    if (r.success) { await updateStatus(); showCustomAlert(`تم التشغيل: http://${r.ip}:5000`, 'success'); }
    else showCustomAlert('خطأ: ' + r.error);
  };
  window.desktopStopServer = async function () { await window.electronAPI.stopServer(); await updateStatus(); showCustomAlert('تم الإيقاف', 'success'); };

  const observer = new MutationObserver(() => {
    const lockModal = document.getElementById('lock-settings-modal');
    if (lockModal && !lockModal.classList.contains('hidden')) setTimeout(addServerControls, 100);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const lockModal = document.getElementById('lock-settings-modal');
    if (lockModal) observer.observe(lockModal, { attributes: true });
  });
})();
