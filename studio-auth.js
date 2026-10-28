import {auth,db,authReady} from './studio-firebase.js';
import {GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {collection,addDoc,getDocs,getDoc,doc,deleteDoc,query,limit,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export function safeStudioNext(value,origin=location.origin){
 if(!value||typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '';
 try{const url=new URL(value,origin);if(url.origin!==origin||url.pathname==='/account')return '';
  return ['/', '/studio', '/projects', '/settings'].includes(url.pathname)||['/biomi','/pixelmint','/qr','/barcode'].some(p=>url.pathname===p||url.pathname.startsWith(p+'/'))?url.pathname+url.search+url.hash:'';
 }catch{return ''}
}
const byId=id=>document.getElementById(id);
let currentUser=null,busy=false,ready=false,accountTab='login';
const next=safeStudioNext(new URLSearchParams(location.search).get('next'));
function status(message){const el=byId('firebaseAccountStatus');if(el)el.textContent=message}
function render(){
 const loggedIn=!!currentUser;
 const show=(id,visible)=>{const el=byId(id);if(el)el.hidden=!visible};
 show('qbarSignedIn',loggedIn);show('qbarSignedOut',ready&&!loggedIn);
 show('firebaseEmailLogin',!loggedIn&&accountTab==='login');show('firebaseSignup',!loggedIn&&accountTab==='signup');show('firebaseResetPassword',!loggedIn&&accountTab==='login');
 for(const [id,tab] of [['qbarTabLogin','login'],['qbarTabSignup','signup']]){const el=byId(id);if(el){el.classList.toggle('active',accountTab===tab);el.setAttribute('aria-selected',String(accountTab===tab))}}
 const intro=byId('qbarAccountIntro');if(intro)intro.textContent=accountTab==='signup'?'Create one account for QBar Studio, BioMi and PixelMint.':'Sign in once to continue across your studio tools.';
 const label=byId('qbarAccountEmail');if(label)label.textContent=currentUser?.email||currentUser?.displayName||'Account';
 const pass=byId('accountPassword');if(pass)pass.autocomplete=accountTab==='signup'?'new-password':'current-password';
 const continuation=byId('studioContinue');if(continuation){continuation.hidden=!loggedIn||!next;if(next){continuation.href=next;continuation.textContent=next.startsWith('/biomi/')?'Continue to BioMi':'Continue to your tool'}}
 document.querySelectorAll('[data-studio-account]').forEach(a=>{a.textContent=loggedIn?'My account':'Sign in';a.href=loggedIn?'/account':'/account?next='+encodeURIComponent(location.pathname+location.search)});
 document.querySelectorAll('.header a[data-route="/account"]').forEach(a=>{a.textContent=loggedIn?'👤 My Account':'👤 Login / Sign Up';a.setAttribute('aria-label',loggedIn?'My account':'Login or create account')});
 document.dispatchEvent(new CustomEvent('studio:auth',{detail:{signedIn:loggedIn}}));
}
function switchTab(tab){accountTab=tab==='signup'?'signup':'login';render();status('')}
function friendly(e){return ({
 'auth/popup-closed-by-user':'Google sign-in was cancelled.',
 'auth/unauthorized-domain':'Google sign-in is not ready on this address yet. You can use email and password.',
 'auth/email-already-in-use':'This email already has an account. Choose Log In.',
 'auth/invalid-email':'Enter a valid email address.',
 'auth/weak-password':'Use a password with at least 6 characters.',
 'auth/invalid-credential':'The email or password is incorrect.',
 'auth/too-many-requests':'Too many attempts. Please try again later.',
 'auth/network-request-failed':'The connection was interrupted. Please try again.'
 })[e?.code]||e?.message||'Sign-in could not finish. Please try again.'}
function finishSignIn(result){currentUser=result.user;render();status('Signed in.');if(next&&location.pathname==='/account')location.assign(next)}
async function action(id){
 if(busy||!ready)return;
 const email=byId('accountEmail')?.value.trim(),password=byId('accountPassword')?.value;
 busy=true;document.querySelectorAll('.qbar-account button').forEach(b=>b.disabled=true);
 try{
  if(id==='firebaseGoogle'){
   status('Opening Google sign-in…');const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
   try{finishSignIn(await signInWithPopup(auth,provider))}catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment'){await signInWithRedirect(auth,provider);return}throw e}
  }else if(id==='firebaseSignup'||id==='firebaseEmailLogin'){
   if(!email||!password)throw Error('Enter your email and password.');
   if(id==='firebaseSignup'&&password.length<6)throw Error('Use a password with at least 6 characters.');
   status(id==='firebaseSignup'?'Creating your account…':'Signing in…');
   const result=await (id==='firebaseSignup'?createUserWithEmailAndPassword:signInWithEmailAndPassword)(auth,email,password);finishSignIn(result);
  }else if(id==='firebaseResetPassword'){
   if(!email)throw Error('Enter your email first.');await sendPasswordResetEmail(auth,email);status('A reset email will be sent if this address has an account.');
  }else if(id==='firebaseLogout'){await signOut(auth);currentUser=null;render();status('Signed out.')}
 }catch(e){status(friendly(e))}finally{busy=false;document.querySelectorAll('.qbar-account button').forEach(b=>b.disabled=false)}
}
window.qbarSwitchAccountTab=switchTab;
window.qbarAuth={render,getUser:()=>currentUser,ready:authReady,signOut:()=>signOut(auth)};
document.addEventListener('click',e=>{const id=e.target.closest('button')?.id;if(id==='qbarTabLogin'||id==='qbarTabSignup'){switchTab(id==='qbarTabSignup'?'signup':'login');return}if(['firebaseGoogle','firebaseSignup','firebaseEmailLogin','firebaseResetPassword','firebaseLogout'].includes(id))action(id)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='accountPassword'){e.preventDefault();action(accountTab==='signup'?'firebaseSignup':'firebaseEmailLogin')}});
authReady.then(()=>{
 ready=true;onAuthStateChanged(auth,u=>{currentUser=u;if(location.pathname==='/studio'){if(!u){location.replace('/account?next=%2Fstudio');return}delete document.documentElement.dataset.workspaceAuth}if(u&&next&&location.pathname==='/account'){location.replace(next);return}render();window.qbarRefreshProjects?.();status('')},e=>status(friendly(e)));render();
 return getRedirectResult(auth);
}).then(result=>{if(result)finishSignIn(result)}).catch(e=>{ready=true;render();status(friendly(e))});

function userCollection(){if(!auth.currentUser)throw Error('Please sign in first.');return collection(db,'users',auth.currentUser.uid,'projects')}
async function listCloud(){const rows=await getDocs(query(userCollection(),limit(25)));const live=[];for(const snap of rows.docs){const x=snap.data(),time=x.createdAt?.toMillis?.();try{const obj=JSON.parse(x.content);live.push({id:snap.id,name:x.name,path:obj.path,data:obj.data,created:new Date(time||Date.now()).toISOString()})}catch{}}return live.sort((a,b)=>b.created.localeCompare(a.created))}
window.qbarCloud={list:listCloud,
 async save(p){const rows=await listCloud();if(rows.length>=15)throw Error('You have saved 15 cloud projects. Delete an older project to save another.');const content=JSON.stringify({path:p.path,data:p.data});if(content.length>500000)throw Error('This project is too large. Try a smaller photo or logo.');await addDoc(userCollection(),{name:String(p.name||'Untitled').slice(0,120),type:p.path.startsWith('/barcode')?'barcode':'qr',content,settings:{},createdAt:serverTimestamp(),updatedAt:serverTimestamp()})},
 async open(id){const snap=await getDoc(doc(userCollection(),id));if(!snap.exists())throw Error('Project not found.');const x=snap.data(),v=JSON.parse(x.content);return {id,name:x.name,path:v.path,data:v.data}},
 async remove(id){await deleteDoc(doc(userCollection(),id))}
};
