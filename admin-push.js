(function(){
  async function send(client,type,matchId,eventId){
    if(!client||!matchId||!['start','goal','end','test'].includes(type))return {skipped:true};
    try{
      const {data,error}=await client.functions.invoke('send-match-notification',{body:{type,match_id:matchId,event_id:eventId||null}});
      if(error)throw error;
      return data||{ok:true};
    }catch(error){
      console.warn('تعذر إرسال التنبيه، وتم حفظ بيانات المباراة بصورة طبيعية.',error);
      return {ok:false,error:error?.message||String(error)};
    }
  }
  window.AdminPush={send};
})();
