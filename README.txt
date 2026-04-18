هذا إصلاح لمشكلة UUID.

المشكلة كانت أن الكود كان يحول tournament_id و team_id إلى Number،
بينما قاعدة بياناتك تستخدم UUID.

استبدل الملفين التاليين في GitHub:
- groups-admin.js
- teams-admin.js

ثم اعمل Refresh قوي للصفحات.
