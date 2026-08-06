/*
  auth-guard.js
  يُضاف في <head> كل صفحة أدمن (بعد supabase-config.js وقبل مكتبة supabase-js لو أمكن، أو بعدها).
  يتحقق من وجود جلسة دخول صالحة (Supabase Auth)، ولو غير موجودة يحوّل المستخدم فوراً
  إلى admin-login.html مع حفظ الصفحة المطلوبة للرجوع إليها بعد الدخول.
*/
(function () {
  // إخفاء الصفحة فوراً لمنع ظهور محتوى الأدمن قبل التأكد من تسجيل الدخول
  document.documentElement.style.visibility = 'hidden';

  function goToLogin() {
    var current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('admin-login.html?next=' + current);
  }

  function reveal() {
    document.documentElement.style.visibility = 'visible';
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (typeof window.supabase === 'undefined' || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      // فشل تحميل مكتبة supabase أو الإعدادات — أمان افتراضي: رجوع لصفحة الدخول
      goToLogin();
      return;
    }

    var authClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    authClient.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) {
        goToLogin();
        return;
      }
      reveal();

      // مراقبة الجلسة: لو تسجيل الخروج حصل في تبويب آخر أو انتهت الجلسة، رجّعه لصفحة الدخول
      authClient.auth.onAuthStateChange(function (event, newSession) {
        if (!newSession) {
          goToLogin();
        }
      });

      // زر تسجيل خروج عام: أي عنصر بالصفحة عليه data-admin-logout يُفعَّل تلقائياً
      document.querySelectorAll('[data-admin-logout]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          authClient.auth.signOut().then(function () {
            window.location.href = 'admin-login.html';
          });
        });
      });
    }).catch(function () {
      goToLogin();
    });
  });
})();
