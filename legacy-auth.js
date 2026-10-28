import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
const firebaseConfig={
 apiKey:"AIzaSyCUicahBVghiJCXWjcKQYbB-4YoLv2SJIA",
 authDomain:"qbarstudio.firebaseapp.com",
 projectId:"qbarstudio",
 storageBucket:"qbarstudio.firebasestorage.app",
 messagingSenderId:"548791706576",
 appId:"1:548791706576:web:437c7add6ce1ad54f00fd5"
};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),googleProvider=new GoogleAuthProvider();
let currentUser=null,busy=false;
const byId=id=>document.getElementById(id);
function status(message){const el=byId("firebaseAccountStatus");if(el)el.textContent=message}
let accountTab='login';
function switchTab(tab){accountTab=tab==='signup'?'signup':'login';render()}
function render(){
 const loggedIn=!!currentUser;
 const show=(id,visible)=>{const el=byId(id);if(el)el.hidden=!visible};
 show('qbarSignedIn',loggedIn);
 show('qbarSignedOut',!loggedIn);
 show('firebaseEmailLogin',!loggedIn&&accountTab==='login');
 show('firebaseSignup',!loggedIn&&accountTab==='signup');
 show('firebaseResetPassword',!loggedIn&&accountTab==='login');
 const loginTab=byId('qbarTabLogin'),signupTab=byId('qbarTabSignup');
 if(loginTab){loginTab.classList.toggle('active',accountTab==='login');loginTab.setAttribute('aria-selected',String(accountTab==='login'))}
 if(signupTab){signupTab.classList.toggle('active',accountTab==='signup');signupTab.setAttribute('aria-selected',String(accountTab==='signup'))}
 const intro=byId('qbarAccountIntro');if(intro)intro.textContent=accountTab==='signup'?'Create a free account to save up to 15 projects in the cloud.':'Welcome back. Sign in to access your cloud projects.';
 const email=currentUser?.email||currentUser?.displayName||'Account';
 const emailLabel=byId('qbarAccountEmail');if(emailLabel)emailLabel.textContent=email;
 const pass=byId('accountPassword');if(pass)pass.autocomplete=accountTab==='signup'?'new-password':'current-password';
 status(loggedIn?'Account connected.':'');
}
window.qbarSwitchAccountTab=switchTab;

onAuthStateChanged(auth,u=>{currentUser=u;render();window.qbarRefreshProjects?.()},e=>status("Authentication initialization failed: "+e.message));
function friendly(e){const code=e?.code||"";return ({
 "auth/popup-closed-by-user":"Sign-in popup was closed.",
 "auth/popup-blocked":"Allow popups for this website.",
 "auth/unauthorized-domain":"This domain is not authorized in Firebase Authentication.",
 "auth/email-already-in-use":"Email already registered. Try Sign In.",
 "auth/invalid-email":"Please enter a valid email.",
 "auth/weak-password":"Use a password with at least 6 characters.",
 "auth/invalid-credential":"Incorrect email or password.",
 "auth/too-many-requests":"Too many attempts. Please try later."
})[code]||("Sign-in failed: "+(e?.message||code))}
async function action(id){if(busy)return;const email=byId("accountEmail")?.value.trim(),password=byId("accountPassword")?.value;busy=true;try{
 if(id==="firebaseGoogle"){status("Opening Google sign-in…");await signInWithPopup(auth,googleProvider)}
 if(id==="firebaseSignup"){if(!email||!password)throw Error("Enter email and password.");await createUserWithEmailAndPassword(auth,email,password)}
 if(id==="firebaseEmailLogin"){if(!email||!password)throw Error("Enter email and password.");await signInWithEmailAndPassword(auth,email,password)}
 if(id==="firebaseResetPassword"){if(!email)throw Error("Enter your email first.");await sendPasswordResetEmail(auth,email);status("Password reset email sent if the address is eligible.");return}
 if(id==="firebaseLogout")await signOut(auth);
 render();
 }catch(e){status(friendly(e))}finally{busy=false}}
document.addEventListener("click",e=>{const id=e.target.closest("button")?.id;if(id==='qbarTabLogin'||id==='qbarTabSignup'){switchTab(id==='qbarTabSignup'?'signup':'login');return}if(["firebaseGoogle","firebaseSignup","firebaseEmailLogin","firebaseResetPassword","firebaseLogout"].includes(id))action(id)});
window.qbarAuth={render,getUser:()=>currentUser};

import {getFirestore,collection,addDoc,getDocs,getDoc,doc,deleteDoc,query,limit,serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const db=getFirestore(app),MAX_CLOUD=15;
function userCollection(){if(!auth.currentUser)throw Error("Please sign in first.");return collection(db,"users",auth.currentUser.uid,"projects")}
async function listCloud(){const rows=await getDocs(query(userCollection(),limit(25)));const live=[];for(const snap of rows.docs){const x=snap.data(),time=x.createdAt?.toMillis?.();try{const obj=JSON.parse(x.content);live.push({id:snap.id,name:x.name,path:obj.path,data:obj.data,created:new Date(time||Date.now()).toISOString()})}catch{}}return live.sort((a,b)=>b.created.localeCompare(a.created))}
window.qbarCloud={
 list:listCloud,
 async save(p){const rows=await listCloud();if(rows.length>=MAX_CLOUD)throw Error("Cloud storage limit reached (15/15 projects). Delete an older project to save a new one.");const content=JSON.stringify({path:p.path,data:p.data});if(content.length>500000)throw Error("Project data too large (max 500 KB). Try using a smaller photo or logo.");await addDoc(userCollection(),{name:String(p.name||"Untitled").slice(0,120),type:p.path.startsWith("/barcode")?"barcode":"qr",content,settings:{},createdAt:serverTimestamp(),updatedAt:serverTimestamp()})},
 async open(id){const snap=await getDoc(doc(userCollection(),id));if(!snap.exists())throw Error("Project not found.");const x=snap.data();const v=JSON.parse(x.content);return {id,name:x.name,path:v.path,data:v.data}},
 async remove(id){await deleteDoc(doc(userCollection(),id))}
};
window.qbarRefreshProjects?.();
