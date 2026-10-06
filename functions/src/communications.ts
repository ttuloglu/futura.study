import {createHash} from 'node:crypto';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
export const communicationsEnabled=()=>process.env.COMMUNICATIONS_ENABLED==='true';
const APP:string='fortale',outbox=()=>getFirestore().collection('communicationsOutbox');
type CommunicationEvent={type:'welcome'|'purchase'|'cancel';userId:string;transactionId:string;plan?:string;accessUntil?:string;locale?:string};
export async function queueCommunication(input:CommunicationEvent):Promise<boolean>{
 if(!communicationsEnabled())return false;
 if(!input.userId||!input.transactionId||!['welcome','purchase','cancel'].includes(input.type))throw new Error('A verified transaction ID is required.');
 if(APP==='fortale'&&input.type==='cancel')throw new Error('Credit packs are not subscriptions.');
 if(input.type==='cancel'&&!Number.isFinite(Date.parse(input.accessUntil||'')))throw new Error('Verified access end date is required.');
 const identity=await getAuth().getUser(input.userId);if(!identity.email||identity.disabled)return true;
 const profile=(await getFirestore().collection('users').doc(input.userId).get()).data()||{};
 const event={app:APP,type:input.type,userId:input.userId,transactionId:input.transactionId,email:identity.email,locale:String(input.locale||profile.language||profile.locale||'en'),plan:input.plan||'',accessUntil:input.accessUntil||''};
 const id=createHash('sha256').update(JSON.stringify([APP,input.userId,input.type,input.transactionId])).digest('hex'),ref=outbox().doc(id);
 await getFirestore().runTransaction(async tx=>{if((await tx.get(ref)).exists)return;tx.create(ref,{event,status:'ready',attempts:0,nextAttempt:0,createdAt:new Date().toISOString()});});return true;
}
// Only new, completed accounts are welcomed after explicit cutover. Historical
// accounts and private content never enter this integration.
export const communicationsWelcome=onDocumentWritten({document:'users/{userId}',region:'us-central1',retry:true},async event=>{
 if(!communicationsEnabled()||!event.data?.after.exists)return;
 const start=Date.parse(process.env.COMMUNICATIONS_START_AT||'');if(!Number.isFinite(start))return;
 const data=event.data.after.data()||{};if(data.termsAccepted===false||data.hasAcceptedTerms===false)return;
 const user=await getAuth().getUser(event.params.userId);if(!user.emailVerified||user.disabled||Date.parse(user.metadata.creationTime)<start)return;
 await queueCommunication({type:'welcome',userId:user.uid,transactionId:'account-'+user.uid});
});
export const communicationsDispatch=onSchedule({schedule:'every 5 minutes',serviceAccount:'650999489018-compute@developer.gserviceaccount.com',region:'us-central1',maxInstances:1,timeoutSeconds:120},async()=>{
 const endpoint=process.env.COMMUNICATIONS_ENDPOINT;if(!communicationsEnabled()||!endpoint)return;
 const parsed=new URL(endpoint);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.cloudfunctions.net')||parsed.pathname!=='/communicationsIngest')throw new Error('Unsupported communications endpoint.');
 const response=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience='+encodeURIComponent(endpoint)+'&format=full',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Service identity unavailable.');const token=await response.text();
 const docs=await outbox().where('status','==','ready').limit(50).get();
 for(const doc of docs.docs){const d=doc.data();if(d.nextAttempt>Date.now())continue;
  try{const sent=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(d.event),signal:AbortSignal.timeout(20000)});
   if(sent.ok)await doc.ref.update({status:'delivered',deliveredAt:new Date().toISOString()});
   else if([400,401,403].includes(sent.status))await doc.ref.update({status:'blocked',error:'Communications hub rejected the event: '+sent.status});
   else throw new Error('Communications hub unavailable.');
  }catch{const attempts=Number(d.attempts||0)+1;await doc.ref.update({attempts,nextAttempt:Date.now()+Math.min(86400000,300000*2**Math.min(attempts,8)),error:'Delivery waiting for retry.'});}
 }
});
