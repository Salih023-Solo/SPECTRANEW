import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const cfg=window.SPECTRA_SUPABASE||{}, api=(window.SPECTRA_CLOUD_API||'').replace(/\/$/,'');
const status=document.getElementById('status'), out=document.getElementById('out'), form=document.getElementById('query');
form.querySelector('button').disabled=true;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url||'')||!cfg.publishableKey||!/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(api)){
 status.textContent='Cloud API henüz yapılandırılmadı. SPECTRA yönetici dağıtımını bekleyin.';
}else{
 const sb=createClient(cfg.url,cfg.publishableKey);
 const {data:{session}}=await sb.auth.getSession();
 if(!session){status.textContent='Oturum açmalısın.'}
 else{
   const {data:membership,error}=await sb.from('beta_memberships').select('plan,status,expires_at').eq('user_id',session.user.id).maybeSingle();
   if(error||membership?.plan!=='pro'||membership?.status!=='active'||Date.parse(membership.expires_at)<=Date.now())status.textContent='Geçerli PRO Beta üyeliği bulunamadı.';
   else {status.textContent='PRO Beta doğrulandı. İstekler sunucuda tekrar kontrol edilecek.';form.querySelector('button').disabled=false;}
 }
 form.addEventListener('submit',async e=>{e.preventDefault();out.textContent='Sorgulanıyor...';const f=new FormData(form);const domain=String(f.get('domain')).trim();const source=String(f.get('source'));try{
  const {data:{session:latest}}=await sb.auth.getSession();if(!latest)throw new Error('Oturum açmalısın.');
  const r=await fetch(api+'/api/v3/'+source+'/'+encodeURIComponent(domain),{headers:{Authorization:'Bearer '+latest.access_token}});
  const body=await r.json();out.textContent=JSON.stringify({status:r.status,result:body},null,2);
 }catch(_){out.textContent='Bağlantı kurulamadı.'}});
}
