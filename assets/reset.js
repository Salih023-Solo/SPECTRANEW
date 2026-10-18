import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
const config=window.SPECTRA_SUPABASE||{},out=document.getElementById('resetNotice'),form=document.getElementById('resetForm');
if(!config.url||!config.publishableKey){out.textContent='Supabase yapılandırılmadı.'}
else{const client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true}});
const check=async()=>{const {data:{session}}=await client.auth.getSession();form.hidden=!session;out.textContent=session?'Yeni şifreni belirle.':'Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı istemek için giriş sayfasına dön.'};
client.auth.onAuthStateChange(()=>setTimeout(check,0));setTimeout(check,400);
form.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(form),p=String(fd.get('password'));if(p!==String(fd.get('confirm'))){out.textContent='Şifreler uyuşmuyor.';return}const {error}=await client.auth.updateUser({password:p});out.textContent=error?'Şifre değiştirilemedi. Bağlantı süresi dolmuş olabilir.':'Şifre güncellendi. Giriş sayfasına dönebilirsin.';if(!error){form.hidden=true;await client.auth.signOut()}})}
