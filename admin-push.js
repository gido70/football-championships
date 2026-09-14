(function(){
  async function send(client,type,matchId,eventId){
    if(!client||!matchId||!['start','goal','yellow_card','red_card','end','test'].includes(type))return {skipped:true};
    try{
      const {data,error}=await client.functions.invoke('send-match-notification',{body:{type,match_id:matchId,event_id:eventId||null}});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.error||'notification_failed');
      return data;
    }catch(error){
      console.warn('تعذر إرسال التنبيه، وتم حفظ بيانات المباراة بصورة طبيعية.',error);
      return {ok:false,error:error?.message||String(error)};
    }
  }
  function message(result){
    if(!result)return '';
    if(result.ok&&result.duplicate)return ' · 🔔 سبق إرسال التنبيه';
    if(result.ok)return ` · 🔔 وصل التنبيه إلى ${Number(result.sent||0)} جهاز`;
    return ' · ⚠️ حُفظ التغيير لكن لم يصل التنبيه؛ أعد المحاولة من إدارة المباراة';
  }
  window.AdminPush={send,message};
})();
