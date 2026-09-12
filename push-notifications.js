(function(){
  function bytes(value){
    const pad='='.repeat((4-value.length%4)%4);
    const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }
  function supported(){return Boolean('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&window.PUSH_VAPID_PUBLIC_KEY)}
  const storageKey=tournamentId=>'push-tournament:'+tournamentId;
  async function registration(){return navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready)}
  async function save(client,tournamentId,sub){
    const json=sub.toJSON();
    const {error}=await client.rpc('save_push_subscription',{
      p_tournament_id:tournamentId,p_endpoint:json.endpoint,p_p256dh:json.keys?.p256dh||'',p_auth:json.keys?.auth||'',p_user_agent:navigator.userAgent.slice(0,500)
    });
    if(error)throw error;
  }
  let subscription=null;
  async function state(tournamentId){
    if(!supported())return 'unsupported';
    if(Notification.permission==='denied')return 'denied';
    const reg=await registration();subscription=await reg.pushManager.getSubscription();
    return subscription&&localStorage.getItem(storageKey(tournamentId))==='1'?'enabled':'disabled';
  }
  async function enable(client,tournamentId){
    if(!supported())throw new Error('unsupported');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error(permission==='denied'?'denied':'permission');
    const reg=await registration();
    subscription=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(window.PUSH_VAPID_PUBLIC_KEY)});
    await save(client,tournamentId,subscription);
    localStorage.setItem(storageKey(tournamentId),'1');
    return 'enabled';
  }
  async function disable(client,tournamentId){
    const reg=await registration();subscription=await reg.pushManager.getSubscription();
    if(subscription){
      await client.rpc('remove_push_subscription',{p_tournament_id:tournamentId,p_endpoint:subscription.endpoint});
      localStorage.removeItem(storageKey(tournamentId));
      const hasOtherTournament=[...Array(localStorage.length).keys()].some(i=>(localStorage.key(i)||'').startsWith('push-tournament:'));
      if(!hasOtherTournament){await subscription.unsubscribe();subscription=null;}
    }
    return 'disabled';
  }
  function paint(button,status,message){
    if(!button)return;
    button.dataset.state=status;
    button.disabled=status==='working'||status==='unsupported';
    button.textContent=message||(status==='enabled'?'🔔 تنبيهات البطولة مفعّلة':status==='denied'?'🔕 التنبيهات محظورة من الهاتف':status==='needs-install'?'📲 ثبّت التطبيق أولًا لتفعيل التنبيهات':status==='unsupported'?'🔕 هذا المتصفح لا يدعم التنبيهات':'🔔 فعّل تنبيهات البطولة');
    button.classList.toggle('enabled',status==='enabled');
  }
  async function init({client,tournamentId,button,onNeedsInstall}){
    if(!button||!client||!tournamentId)return;
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent||''),standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
    if(ios&&!standalone){paint(button,'needs-install');button.addEventListener('click',()=>onNeedsInstall?.());return;}
    let s='disabled';try{s=await state(tournamentId)}catch(_e){s='disabled'}paint(button,s);
    button.addEventListener('click',async()=>{
      const current=button.dataset.state;paint(button,'working','⏳ جاري تحديث التنبيهات...');
      try{paint(button,current==='enabled'?await disable(client,tournamentId):await enable(client,tournamentId))}
      catch(error){paint(button,error.message==='denied'?'denied':current==='enabled'?'enabled':'disabled',error.message==='denied'?'🔕 فعّل الإذن من إعدادات الهاتف':'⚠️ تعذر تفعيل التنبيهات — حاول مرة أخرى')}
    });
  }
  window.PushNotifications={init,state,enable,disable,supported};
})();
