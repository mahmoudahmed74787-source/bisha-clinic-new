(function () {
  if (!window.electronAPI || !window.electronAPI.isElectron) return;
  
  // إعدادات الطباعة الافتراضية
  let printSettings = JSON.parse(localStorage.getItem('bisha_print_settings')) || {
    size: 'A4',
    margins: 'default', // none, default, minimum
    scale: 100 // النسبة المئوية
  };

  // استبدال دالة الطباعة الأصلية لتعمل عبر Electron باحترافية
  window.printDocumentWindow = async function(title, contentHtml) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
          <meta charset="UTF-8"><title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
              @page { margin: 0; } /* إزالة هوامش المتصفح الافتراضية */
              body { font-family: 'Cairo', sans-serif; margin: 20px; color: #0f172a; direction: rtl; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 900; color: #be5845; }
              .header p { margin: 2px 0; font-size: 13px; font-weight: 700; color: #475569; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
              table th, table td { border: 1px solid #334155; padding: 6px 8px; text-align: right; }
              table th { background-color: #f1f5f9; font-weight: 800; }
              .footer { margin-top: 30px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
          </style>
      </head>
      <body>
          <div class="header">${getLogoSVG()}<h1>مركز بيشة عامر للجراحة</h1><p>${title}</p></div>
          <div style="transform: scale(${printSettings.scale / 100}); transform-origin: top center; width: 100%;">
            ${contentHtml}
          </div>
      </body>
      </html>
    `;

    // تجهيز الهوامش بناءً على اختيارك
    let marginsOption = { marginType: 'default' };
    if (printSettings.margins === 'none') marginsOption = { marginType: 'none' };
    else if (printSettings.margins === 'minimum') marginsOption = { marginType: 'printableArea' };

    const options = {
      silent: false, // إظهار نافذة اختيار الطابعة
      printBackground: true,
      pageSize: printSettings.size,
      margins: marginsOption
    };

    try {
      const res = await window.electronAPI.printWindow(htmlContent, options);
      if (!res.success && res.failureReason !== 'Print job canceled') {
        showCustomAlert('حدث خطأ أثناء الطباعة: ' + res.failureReason);
      }
    } catch (e) {
      showCustomAlert('خطأ: ' + e.message);
    }
  };

  // --- دوال السيرفر والملفات ---
  window.exportDatabaseJSON = async function () {
    const dataStr = JSON.stringify(getFullStateObject(), null, 2);
    const filePath = await window.electronAPI.saveFile(dataStr, `clinic_database_${new Date().toISOString().split('T')[0]}.json`);
    if (filePath) showCustomAlert('تم حفظ الداتا بنجاح', 'success');
  };
  
  window.importDatabaseJSON = async function () {
    const content = await window.electronAPI.openFile();
    if (!content) return;
    setFullStateObject(JSON.parse(content)); 
    await saveData(); refreshAllUI();
    showCustomAlert('تم استعادة البيانات بنجاح!', 'success');
  };
  
  window.downloadAppFile = function () { showCustomAlert('استخدم زر "حفظ الداتا" لأخذ نسخة احتياطية.', 'success'); };

  window.saveLockSettings = function () {
    const currPass = document.getElementById('admin-pass-input').value;
    const newPass = document.getElementById('admin-pass-new').value.trim();
    const newURL = document.getElementById('network-server-url').value.trim();
    
    if (currPass !== adminPassword) { showCustomAlert('كلمة السر الحالية غير صحيحة!'); return; }
    if (newPass) adminPassword = newPass;
    
    ['reception', 'surgeries', 'surgery-reports', 'invoices', 'medical-records', 'cash-inventory', 'attendance', 'shift-reports', 'total-shifts', 'salaries', 'stores', 'main-store', 'services', 'doctors', 'nursing'].forEach(t => {
      const chk = document.getElementById(`lock-chk-${t}`); 
      if (chk) lockedTabs[t] = chk.checked;
    });
    
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-pass-new').value = '';
    
    if (newURL && newURL !== serverURL) {
      (async () => {
        try {
          const res = await fetch(newURL + '/sync'); 
          const data = await res.json();
          if (data && Object.keys(data).length > 1) {
            setFullStateObject(data); serverURL = newURL; refreshAllUI();
            showCustomAlert('تم سحب البيانات من السيرفر بنجاح!', 'success');
          } else { 
            serverURL = newURL; await saveData(); showCustomAlert('تم رفع البيانات للسيرفر بنجاح!', 'success'); 
          }
        } catch (e) { showCustomAlert('فشل الاتصال بالسيرفر!'); }
        closeLockSettingsModal();
      })();
    } else { 
      serverURL = newURL; saveData(); closeLockSettingsModal(); showCustomAlert('تم حفظ الإعدادات', 'success'); 
    }
  };

  function addServerControls() {
    const lockModal = document.getElementById('lock-settings-modal');
    if (!lockModal || document.getElementById('desktop-server-section')) return;
    const networkInput = document.getElementById('network-server-url');
    if (!networkInput) return;
    
    // 1. قسم السيرفر
    const div = document.createElement('div');
    div.id = 'desktop-server-section'; 
    div.className = 'border-t pt-2 mt-2 space-y-2';
    div.innerHTML = `
      <div class="flex items-center justify-between bg-emerald-50 p-2 rounded border border-emerald-300">
        <span class="text-[10px] font-bold text-emerald-900">سيرفر المزامنة (لهذا الجهاز)</span>
        <span id="server-status-badge" class="text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">متوقف</span>
      </div>
      <div class="grid grid-cols-2 gap-1">
        <button onclick="window.desktopStartServer()" class="bg-emerald-600 text-white font-bold py-1 rounded text-[10px]">تشغيل السيرفر</button>
        <button onclick="window.desktopStopServer()" class="bg-red-600 text-white font-bold py-1 rounded text-[10px]">إيقاف</button>
      </div>
      <div id="server-info-box" class="text-[9px] font-bold text-center bg-blue-50 p-2 rounded border border-blue-200 text-blue-800 hidden">
        <div>رابط الاتصال للأجهزة الأخرى والتليفون:</div>
        <div id="server-url-display" class="text-[12px] font-black text-blue-900 mt-1 bg-white p-1 rounded border" dir="ltr"></div>
      </div>`;
      
    const parent = networkInput.closest('.border-t') || networkInput.parentElement.parentElement;
    parent.parentElement.insertBefore(div, parent.nextSibling);

    // 2. قسم إعدادات الطباعة الجديد
    const printSection = document.createElement('div');
    printSection.className = 'border-t pt-2 mt-2 space-y-2';
    printSection.innerHTML = `
      <div class="flex items-center justify-between bg-indigo-50 p-2 rounded border border-indigo-300">
        <span class="text-[10px] font-bold text-indigo-900"><i class="fa-solid fa-print ml-1"></i> إعدادات الطباعة</span>
      </div>
      <div class="grid grid-cols-1 gap-2 bg-white p-2 border rounded text-[11px]">
        <div class="flex justify-between items-center">
          <span class="font-bold">حجم الورقة:</span>
          <select id="print-size" class="border rounded px-2 py-0.5 font-bold">
            <option value="A4" ${printSettings.size==='A4'?'selected':''}>A4 (عادي)</option>
            <option value="A5" ${printSettings.size==='A5'?'selected':''}>A5 (نصف ورقة)</option>
            <option value="Letter" ${printSettings.size==='Letter'?'selected':''}>Letter (خطاب)</option>
            <option value="A3" ${printSettings.size==='A3'?'selected':''}>A3 (كبير)</option>
          </select>
        </div>
        <div class="flex justify-between items-center">
          <span class="font-bold">الهوامش (Margins):</span>
          <select id="print-margins" class="border rounded px-2 py-0.5 font-bold">
            <option value="default" ${printSettings.margins==='default'?'selected':''}>عادية</option>
            <option value="minimum" ${printSettings.margins==='minimum'?'selected':''}>ضيقة جداً</option>
            <option value="none" ${printSettings.margins==='none'?'selected':''}>بدون هوامش</option>
          </select>
        </div>
        <div class="flex justify-between items-center">
          <span class="font-bold">نسبة الحجم (Scale):</span>
          <div class="flex items-center gap-1">
            <input type="number" id="print-scale" value="${printSettings.scale}" min="10" max="200" class="border rounded px-1 py-0.5 w-12 text-center font-bold">
            <span class="font-bold">%</span>
          </div>
        </div>
        <button onclick="window.savePrintSettings()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 rounded mt-1 shadow">حفظ إعدادات الطباعة</button>
      </div>`;
      
    parent.parentElement.insertBefore(printSection, parent.nextSibling);
    updateStatus();
  }

  window.savePrintSettings = function() {
    printSettings.size = document.getElementById('print-size').value;
    printSettings.margins = document.getElementById('print-margins').value;
    printSettings.scale = parseInt(document.getElementById('print-scale').value) || 100;
    localStorage.setItem('bisha_print_settings', JSON.stringify(printSettings));
    showCustomAlert('تم حفظ إعدادات الطباعة بنجاح', 'success');
  };

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
  window.desktopStopServer = async function () { await window.electronAPI.stopServer(); await updateStatus(); showCustomAlert('تم إيقاف السيرفر', 'success'); };

  const observer = new MutationObserver(() => {
    const lockModal = document.getElementById('lock-settings-modal');
    if (lockModal && !lockModal.classList.contains('hidden')) setTimeout(addServerControls, 100);
  });

  function addModeIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'mode-indicator';
    indicator.className = 'fixed bottom-3 left-3 bg-slate-800/95 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-slate-700';
    indicator.innerHTML = '<i class="fa-solid fa-circle text-emerald-400"></i><span id="mode-text">وضع مستقل - Desktop</span>';
    document.body.appendChild(indicator);

    function checkMode() {
      const url = localStorage.getItem('bisha_server_url_v10');
      const textEl = document.getElementById('mode-text');
      const icon = indicator.querySelector('i');
      if (!textEl) return;
      if (url) { textEl.textContent = 'عميل - ' + url.replace(/^https?:\/\//, ''); icon.className = 'fa-solid fa-circle text-blue-400 animate-pulse'; }
      else {
        const isServer = document.getElementById('server-status-badge')?.textContent?.includes('يعمل');
        if (isServer) { textEl.textContent = 'سيرفر رئيسي'; icon.className = 'fa-solid fa-circle text-amber-400'; }
        else { textEl.textContent = 'وضع مستقل - Desktop'; icon.className = 'fa-solid fa-circle text-emerald-400'; }
      }
    }
    setInterval(checkMode, 2000); checkMode();
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const lockModal = document.getElementById('lock-settings-modal');
    if (lockModal) observer.observe(lockModal, { attributes: true });
    addModeIndicator();
    setInterval(updateStatus, 5000);
  });
})();
