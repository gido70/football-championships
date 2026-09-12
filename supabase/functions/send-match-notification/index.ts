import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth=req.headers.get('Authorization')||'';
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await userClient.auth.getUser();
    if(!user)return reply({error:'unauthorized'},401);

    const {type,match_id,event_id}=await req.json();
    if(!['start','goal','yellow_card','red_card','end','test'].includes(type)||!match_id)return reply({error:'invalid_payload'},400);
    const db=createClient(url,service);
    const {data:m,error:matchError}=await db.from('matches').select('id,tournament_id,home_team_id,away_team_id,home_score,away_score,ht:teams!matches_home_team_id_fkey(name,name_ar),at:teams!matches_away_team_id_fkey(name,name_ar)').eq('id',match_id).single();
    if(matchError||!m)return reply({error:'match_not_found'},404);

    let event:any=null;
    if(['goal','yellow_card','red_card'].includes(type)){
      let q=db.from('match_events').select('id,minute,event_subtype,team_id,player:players!player_id(name,full_name_ar)').eq('match_id',match_id).eq('event_type',type);
      q=event_id?q.eq('id',event_id):q.order('created_at',{ascending:false}).limit(1);
      const {data}=event_id?await q.maybeSingle():await q;
      event=Array.isArray(data)?data[0]:data;
      if(!event)return reply({error:'event_not_found'},404);
    }
    const eventKey=['goal','yellow_card','red_card'].includes(type)?`${type}:${event.id}`:`${type}:${match_id}`;
    let delivery:any=null;
    if(type!=='test'){
      const {data,error}=await db.from('notification_deliveries').insert({event_key:eventKey,tournament_id:m.tournament_id,match_id,notification_type:type}).select('id').single();
      if(error){if(error.code==='23505')return reply({ok:true,duplicate:true,sent:0});throw error;}
      delivery=data;
    }

    const homeName=(m.ht as any)?.name_ar||(m.ht as any)?.name||'الفريق الأول',awayName=(m.at as any)?.name_ar||(m.at as any)?.name||'الفريق الثاني';
    let title='',body='';
    if(type==='start'){title='🔴 بدأت المباراة';body=`${homeName} × ${awayName} — اضغط لمشاهدة البث المباشر`;}
    if(type==='end'){title='🏁 انتهت المباراة';body=`${homeName} ${m.home_score??0} - ${m.away_score??0} ${awayName}`;}
    if(type==='goal'){
      const own=event.event_subtype==='own_goal',scoringHome=own?event.team_id!==m.home_team_id:event.team_id===m.home_team_id;
      const scoringTeam=scoringHome?homeName:awayName,player=(event.player as any)?.full_name_ar||(event.player as any)?.name;
      title='⚽ هدف لـ '+scoringTeam;body=`${player?player+' — ':''}${homeName} ${m.home_score??0} - ${m.away_score??0} ${awayName}${event.minute!=null?' — الدقيقة '+event.minute:''}`;
    }
    if(type==='yellow_card'||type==='red_card'){
      const team=event.team_id===m.home_team_id?homeName:awayName;
      const player=(event.player as any)?.full_name_ar||(event.player as any)?.name||'لاعب';
      title=type==='yellow_card'?'🟨 بطاقة صفراء':'🟥 بطاقة حمراء';
      body=`${player} — ${team}${event.minute!=null?' — الدقيقة '+event.minute:''}`;
    }
    if(type==='test'){title='🔔 تنبيه تجريبي ناجح';body=`${homeName} × ${awayName} — ستصل تنبيهات البداية والأهداف والبطاقات والنهاية بهذه الطريقة`;}
    const site=(Deno.env.get('PUBLIC_SITE_URL')||'https://gido70.github.io/football-championships').replace(/\/$/,'');
    const payload=JSON.stringify({title,body,icon:site+'/icon-app.png',badge:site+'/icon-app.png',tag:eventKey,url:`${site}/match-live.html?id=${match_id}`});
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||site,Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
    const {data:subs}=await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('tournament_id',m.tournament_id).eq('is_active',true);
    let sent=0,failed=0;
    await Promise.all((subs||[]).map(async s=>{
      try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);sent++;}
      catch(error:any){failed++;if(error?.statusCode===404||error?.statusCode===410)await db.from('push_subscriptions').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',s.id);}
    }));
    if(delivery)await db.from('notification_deliveries').update({status:failed?(sent?'partial':'failed'):'sent',sent_count:sent,failed_count:failed,completed_at:new Date().toISOString()}).eq('id',delivery.id);
    return reply({ok:true,sent,failed});
  }catch(error){console.error(error);return reply({error:error instanceof Error?error.message:'unknown_error'},500);}
});
