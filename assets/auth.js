import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
// Only publishable credentials belong in the browser. RLS and invitation RPC enforce authorization.
const cfg=window.SPECTRA_SUPABASE||{};
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'') && /^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9._-]+)$/.test(cfg.publishableKey||'');
const $=id=>document.getElementById(id);
let client=null;
const tabs=['login','signup','reset'];
function notice(s,success=false){$('authNotice').textContent=s;$('authNotice').dataset.success=String(success)}
function selectTab(tab){tabs.forEach(t=>{const chosen=t===tab;$('tab-'+t).setAttribute('aria-selected',String(chosen));$('panel-'+t).hidden=!chosen;});notice('')}
tabs.forEach(t=>{$('tab-'+t).addEventListener('click',()=>selectTab(t))});
function busy(form,on){form.querySelectorAll('button').forEach(b=>b.disabled=on)}
async function render(){if(!client)return;const {data:{session}}=await client.auth.getSession();const signed=!!session?.user;
 tabs.forEach(t=>{$('panel-'+t).hidden=signed||$('tab-'+t).getAttribute('aria-selected')!=='true';$('tab-'+t).disabled=signed});
 $('authAccount').hidden=!signed;if(!signed)return;
 $('accountEmail').textContent=session.user.email||'Doğrulanmış hesap';
 const {data,error}=await client.from('beta_memberships').select('plan,status,expires_at').eq('user_id',session.user.id).maybeSingle();
 if(error){$('accountStatus').textContent='Üyelik durumu yüklenemedi. Supabase SQL kurulumunu kontrol et.';return;}
 const hasMembership=!!data;
 const until=data?.expires_at?new Date(data.expires_at):null;
 const validUntil=until&&!Number.isNaN(until.getTime())&&until.getTime()>Date.now();
 const active=data?.status==='active'&&data?.plan==='pro'&&validUntil;
 const dateText=until?until.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}):'';
 $('accountStatus').textContent=active
  ?'PRO PRIVATE BETA etkin · Bitiş: '+dateText+' · Araştırma API erişimi güvenli backend hazır olunca açılacak.'
  :hasMembership?'5 günlük PRO Beta süren doldu veya erişimin askıya alındı. Yeni davet kodu bu hesapta otomatik süre uzatmaz.'
  :'Hesabın oluşturuldu. 5 günlük PRO Private Beta için geçerli davet kodunu gir.';
 $('inviteForm').hidden=hasMembership;
 const link=$('cloudDashboardLink'); if(link)link.hidden=!active;
}
if(!configured){$('setupNotice').hidden=false;document.querySelectorAll('.auth-form button[type=submit]').forEach(b=>b.disabled=true)}
else{
 client=createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
 client.auth.onAuthStateChange(()=>{setTimeout(()=>{render().catch(()=>notice('Oturum durumu güncellenemedi.'))},0)});
 render().catch(()=>notice('Supabase bağlantısı kurulamadı.'));
}
$('panel-login').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const f=e.currentTarget;busy(f,true);try{const x=new FormData(f);const {error}=await client.auth.signInWithPassword({email:String(x.get('email')).trim(),password:String(x.get('password'))});if(error)throw error;notice('Giriş başarılı.',true);await render()}catch(err){notice('Giriş başarısız. E-posta, şifre ve doğrulama durumunu kontrol et.')}finally{busy(f,false)}});
$('panel-signup').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const f=e.currentTarget,x=new FormData(f),password=String(x.get('password')),confirm=String(x.get('confirmation'));if(password!==confirm){notice('Şifreler aynı değil.');return}if(password.length<12){notice('Şifre en az 12 karakter olmalı.');return}if(!x.get('consent')){notice('Şartları onaylamalısın.');return}busy(f,true);try{const {error}=await client.auth.signUp({email:String(x.get('email')).trim(),password,options:{emailRedirectTo:location.origin+'/giris'}});if(error)throw error;notice('Başvuru alındıysa doğrulama e-postası gönderildi. Posta kutunu kontrol et; ardından giriş yapıp davet kodunu etkinleştir.',true);f.reset()}catch(err){notice('Kayıt işlemi başarısız. Bir süre sonra tekrar dene.')}finally{busy(f,false)}});
$('panel-reset').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const f=e.currentTarget;busy(f,true);try{const email=String(new FormData(f).get('email')).trim();await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/sifre-yenile'});notice('Bu e-posta için hesap varsa şifre sıfırlama bağlantısı gönderildi.',true)}catch(_){notice('Şifre sıfırlama isteği tamamlanamadı.')}finally{busy(f,false)}});
$('inviteForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;const f=e.currentTarget,code=String(new FormData(f).get('invite')).trim();busy(f,true);try{const {data,error}=await client.rpc('redeem_beta_invite',{p_code:code});if(error)throw error;if(data!==true){notice('Kod geçersiz, süresi dolmuş veya kullanılmış.');return}f.reset();notice('Beta davetin etkinleştirildi!',true);await render()}catch(_){notice('Davet etkinleştirilemedi. Kodu ve e-posta doğrulamanı kontrol et.')}finally{busy(f,false)}});
$('logoutButton').addEventListener('click',async()=>{if(client)await client.auth.signOut();notice('Oturum kapatıldı.',true);await render()});
