import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig} from '/biomi/firebase-config.js';

// Match BioMi's project, API key and default app name so sessions share one origin.
export const app=getApps().some(a=>a.name==='[DEFAULT]')?getApp():initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
export const authReady=setPersistence(auth,browserLocalPersistence)
 .catch(()=>setPersistence(auth,browserSessionPersistence))
 .then(()=>auth.authStateReady());
