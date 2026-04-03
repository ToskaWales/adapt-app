
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,signOut as fbSO,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import{getFirestore,doc,setDoc,getDoc,deleteDoc,collection,addDoc,getDocs,query,orderBy,limit,where,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const cfg={apiKey:"AIzaSyDQKmSRuK0cpIupdwVOilD8gX88ML-3K8s",authDomain:"adaptive-plan-app.firebaseapp.com",projectId:"adaptive-plan-app",storageBucket:"adaptive-plan-app.firebasestorage.app",messagingSenderId:"214755243355",appId:"1:214755243355:web:4fe3818b936a442477967e"};
const app=initializeApp(cfg);const auth=getAuth(app);const db=getFirestore(app);const prov=new GoogleAuthProvider();prov.setCustomParameters({prompt:'select_account'});
const PROFILE_CACHE_PREFIX='addapt_profile_cache_';
function getCachedProfile(uid){
  if(!uid)return null;
  try{
    const raw=localStorage.getItem(PROFILE_CACHE_PREFIX+uid);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch{return null;}
}
function setCachedProfile(uid,profile){
  if(!uid||!profile)return;
  try{localStorage.setItem(PROFILE_CACHE_PREFIX+uid,JSON.stringify(profile));}catch(err){}
}
function resetLoginButton(){
  const b=document.querySelector('.btn-google');
  if(!b)return;
  b.innerHTML='<svg class="g-icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google';
  b.disabled=false;
}
window.signInWithGoogle=async()=>{
  const b=document.querySelector('.btn-google');
  if(b){b.textContent='Signing in...';b.disabled=true;}
  try{
    await signInWithPopup(auth,prov);
  }catch(e){
    const fallbackCodes=['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'];
    if(fallbackCodes.includes(e.code)){
      try{await signInWithRedirect(auth,prov);return;}catch(redirectErr){console.error(redirectErr);showToast('Login failed','Could not open Google sign-in. Try again.');}
    }else if(e.code!=='auth/popup-closed-by-user'){
      console.error(e);
      showToast('Login failed','Please try again.');
    }
    resetLoginButton();
  }
};
getRedirectResult(auth).catch(e=>{if(e)console.error(e);resetLoginButton();});
window.signOut=async()=>{await fbSO(auth);window.userProfile=null;goTo('login');};
async function withRetries(task,{retries=2,delayMs=450}={}){
  let lastErr=null;
  for(let attempt=0;attempt<=retries;attempt++){
    try{return await task();}
    catch(err){
      lastErr=err;
      if(attempt>=retries)break;
      await new Promise(res=>setTimeout(res,delayMs*(attempt+1)));
    }
  }
  throw lastErr;
}
onAuthStateChanged(auth,async u=>{
  if(u){window.currentUser=u;const av=document.getElementById('userAvatar'),nm=document.getElementById('userName');if(av)av.src=u.photoURL||'';if(nm)nm.textContent=u.displayName?.split(' ')[0]||'';
    try{
      const snap=await getDoc(doc(db,'users',u.uid,'profile','data'));
      if(snap.exists()){
        window.userProfile=snap.data();
        setCachedProfile(u.uid,window.userProfile);
        syncProfileDrivenState();
        updateHomeUI();
        goTo('home');
      }else{
        window.userProfile=null;
        startOb();
        goTo('onboarding');
      }
    }catch(e){
      console.error(e);
      const cached=getCachedProfile(u.uid);
      if(cached){
        window.userProfile=cached;
        syncProfileDrivenState();
        updateHomeUI();
        goTo('home');
        showToast('Offline mode','Loaded your last saved profile locally.');
      }else{
        showToast('Profile load failed','Please refresh in a moment.');
        goTo('login');
      }
    }
    resetLoginButton();
  }else{window.currentUser=null;goTo('login');resetLoginButton();}
});
window.fbSaveProfile=async p=>{const u=window.currentUser;if(!u)return;setSD('saving');try{await withRetries(()=>setDoc(doc(db,'users',u.uid,'profile','data'),p));window.userProfile=p;setCachedProfile(u.uid,p);setSD('saved');}catch(e){console.error(e);setCachedProfile(u.uid,p);setSD('error');showToast('Profile sync failed','Your changes are local. Retry from settings.');throw e;}};
window.fbSaveCheckin=async d=>{const u=window.currentUser;if(!u)return;setSD('saving');try{await withRetries(()=>addDoc(collection(db,'users',u.uid,'checkins'),{...d,createdAt:serverTimestamp()}));setSD('saved');}catch(e){console.error(e);setSD('error');showToast('Check-in sync failed','Network issue. Try submitting again.');throw e;}};
window.fbLoadCheckins=async()=>{const u=window.currentUser;if(!u)return[];try{const q=query(collection(db,'users',u.uid,'checkins'),orderBy('createdAt','desc'),limit(50));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.error(e);return[];}};
window.fbSaveSession=async sd=>{const u=window.currentUser;if(!u)return;const id=sd.isoDate+'_'+sd.dayName.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);const el=document.getElementById('logSD');if(el)el.className='sync-dot saving';try{await withRetries(()=>setDoc(doc(db,'users',u.uid,'sessions',id),{...sd,createdAt:serverTimestamp()}));if(el)el.className='sync-dot saved';}catch(e){console.error(e);if(el)el.className='sync-dot error';showToast('Session sync failed','Save did not confirm. Retry in a moment.');throw e;}};
window.fbLoadSessions=async()=>{const u=window.currentUser;if(!u)return[];try{const q=query(collection(db,'users',u.uid,'sessions'),orderBy('createdAt','desc'),limit(80));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.error(e);return[];}};
window.fbLoadLastSession=async dn=>{const u=window.currentUser;if(!u)return null;try{const q=query(collection(db,'users',u.uid,'sessions'),where('dayName','==',dn),orderBy('createdAt','desc'),limit(1));const s=await getDocs(q);return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()};}catch(e){console.error(e);return null;}};
window.fbResetUserData=async()=>{const u=window.currentUser;if(!u)return false;setSD('saving');try{const checkins=await getDocs(collection(db,'users',u.uid,'checkins'));for(const snap of checkins.docs)await deleteDoc(snap.ref);const sessions=await getDocs(collection(db,'users',u.uid,'sessions'));for(const snap of sessions.docs)await deleteDoc(snap.ref);const activities=await getDocs(collection(db,'users',u.uid,'activities'));for(const snap of activities.docs)await deleteDoc(snap.ref);await deleteDoc(doc(db,'users',u.uid,'profile','data'));setSD('saved');return true;}catch(e){console.error(e);setSD('error');return false;}};
window.fbSaveActivity=async a=>{const u=window.currentUser;if(!u)return;const el=document.getElementById('cardioSD');if(el)el.className='sync-dot saving';try{await withRetries(()=>addDoc(collection(db,'users',u.uid,'activities'),{...a,createdAt:serverTimestamp()}));if(el)el.className='sync-dot saved';}catch(e){console.error(e);if(el)el.className='sync-dot error';showToast('Activity sync failed','Cardio save did not confirm. Retry now.');throw e;}};
window.fbLoadActivities=async()=>{const u=window.currentUser;if(!u)return[];try{const q=query(collection(db,'users',u.uid,'activities'),orderBy('createdAt','desc'),limit(30));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.error(e);return[];}};



'use strict';
window.currentUser=null;window.userProfile=null;window.currentPlanData=null;window.currentCheckin=null;
let obAnswers={},selectedMuscles=[],selectedRestricts=['none'],selectedTrainDays=[],selectedNotifPrefs={checkin:true,emom:false,sauna:false},stepInterval=null,currentLogDay=null,swapTargetEx=null,calOverrideActive=false;
let lastTrainingMove=null;
let pendingLogMode='normal';
const APP_STATE={
  workoutTimer:{running:false,interval:null,seconds:0,lastMinute:-1,startEpoch:null,activeExercise:'',activeSet:1,restSeconds:0,restInterval:null,emomEnabled:false,emomTargetMinutes:0,emomWork:40,emomRest:20,emomExercises:[],emomExercisePlan:[],cues:['Power breathing and setup check.','Brace hard and own your first rep.','Control tempo and own every eccentric.','Add intent: move the bar faster on the concentric.','Stay technical. Leave ego out of the set.','Hydrate and reset posture before next set.']},
  gamification:{xp:0,level:1,nextXp:100},
  notifTimers: {checkin: null, emom: null, sauna: null}
};
const FLOW_EVENT_STORAGE_KEY='addapt_flow_events_v1';
let lastTrackedScreen='';
function trackFlowEvent(name,meta={}){
  if(!name)return;
  const payload={
    name,
    ts:new Date().toISOString(),
    uid:window.currentUser?.uid||'guest',
    screen:document.querySelector('.screen.active')?.id||'',
    meta
  };
  try{
    const prev=JSON.parse(localStorage.getItem(FLOW_EVENT_STORAGE_KEY)||'[]');
    const events=Array.isArray(prev)?prev:[];
    events.push(payload);
    localStorage.setItem(FLOW_EVENT_STORAGE_KEY,JSON.stringify(events.slice(-500)));
  }catch(err){}
}
window.trackFlowEvent=trackFlowEvent;
const MILESTONE_STORAGE_PREFIX='addapt_seen_milestones_';

function getSeenMilestones(){
  const uid=window.currentUser?.uid||'guest';
  try{
    const value=JSON.parse(localStorage.getItem(MILESTONE_STORAGE_PREFIX+uid)||'[]');
    return Array.isArray(value)?value:[];
  }catch{return[];}
}
function hasSeenMilestone(at){
  return getSeenMilestones().includes(at);
}
function markSeenMilestone(at){
  const uid=window.currentUser?.uid||'guest';
  const seen=[...new Set([...getSeenMilestones(),at])];
  localStorage.setItem(MILESTONE_STORAGE_PREFIX+uid,JSON.stringify(seen));
}
function getHabitCheckins(checkins){
  return (checkins||[]).filter(entry=>!entry?.quickWeightOnly);
}

// ── CARDIO SPORTS ──
const CARDIO_SPORTS=[
  {key:'running',label:'Running',met:8.3,icon:'🏃'},
  {key:'swimming',label:'Swimming',met:7.0,icon:'🏊'},
  {key:'cycling',label:'Cycling',met:7.5,icon:'🚴'},
  {key:'walking',label:'Walking',met:3.5,icon:'🚶'},
  {key:'hiit',label:'HIIT',met:10.0,icon:'⚡'},
  {key:'rowing',label:'Rowing',met:7.0,icon:'🚣'},
  {key:'jumprope',label:'Jump Rope',met:11.0,icon:'⭕'},
  {key:'elliptical',label:'Elliptical',met:5.0,icon:'🔄'},
  {key:'hiking',label:'Hiking',met:6.0,icon:'🥾'},
  {key:'yoga',label:'Yoga',met:3.0,icon:'🧘'},
];
function getActivityTimestamp(a){
  return a.createdAt?.toMillis?a.createdAt.toMillis():a.isoDate?new Date(a.isoDate).getTime():0;
}
function calcActivityCalories(sportKey,durationMins,weightKg){
  const sport=CARDIO_SPORTS.find(s=>s.key===sportKey);
  if(!sport||!durationMins)return 0;
  return Math.round(sport.met*(weightKg||75)*(durationMins/60));
}
function calcWeeklyCardioAdj(activities,weightKg){
  if(!activities||!activities.length)return 0;
  const cutoff=Date.now()-7*24*60*60*1000;
  const recent=activities.filter(a=>getActivityTimestamp(a)>=cutoff);
  const totalBurn=recent.reduce((sum,a)=>sum+calcActivityCalories(a.sport,a.duration,weightKg),0);
  return Math.round(totalBurn/7);
}

// ── NOTIFICATION SCHEDULING ──
function scheduleNotifications() {
  // Clear existing timers
  Object.values(APP_STATE.notifTimers).forEach(t => t && clearTimeout(t));
  if (!window.userProfile) return;
  // Check-in reminder: 7 days after last check-in
  if (window.userProfile.notifCheckin !== false && 'Notification' in window && Notification.permission === 'granted') {
    window.fbLoadCheckins?.().then(checkins => {
      let last = checkins && checkins.length > 0 ? new Date(checkins[0].createdAt?.toDate?.() || checkins[0].createdAt || checkins[0].date || Date.now()) : null;
      let msSince = last ? (Date.now() - new Date(last).getTime()) : Infinity;
      let msToNext = Math.max(0, 7 * 24 * 60 * 60 * 1000 - msSince);
      if (msToNext < 60 * 1000) msToNext = 60 * 1000; // never less than 1 min for demo
      APP_STATE.notifTimers.checkin = setTimeout(() => {
        new Notification('Time to check in!', { body: 'You haven\'t checked in for a week. Update your progress in ADDAPT.', tag: 'addapt-checkin', renotify: true });
      }, msToNext);
    });
  }
  // EMOM reminder: every day at 18:00 (demo)
  if (window.userProfile.notifEmom && 'Notification' in window && Notification.permission === 'granted') {
    let now = new Date();
    let next = new Date(now);
    next.setHours(18, 0, 0, 0);
    if (next < now) next.setDate(next.getDate() + 1);
    let msToNext = next - now;
    APP_STATE.notifTimers.emom = setTimeout(() => {
      new Notification('EMOM Reminder', { body: 'Ready for your EMOM session? Tap to start your timer!', tag: 'addapt-emom', renotify: true });
      scheduleNotifications(); // reschedule for next day
    }, msToNext);
  }
  // Sauna reminder: every Sunday at 10:00 (demo)
  if (window.userProfile.notifSauna && 'Notification' in window && Notification.permission === 'granted') {
    let now = new Date();
    let next = new Date(now);
    next.setDate(now.getDate() + ((7 - now.getDay()) % 7)); // next Sunday
    next.setHours(10, 0, 0, 0);
    if (next < now) next.setDate(next.getDate() + 7);
    let msToNext = next - now;
    APP_STATE.notifTimers.sauna = setTimeout(() => {
      new Notification('Sauna Reminder', { body: 'Don\'t forget your sauna session this week!', tag: 'addapt-sauna', renotify: true });
      scheduleNotifications(); // reschedule for next week
    }, msToNext);
  }
}

window.scheduleNotifications = scheduleNotifications;
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleNotifications(); });
window.addEventListener('load', scheduleNotifications);
const WORKOUT_TIMER_STORAGE_KEY='addapt_workout_timer_v3';
const MEAL_LOG_STORAGE_KEY='addapt_meal_log_v1';
const OB_TOTAL=12;
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ── NAV ──
// ── CUSTOM EXERCISES ──
function getCustomExercises() {
  try {
    return JSON.parse(localStorage.getItem('customExercises') || '[]');
  } catch { return []; }
}
function saveCustomExercises(list) {
  localStorage.setItem('customExercises', JSON.stringify(list));
}
function openCustomExModal() {
  renderCustomExList();
  document.getElementById('customExModal').style.display = 'flex';
}
function closeCustomExModal() {
  document.getElementById('customExModal').style.display = 'none';
}
function renderCustomExList() {
  const list = getCustomExercises();
  const wrap = document.getElementById('customExList');
  if (!wrap) return;
  if (!list.length) {
    wrap.innerHTML = '<div style="color:#888;font-size:13px;">No custom exercises yet.</div>';
    return;
  }
  wrap.innerHTML = list.map((ex, i) =>
    `<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;'>
      <div>
        <b>${ex.name}</b><br>
        <span style='font-size:11px;color:#aaa;'>${cap(ex.muscle)}, ${ex.pattern}, ${ex.eq}</span>
      </div>
      <button class='btn btn-outline btn-sm' onclick='deleteCustomExercise(${i})' style='margin-left:8px;'>Delete</button>
    </div>`
  ).join('');
}
function saveCustomExercise() {
  const name = document.getElementById('customExName').value.trim();
  const muscle = document.getElementById('customExMuscle').value;
  const pattern = document.getElementById('customExPattern').value;
  const eq = document.getElementById('customExEq').value;
  if (!name || !muscle || !pattern || !eq) {
    showToast('Missing info', 'Fill all fields to add.');
    return;
  }
  const list = getCustomExercises();
  if (list.some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
    showToast('Exists', 'Exercise already in your list.');
    return;
  }
  list.push({ name, muscle, pattern, eq });
  saveCustomExercises(list);
  renderCustomExList();
  document.getElementById('customExName').value = '';
  document.getElementById('customExMuscle').value = '';
  document.getElementById('customExPattern').value = '';
  document.getElementById('customExEq').value = '';
  showToast('Added', 'Custom exercise added.');
}
function deleteCustomExercise(idx) {
  const list = getCustomExercises();
  list.splice(idx, 1);
  saveCustomExercises(list);
  renderCustomExList();
  showToast('Deleted', 'Exercise removed.');
}
window.openCustomExModal = openCustomExModal;
window.closeCustomExModal = closeCustomExModal;
window.saveCustomExercise = saveCustomExercise;
window.deleteCustomExercise = deleteCustomExercise;

// ════════════════════════════════════
// ADD WEIGHT MODAL
// ════════════════════════════════════
function openAddWeightModal() {
  const input = document.getElementById('addWeightInput');
  if (input) input.value = '';
  document.getElementById('addWeightModal').style.display = 'flex';
}
function closeAddWeightModal() {
  document.getElementById('addWeightModal').style.display = 'none';
}
async function saveWeightEntry() {
  const input = document.getElementById('addWeightInput');
  const weight = input && input.value ? parseFloat(input.value) : null;
  if (!weight || isNaN(weight) || weight < 20 || weight > 300) {
    showToast('Invalid weight', 'Please enter a weight between 20 and 300 kg.');
    return;
  }
  const entry = {
    weight,
    isoDate: new Date().toISOString().split('T')[0],
    date: new Date().toLocaleDateString('en-GB'),
    // Marks this as a weight-only log (no energy, sleep, lifts, diet, or stress fields)
    weightOnly: true
  };
  try {
    if (window.fbSaveCheckin) await window.fbSaveCheckin(entry);
    closeAddWeightModal();
    showToast('Weight saved', `${weight} kg logged.`);
  } catch (e) {
    showToast('Save failed', 'Could not save weight. Please try again.');
  }
}
window.openAddWeightModal = openAddWeightModal;
window.closeAddWeightModal = closeAddWeightModal;
window.saveWeightEntry = saveWeightEntry;


function getAllExercises() {
  const customs = getCustomExercises();
  const lib = { ...EX_LIB };
  customs.forEach(ex => {
    // Use a unique key for custom exercises
    const key = 'custom_' + ex.name.replace(/[^a-zA-Z0-9]/g, '_');
    lib[key] = { ...ex, eq: [ex.eq] };
  });
  return lib;
}
function goTo(id){
  const currentActive=document.querySelector('.screen.active');
  const target=document.getElementById(id);
  if(!target){
    showToast('Navigation issue','That screen is unavailable right now.');
    return;
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  target.classList.add('active');
  if(id!==lastTrackedScreen){
    trackFlowEvent('screen_view',{screen:id});
    lastTrackedScreen=id;
  }
  try{
    updateAppNavState(id);
    if(id!=='home'&&walkthroughState.active)closeFeatureWalkthrough(false);
    if(id==='history')loadHistory();
    if(id==='settings')renderSettings();
    if(id==='logselect')renderLogSelect();
    if(id==='strength')loadStrength();
    if(id==='checkin')populateCheckinMeta();
    if(id==='logcardio')renderLogCardio();
    if(id==='home'&&window.userProfile?.walkthroughSeen===false)setTimeout(()=>startFeatureWalkthrough(),450);
    window.scrollTo(0,0);
  }catch(err){
    trackFlowEvent('screen_navigation_error',{target:id,message:err?.message||String(err)});
    target.classList.remove('active');
    if(currentActive)currentActive.classList.add('active');
    showToast('Navigation issue','Could not open that page. Please try again.');
  }
}
window.goTo=goTo;

function getEmomTemplates(){
  try{
    const data=JSON.parse(localStorage.getItem('emomTemplates')||'[]');
    return Array.isArray(data)?data:[];
  }catch{return[];}
}
function saveEmomTemplates(list){localStorage.setItem('emomTemplates',JSON.stringify(Array.isArray(list)?list:[]));}
const EMOM_PRESET_KEYS=['pullups_bw','dips_tri','pushup','chinup','bw_squat','burpees'];
const EMOM_PRESETS={
  beginner10:{
    rounds:10,
    work:35,
    rest:25,
    exerciseItems:[
      {key:'pullups_bw',reps:4},
      {key:'dips_tri',reps:6},
      {key:'pushup',reps:10}
    ]
  },
  classic12:{
    rounds:12,
    work:40,
    rest:20,
    exerciseItems:[
      {key:'pullups_bw',reps:5},
      {key:'dips_tri',reps:8},
      {key:'pushup',reps:12}
    ]
  },
  strength16:{
    rounds:16,
    work:45,
    rest:15,
    exerciseItems:[
      {key:'pullups_bw',reps:6},
      {key:'dips_tri',reps:10},
      {key:'pushup',reps:14},
      {key:'chinup',reps:5}
    ]
  },
  advanced20:{
    rounds:20,
    work:45,
    rest:15,
    exerciseItems:[
      {key:'pullups_bw',reps:8},
      {key:'dips_tri',reps:12},
      {key:'pushup',reps:18},
      {key:'burpees',reps:10}
    ]
  }
};
function emomLabelFromKey(key){
  const lib=getAllExercises();
  if(lib[key]?.name)return lib[key].name;
  return cap(String(key||'').replace(/_/g,' '));
}
function normalizeEmomExerciseItems(cfg){
  const lib=getAllExercises();
  const byName=new Map(Object.entries(lib).map(([key,val])=>[String(val?.name||'').toLowerCase(),key]));
  const source=Array.isArray(cfg?.exerciseItems)&&cfg.exerciseItems.length
    ? cfg.exerciseItems
    : (Array.isArray(cfg?.exercises)?cfg.exercises.map(name=>({name,reps:10})):[]);
  return source.map(item=>{
    if(typeof item==='string')item={name:item,reps:10};
    const keyRaw=String(item?.key||'').trim();
    const nameRaw=String(item?.name||'').trim();
    const matchedKey=keyRaw&&lib[keyRaw]?keyRaw:(byName.get(nameRaw.toLowerCase())||'');
    const name=matchedKey?lib[matchedKey].name:(nameRaw||emomLabelFromKey(keyRaw));
    const reps=Math.max(1,Math.min(80,parseInt(item?.reps,10)||10));
    return{name,key:matchedKey||keyRaw||name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),reps};
  }).filter(item=>item.name);
}
function parseEmomExercises(text){
  return String(text||'')
    .split(/[\n,]/)
    .map(x=>x.trim())
    .filter(Boolean)
    .slice(0,20);
}
function toggleEmomExerciseRow(el){
  const check=el&&el.matches?.('.emom-ex-check')?el:null;
  if(!check)return;
  const row=check.closest('.emom-ex-row');
  const key=check.dataset.key;
  const reps=row?.querySelector(`.emom-reps[data-key="${key}"]`)||document.querySelector(`.emom-reps[data-key="${key}"]`);
  if(row)row.classList.toggle('selected',!!check.checked);
  if(reps){
    reps.disabled=!check.checked;
    if(check.checked){
      if(!parseInt(reps.value,10))reps.value='10';
    }
  }
}
window.toggleEmomExerciseRow=toggleEmomExerciseRow;
function setActiveEmomPreset(presetKey){
  document.querySelectorAll('.emom-preset-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.preset===presetKey));
}
function applyEmomPreset(presetKey){
  const preset=EMOM_PRESETS[presetKey];
  if(!preset){showToast('Preset missing','Try another EMOM preset.');return;}
  const cfg={
    rounds:preset.rounds,
    minutes:preset.rounds,
    work:preset.work,
    rest:preset.rest,
    exerciseItems:preset.exerciseItems.map(item=>({key:item.key,name:emomLabelFromKey(item.key),reps:item.reps}))
  };
  applyEmomBuilderConfig(cfg);
  setActiveEmomPreset(presetKey);
  showToast('Preset loaded',`EMOM ${preset.rounds} min ready.`);
  trackFlowEvent('emom_preset_applied',{preset:presetKey,minutes:preset.rounds});
}
window.applyEmomPreset=applyEmomPreset;
function readEmomBuilderConfig(){
  const minutesInput=document.getElementById('emomMinutes')||document.getElementById('emomRounds');
  const rounds=Math.max(1,Math.min(40,parseInt(minutesInput?.value,10)||12));
  const work=Math.max(10,Math.min(60,parseInt(document.getElementById('emomWork')?.value,10)||40));
  const rest=Math.max(0,Math.min(50,parseInt(document.getElementById('emomRest')?.value,10)||20));
  const checks=[...document.querySelectorAll('#emomExercisePicker .emom-ex-check:checked')];
  const exerciseItems=checks.map(check=>{
    const key=check.dataset.key;
    const repsEl=document.querySelector(`.emom-reps[data-key="${key}"]`);
    const reps=Math.max(1,Math.min(80,parseInt(repsEl?.value,10)||10));
    if(repsEl)repsEl.value=String(reps);
    return{key,name:emomLabelFromKey(key),reps};
  });
  if(!exerciseItems.length){
    const legacy=parseEmomExercises(document.getElementById('emomExercises')?.value);
    legacy.forEach(name=>exerciseItems.push({name,key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),reps:10}));
  }
  const exercises=exerciseItems.map(item=>item.name);
  if(minutesInput)minutesInput.value=String(rounds);
  if(document.getElementById('emomRounds'))document.getElementById('emomRounds').value=String(rounds);
  if(document.getElementById('emomWork'))document.getElementById('emomWork').value=String(work);
  if(document.getElementById('emomRest'))document.getElementById('emomRest').value=String(rest);
  return{rounds,minutes:rounds,work,rest,exerciseItems,exercises};
}
function applyEmomBuilderConfig(cfg){
  if(!cfg)return;
  const minutesInput=document.getElementById('emomMinutes')||document.getElementById('emomRounds');
  if(minutesInput)minutesInput.value=String(cfg.rounds||cfg.minutes||12);
  if(document.getElementById('emomRounds'))document.getElementById('emomRounds').value=String(cfg.rounds||12);
  if(document.getElementById('emomWork'))document.getElementById('emomWork').value=String(cfg.work||40);
  if(document.getElementById('emomRest'))document.getElementById('emomRest').value=String(cfg.rest||20);
  const normalized=normalizeEmomExerciseItems(cfg);
  document.querySelectorAll('#emomExercisePicker .emom-ex-check').forEach(check=>{
    check.checked=false;
    toggleEmomExerciseRow(check);
  });
  normalized.forEach(item=>{
    const check=document.querySelector(`#emomExercisePicker .emom-ex-check[data-key="${item.key}"]`);
    const reps=document.querySelector(`#emomExercisePicker .emom-reps[data-key="${item.key}"]`);
    if(check){
      check.checked=true;
      if(reps)reps.value=String(item.reps||10);
      toggleEmomExerciseRow(check);
    }
  });
  if(document.getElementById('emomExercises'))document.getElementById('emomExercises').value=(cfg.exercises||[]).join(', ');
}
function formatEmomExerciseSummary(t){
  const items=normalizeEmomExerciseItems(t);
  if(items.length)return items.map(item=>`${item.name} ${item.reps}r`).join(' · ');
  return (t.exercises||[]).join(', ')||'None';
}
function renderEmomTemplateList(){
  const wrap=document.getElementById('emomTemplateList');
  if(!wrap)return;
  const templates=getEmomTemplates();
  if(!templates.length){
    wrap.innerHTML='<div style="color:#888;font-size:13px;">No saved templates yet.</div>';
    return;
  }
  wrap.innerHTML=templates.map((t,i)=>
    `<div class='emom-tpl-row' style='margin-bottom:8px;'>
      <b>Minutes:</b> ${t.rounds||t.minutes||12}, <b>Work:</b> ${t.work}s, <b>Rest:</b> ${t.rest}s<br>
      <b>Exercises:</b> ${formatEmomExerciseSummary(t)}<br>
      <button class='btn btn-outline btn-sm' onclick='loadEmomTemplate(${i})'>Load</button>
      <button class='btn btn-acc btn-sm' style='margin-left:8px;' onclick='startSavedEmom(${i})'>Start</button>
      <button class='btn btn-outline btn-sm' style='margin-left:8px;' onclick='deleteEmomTemplate(${i})'>Delete</button>
    </div>`
  ).join('');
}
function renderLogEmomSelect(){
  // Show saved EMOM templates for logging
  const wrap = document.getElementById('emomLogTemplateList');
  if(!wrap) return;
  const templates = getEmomTemplates();
  if(!templates.length){
    wrap.innerHTML = '<div style="color:#888;font-size:13px;">No EMOM templates saved yet. Use the EMOM builder to create one.</div>';
    return;
  }
  wrap.innerHTML = templates.map((t,i)=>
    `<div class='emom-tpl-row' style='margin-bottom:8px;'>
      <b>Minutes:</b> ${t.rounds||t.minutes||12}, <b>Work:</b> ${t.work}s, <b>Rest:</b> ${t.rest}s<br>
      <b>Exercises:</b> ${formatEmomExerciseSummary(t)}<br>
      <button class='btn btn-outline btn-sm' onclick='loadEmomTemplate(${i});goToEmomBuilder();'>Edit</button>
      <button class='btn btn-acc btn-sm' style='margin-left:8px;' onclick='startSavedEmom(${i})'>Log This EMOM</button>
    </div>`
  ).join('');
}

function saveEmomTemplate(){
  const cfg=readEmomBuilderConfig();
  if(!cfg.exerciseItems.length){showToast('Add exercises','Choose at least one movement and reps.');return;}
  const templates=getEmomTemplates();
  templates.unshift(cfg);
  saveEmomTemplates(templates.slice(0,20));
  renderEmomTemplateList();
  renderLogEmomSelect();
  showToast('Template saved','Your EMOM template is ready.');
}
window.saveEmomTemplate=saveEmomTemplate;
function loadEmomTemplate(index){
  const templates=getEmomTemplates();
  if(!templates.length){showToast('No templates','Save a template first.');return null;}
  const idx=Number.isInteger(index)?index:0;
  const tpl=templates[idx];
  if(!tpl){showToast('Template missing','Please choose another template.');return null;}
  applyEmomBuilderConfig(tpl);
  renderEmomTemplateList();
  return tpl;
}
window.loadEmomTemplate=loadEmomTemplate;
function deleteEmomTemplate(index){
  const templates=getEmomTemplates();
  if(!templates[index])return;
  templates.splice(index,1);
  saveEmomTemplates(templates);
  renderEmomTemplateList();
  renderLogEmomSelect();
  showToast('Template deleted','Removed from your EMOM list.');
}
window.deleteEmomTemplate=deleteEmomTemplate;
function setSD(s){['syncDot','ciSD','logSD'].forEach(id=>{const e=document.getElementById(id);if(e)e.className='sync-dot'+(s?' '+s:'');});}

// ── TOAST ──
let toastTimer=null;

function showToast(title,msg,dur=3500){
  const t=document.getElementById('toast');
  document.getElementById('toastTitle').textContent=title;
  document.getElementById('toastMsg').textContent=msg;
  t.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),dur);
}

// --- SOCIAL/SHARE ---
window.shareStreak = function() {
  const canvas = document.getElementById('streaksChart');
  if (canvas && window.navigator.share) {
    canvas.toBlob(blob => {
      const file = new File([blob], 'streaks.png', {type: 'image/png'});
      window.navigator.share({
        title: 'My Check-In Streaks',
        text: 'Check out my training streaks on ADDAPT!',
        files: [file]
      }).catch(() => {});
    });
  } else if (canvas) {
    // Fallback: copy image to clipboard
    canvas.toBlob(blob => {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({'image/png': blob});
        navigator.clipboard.write([item]);
        showToast('Streak chart copied!','Image copied to clipboard.');
      } else {
        showToast('Sharing not supported.','');
      }
    });
  } else {
    showToast('Chart not found.','');
  }
}

window.sharePR = function() {
  const prText = document.getElementById('exPRText')?.textContent || '';
  const prDate = document.getElementById('exPRDate')?.textContent || '';
  const exTitle = document.getElementById('exChartTitle')?.textContent || '';
  const text = `New PR in ${exTitle}: ${prText} (${prDate}) via ADDAPT`;
  if (window.navigator.share) {
    window.navigator.share({
      title: 'Personal Record',
      text
    }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    showToast('PR copied to clipboard!','');
  } else {
    showToast('Sharing not supported.','');
  }
}

// Patch goTo to render gallery on Strength screen
const origGoTo = window.goTo;
window.goTo = function(id) {
  try{
    origGoTo(id);
    if(['home','trainingHub','nutritionHub','statsHub','sauna'].includes(id))refreshPrimarySurfaces();
  }catch(err){
    trackFlowEvent('go_to_wrapper_error',{target:id,message:err?.message||String(err)});
    showToast('Navigation issue','Could not open that page. Please try again.');
  }
}

function formatClock(seconds){const mins=String(Math.floor(seconds/60)).padStart(2,'0');const secs=String(seconds%60).padStart(2,'0');return `${mins}:${secs}`;}
function getMinuteCue(minute){return APP_STATE.workoutTimer.cues[minute%APP_STATE.workoutTimer.cues.length];}
function saveWorkoutTimerState(){
  const wt=APP_STATE.workoutTimer;
  localStorage.setItem(WORKOUT_TIMER_STORAGE_KEY,JSON.stringify({running:wt.running,seconds:wt.seconds,lastMinute:wt.lastMinute,startEpoch:wt.startEpoch,activeExercise:wt.activeExercise,activeSet:wt.activeSet,restSeconds:wt.restSeconds,savedAt:Date.now()}));
}
function loadWorkoutTimerState(){
  const raw=localStorage.getItem(WORKOUT_TIMER_STORAGE_KEY);
  if(!raw)return;
  try{
    const parsed=JSON.parse(raw);
    const wt=APP_STATE.workoutTimer;
    wt.running=!!parsed.running;
    wt.seconds=parseInt(parsed.seconds,10)||0;
    wt.lastMinute=parseInt(parsed.lastMinute,10)||-1;
    wt.startEpoch=parsed.startEpoch||null;
    wt.activeExercise=parsed.activeExercise||'';
    wt.activeSet=Math.max(1,parseInt(parsed.activeSet,10)||1);
    wt.restSeconds=Math.max(0,parseInt(parsed.restSeconds,10)||0);
  }catch(err){}
}
function notifyMinuteCue(minute,cue){
  if(navigator.vibrate)navigator.vibrate(120);
  // Voice cue (speech synthesis)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const utter = new window.SpeechSynthesisUtterance(cue);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  }
  if('Notification' in window&&Notification.permission==='granted'){new Notification('ADDAPT minute '+minute,{body:cue,silent:true,tag:'addapt-workout-minute',renotify:true});}
}
function updateMediaSession(minute,cue){
  const wt=APP_STATE.workoutTimer;
  if(!('mediaSession' in navigator))return;
  try{
    const restText=wt.restSeconds>0?` · Rest ${formatClock(wt.restSeconds)}`:'';
    navigator.mediaSession.metadata=new MediaMetadata({title:`${wt.activeExercise||'Workout'} · Set ${wt.activeSet}`,artist:'ADDAPT workout',album:`${formatClock(wt.seconds)}${restText}`});
    navigator.mediaSession.playbackState=wt.running?'playing':'paused';
    navigator.mediaSession.setActionHandler('play',()=>toggleWorkoutTimer());
    navigator.mediaSession.setActionHandler('pause',()=>toggleWorkoutTimer());
    navigator.mediaSession.setActionHandler('stop',()=>resetWorkoutTimer());
  }catch(err){}
  const sub=document.getElementById('wTimerSub');
  if(sub)sub.textContent=cue||`${wt.activeExercise||'Exercise not selected'} · Set ${wt.activeSet}${wt.restSeconds>0?` · Rest ${formatClock(wt.restSeconds)}`:''}`;
}
function renderWorkoutTimer(){
  const wt=APP_STATE.workoutTimer;
  const clock=document.getElementById('wTimerClock');
  const tick=document.getElementById('minuteTick');
  const cue=document.getElementById('minuteCue');
  const btn=document.getElementById('wTimerBtn');
  const sel=document.getElementById('wTimerExerciseSel');
  const setEl=document.getElementById('wTimerSet');
  const restPill=document.getElementById('wRestPill');
  const restClock=document.getElementById('wRestClock');
  if(clock)clock.textContent=formatClock(wt.seconds);
  if(tick)tick.textContent='M'+String(Math.floor(wt.seconds/60)).padStart(2,'0');
  if(cue){
    if(wt.emomEnabled){
      const round=Math.min(Math.max(1,Math.floor(wt.seconds/(wt.emomWork+wt.emomRest))+1),Math.max(1,wt.emomTargetMinutes));
      let phase, phaseTime, phaseLeft;
      const cycle = wt.emomWork + wt.emomRest;
      const inWork = (wt.seconds % cycle) < wt.emomWork;
      if(inWork){
        phase = 'Work';
        phaseTime = wt.emomWork;
        phaseLeft = wt.emomWork - (wt.seconds % cycle);
      }else{
        phase = 'Rest';
        phaseTime = wt.emomRest;
        phaseLeft = wt.emomRest - ((wt.seconds - wt.emomWork) % cycle);
      }
      let ex = '';
      let target='';
      if(Array.isArray(wt.emomExercisePlan) && wt.emomExercisePlan.length>0){
        const item=wt.emomExercisePlan[(round-1)%wt.emomExercisePlan.length];
        ex=item?.name||'';
        target=item?.reps?`${item.reps} reps`:'';
      }else if(Array.isArray(wt.emomExercises) && wt.emomExercises.length>0){
        ex = wt.emomExercises[(round-1)%wt.emomExercises.length];
      }
      cue.textContent = `EMOM: Round ${round}/${wt.emomTargetMinutes} — ${phase} ${phaseLeft}s${ex?` — ${ex}${target?` (${target})`:''}`:''}`;
    }else cue.textContent=wt.seconds===0?'Start your workout timer to trigger a cue every minute.':getMinuteCue(Math.max(0,Math.floor((wt.seconds-1)/60)));
  }
  if(btn)btn.textContent=wt.running?'Pause':'Start';
  if(setEl)setEl.textContent='Set '+wt.activeSet;
  if(restPill)restPill.style.display=wt.restSeconds>0?'inline-flex':'none';
  if(restClock)restClock.textContent=formatClock(wt.restSeconds);
  if(sel&&wt.activeExercise&&sel.value!==wt.activeExercise)sel.value=wt.activeExercise;
  saveWorkoutTimerState();
}
function setWorkoutTimerActive(active){
  const wt=APP_STATE.workoutTimer;
  clearInterval(wt.interval);
  if(!active)wt.startEpoch=null;
  wt.running=active;
  if(!active){updateMediaSession(Math.floor(wt.seconds/60),null);renderWorkoutTimer();return;}
  if(!wt.startEpoch)wt.startEpoch=Date.now()-wt.seconds*1000;
  if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
  wt.interval=setInterval(()=>{
    wt.seconds=Math.max(0,Math.floor((Date.now()-wt.startEpoch)/1000));
    if(wt.emomEnabled){
      const cycle = wt.emomWork + wt.emomRest;
      const round = Math.floor(wt.seconds / cycle) + 1;
      const inWork = (wt.seconds % cycle) < wt.emomWork;
      // Cue at start of each round
      if(wt.seconds>0 && (wt.seconds % cycle)===0 && round!==wt.lastMinute){
        wt.lastMinute=round;
        let ex = '';
        let target='';
        if(Array.isArray(wt.emomExercisePlan) && wt.emomExercisePlan.length>0){
          const item=wt.emomExercisePlan[(round-1)%wt.emomExercisePlan.length];
          ex=item?.name||'';
          target=item?.reps?`${item.reps} reps`:'';
        }else if(Array.isArray(wt.emomExercises) && wt.emomExercises.length>0){
          ex = wt.emomExercises[(round-1)%wt.emomExercises.length];
        }
        wt.activeExercise=ex||wt.activeExercise;
        const cue = `Round ${round} starts now.${ex?` — ${ex}${target?` (${target})`:''}`:''}`;
        wt.activeSet = round;
        notifyMinuteCue(round, cue);
        updateMediaSession(round, cue);
      }
      if(round > wt.emomTargetMinutes){
        setWorkoutTimerActive(false);
        showToast('EMOM complete',`${wt.emomTargetMinutes} min done.`);
      }
    }else{
      const minute=Math.floor(wt.seconds/60);
      if(wt.seconds>0&&wt.seconds%60===0&&minute!==wt.lastMinute){
        wt.lastMinute=minute;
        const cue=getMinuteCue(minute-1);
        notifyMinuteCue(minute,cue);
        updateMediaSession(minute,cue);
      }
    }
    renderWorkoutTimer();
  },1000);
  updateMediaSession(Math.floor(wt.seconds/60),getMinuteCue(Math.floor(wt.seconds/60)));
  renderWorkoutTimer();
}
function toggleWorkoutTimer(){setWorkoutTimerActive(!APP_STATE.workoutTimer.running);}
window.toggleWorkoutTimer=toggleWorkoutTimer;
function setWorkoutExerciseFromSelect(){const sel=document.getElementById('wTimerExerciseSel');if(!sel)return;APP_STATE.workoutTimer.activeExercise=sel.value||'';renderWorkoutTimer();updateMediaSession(Math.floor(APP_STATE.workoutTimer.seconds/60),null);}
window.setWorkoutExerciseFromSelect=setWorkoutExerciseFromSelect;
function bumpWorkoutSet(){APP_STATE.workoutTimer.activeSet++;renderWorkoutTimer();updateMediaSession(Math.floor(APP_STATE.workoutTimer.seconds/60),null);}
window.bumpWorkoutSet=bumpWorkoutSet;
function startEmomTimer(minutes=12,workSeconds=40,restSeconds=20,exerciseList=[]){
  const wt=APP_STATE.workoutTimer;
  const normalized=(Array.isArray(exerciseList)?exerciseList:[]).map(item=>{
    if(typeof item==='string')return{name:item,reps:10,key:item.toLowerCase().replace(/[^a-z0-9]+/g,'_')};
    return{name:String(item?.name||'').trim(),reps:Math.max(1,Math.min(80,parseInt(item?.reps,10)||10)),key:String(item?.key||'').trim()};
  }).filter(item=>item.name);
  wt.emomEnabled=true;
  wt.emomTargetMinutes=Math.max(1,Math.min(40,parseInt(minutes,10)||12));
  wt.emomWork=Math.max(10,Math.min(60,parseInt(workSeconds,10)||40));
  wt.emomRest=Math.max(0,Math.min(50,parseInt(restSeconds,10)||20));
  wt.emomExercisePlan=normalized;
  wt.emomExercises=normalized.map(item=>item.name);
  wt.activeExercise=wt.emomExercises[0]||wt.activeExercise||'';
  wt.activeSet=1;
  wt.lastMinute=-1;
  wt.seconds=0;
  wt.startEpoch=Date.now();
  stopRestTimer(true);
  setWorkoutTimerActive(true);
  showToast('EMOM started',`${wt.emomTargetMinutes} min · ${wt.emomWork}s work / ${wt.emomRest}s rest.`);
}
window.startEmomTimer=startEmomTimer;
function stopRestTimer(resetDisplay){const wt=APP_STATE.workoutTimer;clearInterval(wt.restInterval);wt.restInterval=null;if(resetDisplay)wt.restSeconds=0;renderWorkoutTimer();}
function startRestTimer(seconds=90){const wt=APP_STATE.workoutTimer;stopRestTimer(false);wt.restSeconds=Math.max(1,parseInt(seconds,10)||90);renderWorkoutTimer();updateMediaSession(Math.floor(wt.seconds/60),null);wt.restInterval=setInterval(()=>{wt.restSeconds=Math.max(0,wt.restSeconds-1);renderWorkoutTimer();updateMediaSession(Math.floor(wt.seconds/60),null);if(wt.restSeconds===0){stopRestTimer(true);notifyMinuteCue(Math.floor(wt.seconds/60),'Rest complete - start next set.');showToast('Rest complete','Start your next set.');}},1000);}
window.startRestTimer=startRestTimer;
function resetWorkoutTimer(){
  const wt=APP_STATE.workoutTimer;
  clearInterval(wt.interval);
  stopRestTimer(true);
  wt.running=false;
  wt.startEpoch=null;
  wt.seconds=0;
  wt.lastMinute=-1;
  wt.activeSet=1;
  wt.emomEnabled=false;
  wt.emomTargetMinutes=0;
  wt.emomWork=40;
  wt.emomRest=20;
  wt.emomExercises=[];
  wt.emomExercisePlan=[];
  renderWorkoutTimer();
  updateMediaSession(0,null);
  const sub=document.getElementById('wTimerSub');
  if(sub)sub.textContent='Lockscreen card ready when timer starts.';
}
window.resetWorkoutTimer=resetWorkoutTimer;
function launchEmomFromHome(){pendingLogMode='emom';goTo('logselect');renderLogSelect();}
window.launchEmomFromHome=launchEmomFromHome;
loadWorkoutTimerState();
if(APP_STATE.workoutTimer.running){setWorkoutTimerActive(true);}else{renderWorkoutTimer();}
const APP_I18N={
  en:{
    intro:{
      hero:{
        kicker:'Why ADDAPT Hits Different',
        title:'One app for your plan, progress, food and recovery',
        copy:'Instead of giving you one fixed routine, ADDAPT keeps updating your training and diet from your real check-ins, saved lifts, bodyweight trend and recovery score.',
        pill1:'Addaptive training split',
        pill2:'Auto calorie shifts',
        pill3:'Weight analytics',
        pill4:'Goal-based sauna guide'
      },
      tour:{
        kicker:'How To Use ADDAPT',
        title:'Check in, train, log, improve',
        copy:'The app works best when you run the loop: update your status, follow the plan, log your lifts, then let ADDAPT adjust the next block around what actually happened.',
        f1:{title:'Check-In drives the plan',copy:'Energy, sleep, diet, lifts and bodyweight feed the adaptive engine so calories and training mode stay aligned with your real week.'},
        f2:{title:'Training and analytics stay connected',copy:'Current Plan shows the split, Log Session stores performance, and Strength Progress turns that into PR tracking, charts and useful weight history.'},
        f3:{title:'Recovery gets its own system',copy:'Sauna Calculator gives a guide for cardio, stress, recovery or longevity with heat protocol, timer, hydration and weekly placement.'},
        safari:'In Safari: tap Share then Add to Home Screen for the full native app experience.',
        legal:'Built for general fitness and recovery planning. If you are dealing with injury, symptoms, or treatment decisions, use a qualified clinician for that part.'
      }
    },
    home:{
      greeting:'Hey {name}',
      goalSub:'{goal} plan active',
      streak:{title:'{count}-week streak',done:'You already locked in this week.',pending:'One check-in this week keeps it alive.'},
      checkin:{today:'You checked in today — check in again anytime',yesterday:'Last check-in: yesterday — update your plan?',daysAgo:'Last check-in: {days} days ago — update your plan now'},
      card:{
        checkin:{title:'Check-In',desc:'Log energy, lifts and diet — get your updated plan instantly'},
        plan:{title:'Current Plan',desc:'View your personalised training and diet'},
        log:{title:'Log Session',desc:'Record today\'s lifts and track strength progress'},
        emom:{title:'EMOM',desc:'Quick minute-by-minute rounds with auto set tracking'},
        strength:{title:'Strength Progress',desc:'Exercise charts, PRs and volume'},
        sauna:{title:'Sauna Calculator',badge:'Hot New',desc:'Heat protocol, timer, hydration and weekly planning for recovery work'},
        history:{title:'Check-In History',desc:'Weight chart and all past check-ins'},
        settings:{title:'Settings and Profile',desc:'Edit goals, calories, focus muscles, session length'}
      }
    },
    walkthrough:{
      step:'Feature {current} of {total}',
      spotlight:'Now showing',
      skip:'Skip',
      next:'Next',
      finish:'Finish',
      checkin:{title:'Check-In',copy:'Start here most often. This updates your calories, recovery mode, training focus, and the next version of your plan from your real data.'},
      plan:{title:'Current Plan',copy:'This is your live split. It shows the exact sessions, set bank logic, frequency, and why the week is structured the way it is.'},
      log:{title:'Log Session',copy:'Store your lifts after training so ADDAPT can keep building suggestions from your actual performance, not guesses.'},
      strength:{title:'Strength Progress',copy:'Track PRs, exercise load trends, volume, and bodyweight changes so progress is visible and measurable.'},
      sauna:{title:'Sauna Calculator',copy:'Use goal-specific sauna guidance for recovery, cardio, stress relief or longevity with protocol, timer, hydration and weekly planning.'},
      history:{title:'Check-In History',copy:'Look back at bodyweight, old check-ins and plan changes so you can spot trends across whole blocks, not just single days.'},
      settings:{title:'Settings and Profile',copy:'Change goals, session length, focus muscles and other inputs whenever your priorities change.'}
    },
    settings:{
      title:'Profile and Settings',
      redo:'Redo Onboarding',
      reset:'Reset My Data',
      signout:'Sign Out',
      helper:'Tap Redo Onboarding to update any setting.',
      label:{
        goal:'Goal',
        sex:'Sex',
        age:'Age',
        experience:'Experience',
        days:'Days/week',
        session:'Session length',
        focus:'Focus muscles',
        equipment:'Equipment',
        diet:'Diet goal',
        goalWeight:'Goal weight'
      }
    },
    history:{loading:'Loading...',empty:'No check-ins yet.',today:'Today',yesterday:'Yesterday',daysAgo:'{days} days ago',energy:'energy'},
    toast:{
      welcome:{title:'Welcome to ADDAPT',body:'Your personalised plan is ready.'},
      resetFail:{title:'Reset failed',body:'Your data could not be cleared right now.'},
      resetDone:{title:'Data reset',body:'Your account is ready for a fresh start.'}
    },
    confirm:{reset:'Delete your profile, check-ins, and logged sessions and start over?'},
    level:{rookie:'Rookie',consistent:'Consistent',dedicated:'Dedicated',elite:'Elite'},
    enum:{
      goal:{vtaper:'V-Taper',hourglass:'Hourglass',strength:'Strength',general:'General Fitness'},
      experience:{beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'},
      sex:{male:'Male',female:'Female',other:'Other'},
      equipment:{full:'Full Gym',dumbbells:'Dumbbells Only',bands:'Resistance Bands',none:'Bodyweight Only'},
      dietGoal:{bulk:'Bulk',maintain:'Maintain',cut:'Cut'},
      muscle:{chest:'Chest',back:'Back',shoulders:'Shoulders',biceps:'Biceps',triceps:'Triceps',glutes:'Glutes',quads:'Quads',hamstrings:'Hamstrings',core:'Core',calves:'Calves'}
    }
  },
  de:{
    intro:{
      hero:{
        kicker:'Warum ADDAPT heraussticht',
        title:'Eine App fuer Trainingsplan, Fortschritt, Ernaehrung und Regeneration',
        copy:'Statt dir einmal einen festen Plan zu geben, passt ADDAPT dein Training und deine Ernaehrung laufend an echte Check-ins, gespeicherte Lifts, Gewichtstrends und deinen Erholungsstatus an.',
        pill1:'Addaptiver Trainingssplit',
        pill2:'Automatische Kalorienanpassung',
        pill3:'Gewichtsanalyse',
        pill4:'Zielbasierter Sauna-Guide'
      },
      tour:{
        kicker:'So nutzt du ADDAPT',
        title:'Einchecken, trainieren, loggen, verbessern',
        copy:'Die App funktioniert am besten, wenn du diesen Kreislauf nutzt: Status updaten, Plan ausfuehren, Lifts loggen und den naechsten Block von ADDAPT anhand deiner echten Woche anpassen lassen.',
        f1:{title:'Der Check-In steuert den Plan',copy:'Energie, Schlaf, Ernaehrung, Lifts und Koerpergewicht fuettern die adaptive Engine, damit Kalorien und Trainingsmodus zu deiner echten Woche passen.'},
        f2:{title:'Training und Analytik greifen ineinander',copy:'Current Plan zeigt den Split, Log Session speichert die Leistung und Strength Progress macht daraus PR-Tracking, Charts und eine brauchbare Gewichtshistorie.'},
        f3:{title:'Regeneration bekommt ein eigenes System',copy:'Der Sauna Calculator liefert je nach Ziel einen Leitfaden fuer Cardio, Stress, Regeneration oder Langlebigkeit inklusive Protokoll, Timer, Hydration und Wochenplanung.'},
        safari:'In Safari: Tippe auf Teilen und dann auf Zum Home-Bildschirm fuer das volle native App-Gefuehl.',
        legal:'Gedacht fuer allgemeine Fitness- und Regenerationsplanung. Bei Verletzungen, Symptomen oder medizinischen Entscheidungen sollte eine qualifizierte Fachperson uebernehmen.'
      }
    },
    home:{
      greeting:'Hi {name}',
      goalSub:'{goal}-Plan aktiv',
      streak:{title:'{count}-Wochen-Serie',done:'Diese Woche ist schon gesichert.',pending:'Ein Check-In diese Woche haelt die Serie am Leben.'},
      checkin:{today:'Du hast heute schon eingecheckt — du kannst jederzeit erneut aktualisieren',yesterday:'Letzter Check-In: gestern — Plan aktualisieren?',daysAgo:'Letzter Check-In: vor {days} Tagen — jetzt deinen Plan aktualisieren'},
      card:{
        checkin:{title:'Check-In',desc:'Energie, Lifts und Ernaehrung eintragen — dein Plan wird sofort angepasst'},
        plan:{title:'Aktueller Plan',desc:'Deinen personalisierten Trainings- und Ernaehrungsplan ansehen'},
        log:{title:'Session loggen',desc:'Heutige Lifts speichern und Kraftfortschritt verfolgen'},
        emom:{title:'EMOM',desc:'Schnelle Minutentakte mit automatischer Satzzaehlung'},
        strength:{title:'Kraftfortschritt',desc:'Uebungs-Charts, PRs und Volumen'},
        sauna:{title:'Sauna Calculator',badge:'Neu',desc:'Hitzeprotokoll, Timer, Hydration und Wochenplanung fuer deine Regeneration'},
        history:{title:'Check-In-Verlauf',desc:'Gewichtskurve und alle bisherigen Check-ins'},
        settings:{title:'Einstellungen und Profil',desc:'Ziele, Kalorien, Fokusmuskeln und Session-Laenge anpassen'}
      }
    },
    walkthrough:{
      step:'Feature {current} von {total}',
      spotlight:'Gerade sichtbar',
      skip:'Ueberspringen',
      next:'Weiter',
      finish:'Fertig',
      checkin:{title:'Check-In',copy:'Hier startest du am haeufigsten. Dieser Bereich aktualisiert Kalorien, Erholungsmodus, Trainingsfokus und die naechste Version deines Plans anhand echter Daten.'},
      plan:{title:'Aktueller Plan',copy:'Das ist dein live adaptierter Split. Hier siehst du Sessions, Set-Bank-Logik, Frequenz und warum die Woche genau so aufgebaut ist.'},
      log:{title:'Session loggen',copy:'Speichere nach dem Training deine Lifts, damit ADDAPT Vorschlaege auf echter Leistung statt auf Schaetzungen aufbaut.'},
      strength:{title:'Kraftfortschritt',copy:'Verfolge PRs, Lasttrends, Volumen und Gewichtsentwicklung, damit Fortschritt sichtbar und messbar wird.'},
      sauna:{title:'Sauna Calculator',copy:'Nutze zielbasierte Sauna-Empfehlungen fuer Regeneration, Cardio, Stressabbau oder Langlebigkeit inklusive Protokoll, Timer, Hydration und Wochenplanung.'},
      history:{title:'Check-In-Verlauf',copy:'Sieh dir Gewicht, alte Check-ins und Planveraenderungen ueber ganze Bloecke hinweg an statt nur ueber einzelne Tage.'},
      settings:{title:'Einstellungen und Profil',copy:'Passe Ziele, Session-Laenge, Fokusmuskeln und andere Inputs an, sobald sich deine Prioritaeten aendern.'}
    },
    settings:{
      title:'Profil und Einstellungen',
      redo:'Onboarding erneut starten',
      reset:'Meine Daten zuruecksetzen',
      signout:'Abmelden',
      helper:'Tippe auf Onboarding erneut starten, um deine Angaben zu aktualisieren.',
      label:{
        goal:'Ziel',
        sex:'Geschlecht',
        age:'Alter',
        experience:'Erfahrung',
        days:'Tage/Woche',
        session:'Session-Laenge',
        focus:'Fokusmuskeln',
        equipment:'Equipment',
        diet:'Ernaehrungsziel',
        goalWeight:'Zielgewicht'
      }
    },
    history:{loading:'Wird geladen...',empty:'Noch keine Check-ins.',today:'Heute',yesterday:'Gestern',daysAgo:'vor {days} Tagen',energy:'Energie'},
    toast:{
      welcome:{title:'Willkommen bei ADDAPT',body:'Dein personalisierter Plan ist bereit.'},
      resetFail:{title:'Zuruecksetzen fehlgeschlagen',body:'Deine Daten konnten gerade nicht geloescht werden.'},
      resetDone:{title:'Daten zurueckgesetzt',body:'Dein Account ist bereit fuer einen frischen Start.'}
    },
    confirm:{reset:'Profil, Check-ins und geloggte Sessions loeschen und neu starten?'},
    level:{rookie:'Rookie',consistent:'Konstant',dedicated:'Engagiert',elite:'Elite'},
    enum:{
      goal:{vtaper:'V-Taper',hourglass:'Hourglass',strength:'Kraft',general:'Allgemeine Fitness'},
      experience:{beginner:'Anfaenger',intermediate:'Fortgeschritten',advanced:'Sehr fortgeschritten'},
      sex:{male:'Maennlich',female:'Weiblich',other:'Divers'},
      equipment:{full:'Volles Gym',dumbbells:'Nur Kurzhanteln',bands:'Widerstandsbaender',none:'Nur Koerpergewicht'},
      dietGoal:{bulk:'Aufbau',maintain:'Erhalten',cut:'Diät'},
      muscle:{chest:'Brust',back:'Ruecken',shoulders:'Schultern',biceps:'Bizeps',triceps:'Trizeps',glutes:'Glutes',quads:'Quadrizeps',hamstrings:'Hamstrings',core:'Core',calves:'Waden'}
    }
  }
};
function getAppLocale(){
  const prefs=[...(navigator.languages||[]),navigator.language,'en'].filter(Boolean).map(v=>String(v).toLowerCase());
  for(const pref of prefs){
    if(APP_I18N[pref])return pref;
    const base=pref.split('-')[0];
    if(APP_I18N[base])return base;
  }
  return 'en';
}
const APP_LOCALE=getAppLocale();
function t(key){
  const walk=(src)=>key.split('.').reduce((acc,part)=>acc&&acc[part]!==undefined?acc[part]:undefined,src);
  return walk(APP_I18N[APP_LOCALE])??walk(APP_I18N.en)??key;
}
function tf(key,vars={}){
  return String(t(key)).replace(/\{(\w+)\}/g,(_,name)=>vars[name]??'');
}
function applyI18n(root=document){
  document.documentElement.lang=APP_LOCALE;
  root.querySelectorAll('[data-i18n]').forEach(el=>{const text=t(el.dataset.i18n);if(text)el.textContent=text;});
}
function trEnum(group,value){
  if(value===undefined||value===null||value==='')return '—';
  const text=t(`enum.${group}.${value}`);
  return text===`enum.${group}.${value}`?cap(String(value)):text;
}
function goalLabel(goal){return trEnum('goal',goal);}
const FEATURE_WALKTHROUGH=[
  {target:'wtCheckin',titleKey:'walkthrough.checkin.title',copyKey:'walkthrough.checkin.copy'},
  {target:'wtPlan',titleKey:'walkthrough.plan.title',copyKey:'walkthrough.plan.copy'},
  {target:'wtLog',titleKey:'walkthrough.log.title',copyKey:'walkthrough.log.copy'},
  {target:'wtStrength',titleKey:'walkthrough.strength.title',copyKey:'walkthrough.strength.copy'},
  {target:'wtSauna',titleKey:'walkthrough.sauna.title',copyKey:'walkthrough.sauna.copy'},
  {target:'wtHistory',titleKey:'walkthrough.history.title',copyKey:'walkthrough.history.copy'},
  {target:'wtSettings',titleKey:'walkthrough.settings.title',copyKey:'walkthrough.settings.copy'}
];
let walkthroughState={active:false,index:0};
function clearFeatureHighlight(){document.querySelectorAll('.walkthrough-highlight').forEach(el=>el.classList.remove('walkthrough-highlight'));}
function focusWalkthroughTarget(target){
  const scroller=document.querySelector('#home .home-scroll');
  if(!scroller){target.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const scrollerRect=scroller.getBoundingClientRect();
  const targetRect=target.getBoundingClientRect();
  const desiredTop=Math.max(28,Math.min(scroller.clientHeight*0.2,110));
  const nextTop=scroller.scrollTop+(targetRect.top-scrollerRect.top)-desiredTop;
  const maxTop=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
  scroller.scrollTo({top:Math.max(0,Math.min(nextTop,maxTop)),behavior:'smooth'});
}
async function markWalkthroughSeen(){
  if(!window.userProfile||window.userProfile.walkthroughSeen!==false)return;
  window.userProfile={...window.userProfile,walkthroughSeen:true};
  if(window.fbSaveProfile)await window.fbSaveProfile(window.userProfile);
}
function renderFeatureWalkthroughStep(){
  if(!walkthroughState.active)return;
  const step=FEATURE_WALKTHROUGH[walkthroughState.index];
  if(!step){closeFeatureWalkthrough(true);return;}
  const target=document.getElementById(step.target);
  if(!target){walkthroughState.index++;renderFeatureWalkthroughStep();return;}
  clearFeatureHighlight();
  focusWalkthroughTarget(target);
  document.getElementById('walkthroughStep').textContent=tf('walkthrough.step',{current:walkthroughState.index+1,total:FEATURE_WALKTHROUGH.length});
  document.getElementById('walkthroughChip').textContent=t('walkthrough.spotlight');
  document.getElementById('walkthroughTitle').textContent=t(step.titleKey);
  document.getElementById('walkthroughCopy').textContent=t(step.copyKey);
  document.getElementById('walkthroughSkipBtn').textContent=t('walkthrough.skip');
  document.getElementById('walkthroughNextBtn').textContent=walkthroughState.index===FEATURE_WALKTHROUGH.length-1?t('walkthrough.finish'):t('walkthrough.next');
  setTimeout(()=>{
    if(!walkthroughState.active)return;
    target.classList.add('walkthrough-highlight');
  },280);
}
function startFeatureWalkthrough(){
  if(walkthroughState.active||!document.getElementById('home')?.classList.contains('active'))return;
  walkthroughState={active:true,index:0};
  document.getElementById('walkthroughOverlay').classList.add('open');
  document.getElementById('walkthroughSheet').classList.add('open');
  renderFeatureWalkthroughStep();
}
async function closeFeatureWalkthrough(markSeen){
  walkthroughState.active=false;
  clearFeatureHighlight();
  document.getElementById('walkthroughOverlay').classList.remove('open');
  document.getElementById('walkthroughSheet').classList.remove('open');
  if(markSeen)await markWalkthroughSeen();
}
function nextFeatureWalkthrough(){
  if(!walkthroughState.active)return;
  if(walkthroughState.index>=FEATURE_WALKTHROUGH.length-1){closeFeatureWalkthrough(true);return;}
  walkthroughState.index++;
  renderFeatureWalkthroughStep();
}
window.startFeatureWalkthrough=startFeatureWalkthrough;
window.closeFeatureWalkthrough=closeFeatureWalkthrough;
window.nextFeatureWalkthrough=nextFeatureWalkthrough;
applyI18n();

// ── DATE UTILITIES ──
function toMs(dateVal){if(!dateVal)return 0;if(dateVal?.toDate)return dateVal.toDate().getTime();if(dateVal?.seconds)return dateVal.seconds*1000;return new Date(dateVal).getTime();}
function daysBetween(ms1,ms2){return Math.round(Math.abs(ms1-ms2)/(24*60*60*1000));}
function weeksBetween(ms1,ms2){return Math.round(Math.abs(ms1-ms2)/(7*24*60*60*1000));}
function daysAgo(ms){return daysBetween(ms,Date.now());}

// ── CHECK-IN META (show days since last) ──
async function populateCheckinMeta(){
  const p=window.userProfile;
  if(p?.weight&&p?.height&&p?.age){const sAdj=(p.sex||'male')==='female'?-161:5;const tdee=Math.round((10*(p.weight||75)+6.25*(p.height||175)-5*(p.age||25)+sAdj)*1.55);const el=document.getElementById('calCalcVal');if(el)el.textContent=tdee;}
  const badge=document.getElementById('ciSinceBadge');
  if(!badge)return;
  if(!window.fbLoadCheckins){badge.innerHTML='';return;}
  const checkins=await window.fbLoadCheckins();
  if(!checkins.length){badge.innerHTML=`<div class="ci-since">First check-in — welcome!</div>`;return;}
  const lastMs=toMs(checkins[0].createdAt);
  const days=daysAgo(lastMs);
  const label=days===0?'Today':days===1?'Yesterday':`${days} days ago`;
  const col=days<=3?'#c8ff00':days<=7?'#ffaa00':'#ff4d00';
  badge.innerHTML=`<div class="ci-since">Last check-in: <strong style="color:${col};">${label}</strong>&nbsp;·&nbsp;${checkins.length} total</div>`;
}

// ── CALORIE OVERRIDE ──
function toggleCalOverride(){
  calOverrideActive=!calOverrideActive;
  document.getElementById('calOverrideWrap').style.display=calOverrideActive?'block':'none';
  document.getElementById('calToggleBtn').textContent=calOverrideActive?'Use calculated':'Override';
  document.getElementById('calCalculatedDisplay').style.opacity=calOverrideActive?'0.5':'1';
}
window.toggleCalOverride=toggleCalOverride;
function getCalOverride(){if(!calOverrideActive)return null;const v=parseInt(document.getElementById('calOverrideInput').value);return v>0?v:null;}

// ── SLIDERS ──
function updS(sid,vid,val){const el=document.getElementById(vid);if(!el)return;el.textContent=val;const n=parseInt(val);el.style.color=n>=7?'#c8ff00':n>=4?'#ffaa00':'#ff4d00';}
window.updS=updS;
function selC(el,gid){document.querySelectorAll('#'+gid+' .chip').forEach(c=>{c.classList.remove('sel');c.style.borderColor='';c.style.color='';});el.classList.add('sel');}
window.selC=selC;

// ── ONBOARDING ──
let obStep=1;
const ONBOARDING_DRAFT_KEY='addapt_onboarding_draft_v1';
function getOnboardingDraft(){
  try{
    const raw=JSON.parse(localStorage.getItem(ONBOARDING_DRAFT_KEY)||'null');
    return raw&&typeof raw==='object'?raw:null;
  }catch{return null;}
}
function clearOnboardingDraft(){
  localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}
function persistOnboardingDraft(){
  const draft={
    obStep,
    obAnswers,
    selectedMuscles,
    selectedRestricts,
    selectedTrainDays,
    selectedNotifPrefs,
    savedAt:new Date().toISOString()
  };
  localStorage.setItem(ONBOARDING_DRAFT_KEY,JSON.stringify(draft));
}
function resumeOnboardingDraft(){
  const draft=getOnboardingDraft();
  if(!draft)return false;
  obAnswers=draft.obAnswers||{};
  selectedMuscles=Array.isArray(draft.selectedMuscles)?draft.selectedMuscles.slice(0,2):[];
  selectedRestricts=Array.isArray(draft.selectedRestricts)&&draft.selectedRestricts.length?draft.selectedRestricts:['none'];
  selectedTrainDays=Array.isArray(draft.selectedTrainDays)?draft.selectedTrainDays:[];
  selectedNotifPrefs={checkin:true,emom:false,sauna:false,...(draft.selectedNotifPrefs||{})};
  obStep=Math.min(OB_TOTAL,Math.max(1,parseInt(draft.obStep,10)||1));
  const setInput=(id,val)=>{const el=document.getElementById(id);if(el&&val!==undefined&&val!==null&&val!=='')el.value=val;};
  setInput('obH',obAnswers.height);
  setInput('obW',obAnswers.weight);
  setInput('obA',obAnswers.age);
  setInput('obGW',obAnswers.goalWeight);
  setInput('obCustomCalories',obAnswers.customCalories);
  document.querySelectorAll('#daysSel .day-btn').forEach(btn=>btn.classList.toggle('sel',Number(btn.textContent.trim())===Number(obAnswers.days||0)));
  document.querySelectorAll('#trainDaySel .day-btn').forEach(btn=>btn.classList.toggle('sel',selectedTrainDays.includes(btn.textContent.trim())));
  document.querySelectorAll('#muscleChips .chip').forEach(chip=>{
    const val=(chip.getAttribute('onclick')||'').match(/'([^']+)'\)/)?.[1]||'';
    chip.classList.remove('sel','sel2');
    const idx=selectedMuscles.indexOf(val);
    if(idx===0)chip.classList.add('sel');
    if(idx===1)chip.classList.add('sel2');
  });
  document.querySelectorAll('#restrictChips .chip').forEach(chip=>chip.classList.toggle('sel',selectedRestricts.includes(chip.dataset.val||'')));
  document.querySelectorAll('#notifChips .chip').forEach(chip=>{
    const key=chip.textContent.trim().toLowerCase();
    const map={checkin:'checkin',emom:'emom',sauna:'sauna'};
    chip.classList.toggle('sel',Boolean(selectedNotifPrefs[map[key]]));
  });
  syncSplitSuggestion();
  checkOb9();
  checkOb10();
  checkOb11();
  const note=document.getElementById('trainDayNote');
  const text=document.getElementById('trainDayText');
  const targetCount=parseInt(obAnswers.days,10)||0;
  if(note&&text&&targetCount){
    note.style.display='block';
    text.textContent=selectedTrainDays.length===targetCount?selectedTrainDays.join(' · '):`${selectedTrainDays.length}/${targetCount} days selected`;
  }
  showToast('Onboarding resumed','Your last onboarding progress has been restored.');
  return true;
}
function resetOnboardingState(){
  selectedTrainDays=[];
  selectedNotifPrefs={checkin:true,emom:false,sauna:false};
  syncOnboardingPrefills();
}
function startOb(forceFresh=false){obStep=1;obAnswers={};selectedMuscles=[];selectedRestricts=['none'];document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));document.getElementById('ob1').classList.add('active');document.getElementById('obBar').style.width=(1/OB_TOTAL*100)+'%';document.querySelectorAll('.opt-card').forEach(c=>c.classList.remove('sel','sel-p'));document.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel','sel2'));document.querySelectorAll('#daysSel .day-btn,#trainDaySel .day-btn').forEach(b=>b.classList.remove('sel'));const nc=document.querySelector('#restrictChips [data-val="none"]');if(nc)nc.classList.add('sel');resetOnboardingState();if(!forceFresh&&resumeOnboardingDraft()){document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));document.getElementById('ob'+obStep)?.classList.add('active');document.getElementById('obBar').style.width=(obStep/OB_TOTAL*100)+'%';}}
window.startOb=startOb;
function syncOnboardingPrefills(){
  selectedTrainDays=[];
  selectedNotifPrefs={checkin:true,emom:false,sauna:false};
  document.querySelectorAll('#trainDaySel .day-btn').forEach(btn=>btn.classList.remove('sel'));
  document.querySelectorAll('#notifChips .chip').forEach(chip=>chip.classList.remove('sel'));
  const checkinChip=[...document.querySelectorAll('#notifChips .chip')].find(el=>el.textContent.trim()==='Check-In');
  if(checkinChip)checkinChip.classList.add('sel');
  const note=document.getElementById('trainDayNote');
  if(note)note.style.display='none';
  const target=document.getElementById('obTrainDayTarget');
  if(target)target.textContent=String(parseInt(obAnswers.days,10)||0);
}
function syncSplitSuggestion(){const days=parseInt(obAnswers.days,10);if(!days)return;const g=obAnswers.goal||'general';const splitText=document.getElementById('splitText');const splitDaysText=document.getElementById('splitDaysText');const splitSug=document.getElementById('splitSug');if(splitText)splitText.textContent=(SPLITS[g]||SPLITS.general)[days]||'';if(splitDaysText)splitDaysText.textContent=SCHED[days]||'';if(splitSug)splitSug.style.display='block';}
function obSel(el,key,val){el.closest('.opt-grid').querySelectorAll('.opt-card').forEach(c=>c.classList.remove('sel','sel-p'));el.classList.add(key==='goal'&&val==='hourglass'?'sel-p':'sel');obAnswers[key]=val;if(key==='goal')syncSplitSuggestion();const nb=document.getElementById('ob'+obStep+'n');if(nb)nb.disabled=false;persistOnboardingDraft();}
window.obSel=obSel;

const SPLITS={vtaper:{1:'Full Body',2:'Full Body A / Full Body B',3:'Upper A / Lower / Upper B',4:'Upper A / Lower / Upper B / Lower',5:'Upper A / Lower / Upper B / Lower / Shoulder+Back Focus',6:'Push / Pull / Legs / Push / Pull / Shoulder+Back Focus',7:'6-day + Active Recovery'},hourglass:{1:'Full Body (Glute Focus)',2:'Full Body A (Glute) / Full Body B (Pull+Ham)',3:'Lower Glute / Lower Ham / Upper',4:'Lower Glute / Upper / Lower Ham / Upper',5:'Lower Glute / Upper / Lower Ham / Lower Glute / Upper',6:'Lower Glute / Upper / Glute Focus / Lower Glute / Upper / Glute Focus',7:'6-day + Active Recovery'},strength:{1:'Full Body (Compound)',2:'Full Body A / Full Body B',3:'Squat / Press / Deadlift',4:'Squat / Bench / Deadlift / OHP',5:'Squat / Bench / Deadlift / OHP / Row',6:'Squat / Bench / Deadlift / OHP / Row / Squat Variation',7:'6-day + Active Recovery'},general:{1:'Full Body',2:'Full Body A / Full Body B',3:'Push / Pull / Legs',4:'Upper A / Lower / Upper B / Lower',5:'Upper A / Lower / Upper B / Lower / Full Body',6:'Push / Pull / Legs / Push / Pull / Legs',7:'6-day + Active Recovery'}};
const SCHED={1:'Mon',2:'Mon · Thu',3:'Mon · Wed · Fri',4:'Mon · Tue · Thu · Fri',5:'Mon · Tue · Thu · Fri · Sat',6:'Mon–Sat',7:'Mon–Sun'};

function selDay(el,n){document.querySelectorAll('#daysSel .day-btn').forEach(b=>b.classList.remove('sel'));el.classList.add('sel');obAnswers.days=n;selectedTrainDays=[];syncOnboardingPrefills();document.getElementById('ob4n').disabled=false;syncSplitSuggestion();persistOnboardingDraft();}
window.selDay=selDay;
function toggleTrainDay(el,day){
  const targetCount=parseInt(obAnswers.days,10)||0;
  if(!targetCount)return;
  if(el.classList.contains('sel')){el.classList.remove('sel');selectedTrainDays=selectedTrainDays.filter(d=>d!==day);}else{
    if(selectedTrainDays.length>=targetCount){document.getElementById('trainDayText').textContent=`Choose exactly ${targetCount} days.`;document.getElementById('trainDayNote').style.display='block';return;}
    el.classList.add('sel');selectedTrainDays.push(day);
  }
  selectedTrainDays=selectedTrainDays.sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));
  const note=document.getElementById('trainDayNote');
  const text=document.getElementById('trainDayText');
  if(note&&text){
    note.style.display='block';
    text.textContent=selectedTrainDays.length===targetCount?selectedTrainDays.join(' · '):`${selectedTrainDays.length}/${targetCount} days selected`;
  }
  document.getElementById('ob5n').disabled=selectedTrainDays.length!==targetCount;
  persistOnboardingDraft();
}
window.toggleTrainDay=toggleTrainDay;
function selMuscle(el,val){if(el.classList.contains('sel')||el.classList.contains('sel2')){el.classList.remove('sel','sel2');selectedMuscles=selectedMuscles.filter(m=>m!==val);}else{if(selectedMuscles.length>=2){document.getElementById('muscleNote').textContent='Deselect one first.';return;}selectedMuscles.push(val);el.classList.add(selectedMuscles.length===1?'sel':'sel2');}document.getElementById('muscleNote').textContent=selectedMuscles.length===2?selectedMuscles.map(cap).join(' and ')+' — priority every session.':selectedMuscles.length===1?'Pick one more.':'Pick 2 muscles.';document.getElementById('ob7n').disabled=selectedMuscles.length!==2;persistOnboardingDraft();}
window.selMuscle=selMuscle;
function selRestrict(el,val){const noneChip=document.querySelector('#restrictChips [data-val="none"]');if(val==='none'){document.querySelectorAll('#restrictChips .chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');selectedRestricts=['none'];}else{if(noneChip)noneChip.classList.remove('sel');el.classList.toggle('sel');if(el.classList.contains('sel')){if(!selectedRestricts.includes(val))selectedRestricts.push(val);}else selectedRestricts=selectedRestricts.filter(r=>r!==val);selectedRestricts=selectedRestricts.filter(r=>r!=='none');if(!selectedRestricts.length){selectedRestricts=['none'];if(noneChip)noneChip.classList.add('sel');}}persistOnboardingDraft();}
window.selRestrict=selRestrict;
function checkOb8(){const h=document.getElementById('obH').value,w=document.getElementById('obW').value,a=document.getElementById('obA').value;document.getElementById('ob8n').disabled=!(h&&w&&a);if(h&&w&&a){const sAdj=(obAnswers.sex||'male')==='female'?-161:5;const tdee=Math.round((10*parseFloat(w)+6.25*parseFloat(h)-5*parseFloat(a)+sAdj)*1.55);document.getElementById('tdeeText').textContent=tdee+' kcal/day (moderate activity)';document.getElementById('tdeePreview').style.display='block';}}
window.checkOb8=checkOb8;
function checkOb9(){const h=document.getElementById('obH').value,w=document.getElementById('obW').value,a=document.getElementById('obA').value;document.getElementById('ob9n').disabled=!(h&&w&&a);if(h&&w&&a){const sAdj=(obAnswers.sex||'male')==='female'?-161:5;const tdee=Math.round((10*parseFloat(w)+6.25*parseFloat(h)-5*parseFloat(a)+sAdj)*1.55);document.getElementById('tdeeText').textContent=tdee+' kcal/day (moderate activity)';document.getElementById('tdeePreview').style.display='block';obAnswers.height=parseFloat(h);obAnswers.weight=parseFloat(w);obAnswers.age=parseFloat(a);persistOnboardingDraft();}}
window.checkOb9=checkOb9;
function checkOb10(){const customCalories=parseInt(document.getElementById('obCustomCalories')?.value,10);obAnswers.customCalories=Number.isFinite(customCalories)&&customCalories>0?customCalories:null;document.getElementById('ob10n').disabled=!obAnswers.dietGoal;persistOnboardingDraft();}
window.checkOb10=checkOb10;
function checkOb11(){const gw=parseFloat(document.getElementById('obGW').value),cw=parseFloat(document.getElementById('obW').value)||75,dg=obAnswers.dietGoal||'maintain';document.getElementById('ob11n').disabled=!gw;if(gw){const diff=gw-cw,rate=dg==='bulk'?0.3:dg==='cut'?-0.4:0.1,weeks=Math.round(Math.abs(diff)/Math.abs(rate)||0);document.getElementById('gwText').textContent=Math.abs(diff).toFixed(1)+'kg to '+(diff>0?'gain':'lose')+'. About '+weeks+' weeks at current rate.';document.getElementById('gwPreview').style.display='block';drawTimelineChart(cw,gw,weeks,'gwChart');obAnswers.goalWeight=gw;persistOnboardingDraft();}}
window.checkOb11=checkOb11;
function toggleNotifPref(el,key){el.classList.toggle('sel');selectedNotifPrefs[key]=el.classList.contains('sel');persistOnboardingDraft();}
window.toggleNotifPref=toggleNotifPref;
function checkOb12(){document.getElementById('ob12n')?.removeAttribute('disabled');}
window.checkOb12=checkOb12;
function drawTimelineChart(start,goal,weeks,cid){const c=document.getElementById(cid);if(!c)return;const W=c.offsetWidth||280,H=90;c.width=W;c.height=H;const ctx=c.getContext('2d');const pts=Array.from({length:Math.max(weeks,2)+1},(_,i)=>start+(goal-start)*(i/Math.max(weeks,2)));const minV=Math.min(start,goal)-2,maxV=Math.max(start,goal)+2,range=maxV-minV||1;const pad={l:38,r:10,t:8,b:18};const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;ctx.clearRect(0,0,W,H);ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;[0,0.5,1].forEach(f=>{const y=pad.t+cH*f;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.fillText((maxV-range*f).toFixed(0)+'kg',0,y+3);});const coords=pts.map((v,i)=>({x:pad.l+(i/(pts.length-1))*cW,y:pad.t+((maxV-v)/range)*cH}));ctx.beginPath();ctx.moveTo(coords[0].x,coords[0].y);coords.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle='rgba(200,255,0,0.4)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(coords[0].x,coords[0].y,4,0,Math.PI*2);ctx.fillStyle='#c8ff00';ctx.fill();ctx.beginPath();ctx.arc(coords[coords.length-1].x,coords[coords.length-1].y,4,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();}
function obNext(s){const cur=document.getElementById('ob'+s),nxt=document.getElementById('ob'+(s+1));if(!nxt)return;if(s===5){obAnswers.trainingDays=[...selectedTrainDays];obAnswers.trainingDayMap=Object.fromEntries(selectedTrainDays.map((day,index)=>[day,index]));}if(s===9){obAnswers.height=parseFloat(document.getElementById('obH').value);obAnswers.weight=parseFloat(document.getElementById('obW').value);obAnswers.age=parseFloat(document.getElementById('obA').value);}if(s===10){const customCalories=parseInt(document.getElementById('obCustomCalories').value,10);obAnswers.customCalories=Number.isFinite(customCalories)&&customCalories>0?customCalories:null;}if(s===11)obAnswers.goalWeight=parseFloat(document.getElementById('obGW').value);cur.classList.remove('active');nxt.classList.add('active');obStep=s+1;document.getElementById('obBar').style.width=(obStep/OB_TOTAL*100)+'%';persistOnboardingDraft();trackFlowEvent('onboarding_step_completed',{step:s,next:obStep});}
window.obNext=obNext;
function obBack(s){const cur=document.getElementById('ob'+s),prv=document.getElementById('ob'+(s-1));if(!prv)return;cur.classList.remove('active');prv.classList.add('active');obStep=s-1;document.getElementById('obBar').style.width=(obStep/OB_TOTAL*100)+'%';persistOnboardingDraft();}
window.obBack=obBack;
function sanitizeOnboardingProfile(raw){
  const parseNum=(v,fallback,min,max)=>{const n=parseFloat(v);if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,n));};
  const focus=(selectedMuscles||[]).slice(0,2);
  const trainingDays=(selectedTrainDays||[]).slice(0,Math.min(7,Math.max(1,parseInt(raw.days,10)||4)));
  const saunaGoal=raw.saunaGoal||'recovery';
  const saunaDefaults={cardio:['Tue','Thu','Sat','Sun'],recovery:['Tue','Fri'],stress:['Wed','Sat','Sun'],longevity:['Mon','Thu','Sat']};
  const saunaSchedule=(saunaDefaults[saunaGoal]||saunaDefaults.recovery).slice(0,saunaGoal==='cardio'?4:saunaGoal==='recovery'?2:3);
  const customCaloriesValue=parseInt(raw.customCalories,10);
  return{
    ...raw,
    goal:raw.goal||'general',
    sex:raw.sex||'male',
    experience:raw.experience||'intermediate',
    days:Math.min(7,Math.max(1,parseInt(raw.days,10)||4)),
    sessionLen:[30,45,60,90].includes(parseInt(raw.sessionLen,10))?parseInt(raw.sessionLen,10):60,
    equipment:raw.equipment||'full',
    dietGoal:raw.dietGoal||'maintain',
    notifications:raw.notifications===true,
    height:parseNum(raw.height,175,120,230),
    weight:parseNum(raw.weight,75,35,300),
    age:Math.round(parseNum(raw.age,25,14,90)),
    goalWeight:parseNum(raw.goalWeight,parseNum(raw.weight,75,35,300),35,300),
    focusMuscles:focus.length===2?focus:['chest','back'],
    restrictions:(selectedRestricts&&selectedRestricts.length)?selectedRestricts:['none'],
    trainingDays:trainingDays.length?trainingDays:WEEKDAYS.slice(0,Math.min(7,Math.max(1,parseInt(raw.days,10)||4))),
    trainingDayMap:trainingDays.length?Object.fromEntries(trainingDays.map((day,index)=>[day,index])):undefined,
    customCalories:Number.isFinite(customCaloriesValue)&&customCaloriesValue>0?customCaloriesValue:null,
    saunaGoal,
    saunaSchedule,
    notifCheckin:selectedNotifPrefs.checkin!==false,
    notifEmom:!!selectedNotifPrefs.emom,
    notifSauna:!!selectedNotifPrefs.sauna,
  };
}
function syncProfileDrivenState(){
  if(!window.userProfile)return;
  if(window.userProfile.weight)saunaState.weight=parseInt(window.userProfile.weight,10)||saunaState.weight;
  if(window.userProfile.saunaGoal)saunaState.goal=window.userProfile.saunaGoal;
}
async function finishOnboarding(){const profile=sanitizeOnboardingProfile(obAnswers);const payload={...profile,setupComplete:true,walkthroughSeen:false,createdAt:new Date().toISOString()};if((payload.notifCheckin||payload.notifEmom||payload.notifSauna)&&'Notification' in window)Notification.requestPermission();if(window.fbSaveProfile)await window.fbSaveProfile(payload);window.userProfile=payload;syncProfileDrivenState();updateHomeUI();clearOnboardingDraft();showToast(t('toast.welcome.title'),t('toast.welcome.body'));trackFlowEvent('onboarding_completed',{days:payload.days,goal:payload.goal,dietGoal:payload.dietGoal});goTo('home');}
window.finishOnboarding=finishOnboarding;
async function resetMyData(){
  const ok=window.confirm(t('confirm.reset'));
  if(!ok)return;
  const cleared=window.fbResetUserData?await window.fbResetUserData():false;
  if(!cleared){showToast(t('toast.resetFail.title'),t('toast.resetFail.body'));return;}
  clearOnboardingDraft();
  window.userProfile=null;window.currentPlanData=null;window.currentCheckin=null;startOb(true);goTo('onboarding');showToast(t('toast.resetDone.title'),t('toast.resetDone.body'));
}
window.resetMyData=resetMyData;

// ── STREAK (calendar-week based) ──
function getWeekStartMs(dateVal){
  const d=new Date(dateVal);d.setHours(0,0,0,0);
  const day=(d.getDay()+6)%7;
  d.setDate(d.getDate()-day);
  return d.getTime();
}
function calcStreak(checkins){
  if(!checkins.length)return{count:0,currentWeekDone:false};
  const weekStarts=[...new Set(checkins.map(c=>getWeekStartMs(toMs(c.createdAt))))].sort((a,b)=>b-a);
  const currentWeek=getWeekStartMs(Date.now());
  const currentWeekDone=weekStarts.includes(currentWeek);
  const latestWeek=weekStarts[0];
  if(currentWeek-latestWeek>7*24*60*60*1000)return{count:0,currentWeekDone:false};
  let streak=1,expected=latestWeek-7*24*60*60*1000;
  for(let i=1;i<weekStarts.length;i++){if(weekStarts[i]===expected){streak++;expected-=7*24*60*60*1000;}else break;}
  return{count:streak,currentWeekDone};
}

// ── PERIODISATION (date-based from first check-in) ──
function calcBlock(checkins){
  if(!checkins.length)return{name:'Hypertrophy',week:1,total:5,isStr:false,weeksLeft:4,earlyTrigger:null};
  const CYCLE=8,HYP=5;
  const sorted=[...checkins].sort((a,b)=>toMs(a.createdAt)-toMs(b.createdAt));
  const firstDate=toMs(sorted[0].createdAt);
  const now=Date.now();
  let baseWeeks=weeksBetween(firstDate,now);
  const recent=sorted.slice(-3).reverse();
  let earlyTrigger=null;
  if(recent.length>=3&&recent.every(c=>c.lifts==='pbs')){earlyTrigger='3 consecutive PRs — switching to Strength Block early.';baseWeeks+=2;}
  if(recent.length>=2&&recent[0].lifts==='regressed'&&recent[1].lifts==='regressed'){earlyTrigger='Lifts regressed twice — extending Hypertrophy to rebuild.';baseWeeks=Math.max(0,baseWeeks-1);}
  const pos=baseWeeks%CYCLE;
  const isStr=pos>=HYP;
  const blockWeek=isStr?pos-HYP+1:pos+1;
  const blockTotal=isStr?CYCLE-HYP:HYP;
  const weeksLeft=blockTotal-blockWeek;
  return{name:isStr?'Strength':'Hypertrophy',week:blockWeek,total:blockTotal,isStr,weeksLeft,earlyTrigger};
}

function getAutoDeloadTrigger(checkins,sessions){
  const recentCheckins=(checkins||[]).slice(0,3);
  const recentSessions=(sessions||[]).slice(0,8);
  const regressions=recentCheckins.filter(c=>c.lifts==='regressed').length;
  const lowEnergyCount=recentCheckins.filter(c=>parseInt(c.energy,10)<=4).length;
  const avgStress=recentCheckins.length?recentCheckins.reduce((a,c)=>a+(parseInt(c.stress,10)||0),0)/recentCheckins.length:0;
  let stallCount=0;
  const bestByExercise={};
  [...recentSessions].reverse().forEach(sess=>{(sess.exercises||[]).forEach(ex=>{const prev=bestByExercise[ex.name]||0;if(ex.maxWeight<=prev)stallCount++;bestByExercise[ex.name]=Math.max(prev,ex.maxWeight||0);});});
  if(regressions>=2&&lowEnergyCount>=2)return'Deload auto-triggered: two regressed check-ins plus low energy.';
  if(regressions>=2&&avgStress>=7)return'Deload auto-triggered: repeated regressions with high stress.';
  if(stallCount>=8&&lowEnergyCount>=1)return'Deload auto-triggered: stalled top sets across recent sessions.';
  return null;
}

// ── WEIGHT TREND (date-based, last 28 days) ──
function calcWeightTrend(checkins,currentWeight,dietGoal){
  if(!currentWeight)return{adj:0,msg:null};
  const now=Date.now();
  const recent=checkins.filter(c=>c.weight&&daysBetween(toMs(c.createdAt),now)<=28).sort((a,b)=>toMs(b.createdAt)-toMs(a.createdAt));
  if(recent.length<2)return{adj:0,msg:(3-recent.length)>0?'Log weight in '+Math.max(1,3-recent.length)+' more check-in'+(3-recent.length>1?'s':'')+' for auto-calorie adjustment.':null};
  const oldest=recent[recent.length-1],newest=recent[0];
  const weeks=Math.max(1,weeksBetween(toMs(oldest.createdAt),toMs(newest.createdAt)));
  const change=parseFloat(newest.weight)-parseFloat(oldest.weight),weeklyRate=change/weeks;
  let adj=0,msg=null;
  if(dietGoal==='bulk'){if(weeklyRate<0.05){adj=200;msg='Weight not going up ('+weeklyRate.toFixed(2)+'kg/week). Calories +200.';}else if(weeklyRate>0.5){adj=-100;msg='Gaining fast ('+weeklyRate.toFixed(2)+'kg/week). Calories -100.';}else msg='On track: +'+weeklyRate.toFixed(2)+'kg/week.';}
  else if(dietGoal==='cut'){if(weeklyRate>-0.05){adj=-200;msg='Weight not dropping ('+weeklyRate.toFixed(2)+'kg/week). Calories -200.';}else if(weeklyRate<-0.8){adj=150;msg='Losing too fast ('+weeklyRate.toFixed(2)+'kg/week). Calories +150.';}else msg='On track: '+weeklyRate.toFixed(2)+'kg/week.';}
  else{if(weeklyRate>0.2){adj=-150;msg='Trending up. Calories -150.';}else if(weeklyRate<-0.2){adj=150;msg='Trending down. Calories +150.';}else msg='Weight stable.';}
  return{adj,msg,weeklyRate};
}

// ── LIGHTWEIGHT ML (ON-DEVICE) ──
const ML_MODEL_VERSION=1;
const ML_MODEL_STORAGE_KEY='addapt_ml_model_cache';

function mlSigmoid(z){return 1/(1+Math.exp(-z));}
function mlDot(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
function mlSleepVal(v){return {'<5hrs':0,'5-6hrs':0.35,'7-8hrs':0.75,'8+hrs':1}[v]??0.5;}
function mlLiftVal(v){return {regressed:0,same:0.45,slightly_up:0.72,pbs:1}[v]??0.5;}
function mlDietVal(v){return {way_under:0.15,under:0.4,on_target:0.85,over:0.35}[v]??0.5;}
function mlDatasetFingerprint(xs,ys){
  // Cheap deterministic fingerprint for cache invalidation when history changes.
  const head=xs.slice(0,3).flat().map(v=>Number(v).toFixed(3)).join('|');
  const tail=xs.slice(-3).flat().map(v=>Number(v).toFixed(3)).join('|');
  return `${xs.length}:${ys.join('')}:${head}:${tail}`;
}
function mlLoadCachedModel(fingerprint){
  try{
    const raw=localStorage.getItem(ML_MODEL_STORAGE_KEY);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    if(parsed?.version!==ML_MODEL_VERSION)return null;
    if(parsed?.fingerprint!==fingerprint)return null;
    if(!Array.isArray(parsed?.w)||!parsed.w.length)return null;
    return parsed;
  }catch(_){return null;}
}
function mlSaveCachedModel(fingerprint,w,samples){
  try{
    localStorage.setItem(ML_MODEL_STORAGE_KEY,JSON.stringify({
      version:ML_MODEL_VERSION,
      fingerprint,
      w,
      samples,
      savedAt:new Date().toISOString(),
    }));
  }catch(_){/* ignore storage failures */}
}
function mlFeatureVec(c){
  return[
    1,
    Math.max(0,Math.min(1,(parseFloat(c.energy)||5)/10)),
    Math.max(0,Math.min(1,1-((parseFloat(c.stress)||5)/10))),
    mlSleepVal(c.sleep),
    mlLiftVal(c.lifts),
    mlDietVal(c.diet),
    Math.max(0,Math.min(1,(parseFloat(c.weight)||75)/140)),
  ];
}
function buildMlDataset(checkins){
  const sorted=[...(checkins||[])].filter(c=>c&&c.createdAt).sort((a,b)=>toMs(a.createdAt)-toMs(b.createdAt));
  const xs=[],ys=[];
  for(let i=0;i<sorted.length-1;i++){
    const c=sorted[i],next=sorted[i+1];
    if(c.energy===undefined||c.stress===undefined)continue;
    const x=mlFeatureVec(c);
    const y=(next.lifts==='slightly_up'||next.lifts==='pbs')?1:0;
    xs.push(x);ys.push(y);
  }
  return{xs,ys};
}
function trainMlLogReg(xs,ys,epochs=260,lr=0.22){
  if(!xs.length)return null;
  const d=xs[0].length;
  const w=new Array(d).fill(0);
  for(let e=0;e<epochs;e++){
    const g=new Array(d).fill(0);
    for(let i=0;i<xs.length;i++){
      const p=mlSigmoid(mlDot(w,xs[i]));
      const err=p-ys[i];
      for(let j=0;j<d;j++)g[j]+=err*xs[i][j];
    }
    for(let j=0;j<d;j++)w[j]-=lr*(g[j]/xs.length);
  }
  return{w};
}
function evalMlModel(model,xs,ys){
  if(!model||!xs.length)return null;
  let correct=0,brier=0;
  for(let i=0;i<xs.length;i++){
    const p=mlSigmoid(mlDot(model.w,xs[i]));
    const pred=p>=0.5?1:0;
    if(pred===ys[i])correct++;
    brier+=(p-ys[i])*(p-ys[i]);
  }
  return{accuracy:correct/xs.length,brier:brier/xs.length,samples:xs.length};
}
function getMlReadinessSignal(pastCheckins,currentCheckin){
  const ds=buildMlDataset(pastCheckins);
  if(ds.xs.length<8)return{enabled:false,samples:ds.xs.length,reason:'not-enough-data'};
  const fingerprint=mlDatasetFingerprint(ds.xs,ds.ys);
  const cached=mlLoadCachedModel(fingerprint);
  const model=cached?.w?{w:cached.w}:trainMlLogReg(ds.xs,ds.ys);
  if(!model)return{enabled:false,samples:ds.xs.length,reason:'train-failed'};
  if(!cached)mlSaveCachedModel(fingerprint,model.w,ds.xs.length);
  const p=mlSigmoid(mlDot(model.w,mlFeatureVec(currentCheckin)));
  const confidence=Math.abs(p-0.5)*2;
  const perf=evalMlModel(model,ds.xs,ds.ys);
  return{enabled:true,samples:ds.xs.length,probability:p,confidence,version:ML_MODEL_VERSION,cached:!!cached,performance:perf};
}

// ── GAMIFICATION ──
function getLevel(n){if(n>=24)return{name:t('level.elite'),color:'#ffd700'};if(n>=12)return{name:t('level.dedicated'),color:'#ff69b4'};if(n>=5)return{name:t('level.consistent'),color:'#00d4ff'};return{name:t('level.rookie'),color:'#888'};}
function checkMilestones(n){
  const m=[{at:1,t:'First check-in complete',m:'The journey starts.'},{at:5,t:'Consistent rank unlocked',m:'5 check-ins in. You are building a real habit.'},{at:12,t:'Dedicated rank unlocked',m:'12 check-ins. That is elite behaviour.'},{at:24,t:'Elite rank unlocked',m:'24 check-ins. Top 1% of people who start.'}];
  for(const x of m){
    if(n===x.at&&!hasSeenMilestone(x.at)){
      markSeenMilestone(x.at);
      showToast(x.t,x.m,5000);
      break;
    }
  }
}
function calcGamification(checkins,sessions){
  const checkinCount=(checkins||[]).length;
  const sessionCount=(sessions||[]).length;
  const prCount=(sessions||[]).reduce((acc,s)=>acc+(s.exercises||[]).filter(ex=>ex.maxWeight&&ex.maxWeight>0).length,0);
  const streak=calcStreak(checkins).count;
  const xp=checkinCount*40+sessionCount*30+Math.min(prCount,80)*5+streak*25;
  const level=Math.max(1,Math.floor(xp/220)+1);
  const nextXp=level*220;
  return{xp,level,nextXp,sessionCount,prCount,streak};
}

// ── HOME UI ──
function getDefaultDashboardCheckin(){return{energy:7,stress:3,sleep:'7-8hrs',lifts:'same',diet:'on_target',weight:null,notes:'',isoDate:new Date().toISOString().split('T')[0],date:new Date().toLocaleDateString('en-GB'),calOverride:null};}
function getTodayWeekday(){return WEEKDAYS[(new Date().getDay()+6)%7];}
function buildLivePlan(checkins,sessions,checkinOverride,activities=[]){
  const ci=checkinOverride||window.currentCheckin||getDefaultDashboardCheckin();
  window.currentCheckin=ci;
  window.currentPlanData=buildPlan(window.userProfile,ci,sessions,checkins,activities);
  return window.currentPlanData;
}
function getDashboardPlan(checkins,sessions){
  const ci=window.currentCheckin||getDefaultDashboardCheckin();
  return buildLivePlan(checkins,sessions,ci);
}
function getPrimarySession(plan){
  const today=getTodayWeekday();
  const todaySession=plan?.splitDays?.find(day=>day.day===today);
  if(todaySession&&todaySession.tag!=='rest'&&todaySession.tag!=='active')return{session:todaySession,label:'Today'};
  const nextSession=plan?.splitDays?.find(day=>day.tag!=='rest'&&day.tag!=='active');
  return{session:nextSession||todaySession,label:todaySession?'Today':'Next up'};
}
function updateAppNavState(id){
  const nav=document.getElementById('appNav');
  if(!nav)return;
  const navTargets=['home','trainingHub','nutritionHub','sauna','statsHub'];
  nav.classList.toggle('hidden',!navTargets.includes(id));
  nav.querySelectorAll('.app-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.target===id));
}
function getMealLogState(){
  try{return JSON.parse(localStorage.getItem(MEAL_LOG_STORAGE_KEY)||'{}');}catch{return{};}
}
function saveMealLogState(state){localStorage.setItem(MEAL_LOG_STORAGE_KEY,JSON.stringify(state));}
function formatShortDateLabel(value){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value).slice(0,5);
  return date.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
function ensureCanvasTooltip(canvas){
  if(!canvas?.parentElement)return null;
  let tip=canvas.parentElement.querySelector('.chart-tooltip');
  if(tip)return tip;
  tip=document.createElement('div');
  tip.className='chart-tooltip';
  canvas.parentElement.appendChild(tip);
  return tip;
}
function hideCanvasTooltip(canvas){
  const tip=canvas?.parentElement?.querySelector('.chart-tooltip');
  if(tip)tip.classList.remove('open');
}
function attachCanvasTooltip(canvas,points,formatter){
  if(!canvas||!points?.length)return;
  const tip=ensureCanvasTooltip(canvas);
  const showAtIndex=index=>{
    const point=points[index];
    if(!point||!tip)return;
    tip.innerHTML=`<strong>${formatter(point.value)}</strong><span>${point.label}</span>`;
    tip.style.left=`${Math.max(14,Math.min(point.x,canvas.clientWidth-14))}px`;
    tip.style.top=`${Math.max(12,point.y-12)}px`;
    tip.classList.add('open');
  };
  canvas.onmousemove=event=>{
    const rect=canvas.getBoundingClientRect();
    const x=event.clientX-rect.left;
    let nearest=0;
    let distance=Infinity;
    points.forEach((point,index)=>{
      const diff=Math.abs(point.x-x);
      if(diff<distance){distance=diff;nearest=index;}
    });
    showAtIndex(nearest);
  };
  canvas.onmouseleave=()=>hideCanvasTooltip(canvas);
  canvas.onclick=event=>{
    const rect=canvas.getBoundingClientRect();
    const x=event.clientX-rect.left;
    let nearest=0;
    let distance=Infinity;
    points.forEach((point,index)=>{
      const diff=Math.abs(point.x-x);
      if(diff<distance){distance=diff;nearest=index;}
    });
    showAtIndex(nearest);
  };
}
function renderInsightChart(series,canvasId,emptyId,color,config={}){
  const canvas=document.getElementById(canvasId);
  const empty=document.getElementById(emptyId);
  const meta=document.getElementById(`${canvasId}Meta`);
  if(!canvas)return;
  if(!series||series.length<2){
    canvas.style.display='none';
    if(meta)meta.innerHTML='';
    if(empty)empty.style.display='block';
    hideCanvasTooltip(canvas);
    return;
  }
  if(empty)empty.style.display='none';
  canvas.style.display='block';
  const width=canvas.offsetWidth||300;
  const height=config.height||120;
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  const values=series.map(item=>parseFloat(item.value)||0);
  const min=Math.min(...values);
  const max=Math.max(...values);
  const top=max+(max-min||1)*0.16;
  const bottom=min-(max-min||1)*0.14;
  const range=(top-bottom)||1;
  const pad={l:22,r:10,t:16,b:22};
  const chartWidth=width-pad.l-pad.r;
  const chartHeight=height-pad.t-pad.b;
  ctx.clearRect(0,0,width,height);
  ctx.strokeStyle='rgba(255,255,255,0.08)';
  ctx.lineWidth=1;
  [0,0.5,1].forEach(step=>{
    const y=pad.t+chartHeight*step;
    ctx.beginPath();
    ctx.moveTo(pad.l,y);
    ctx.lineTo(width-pad.r,y);
    ctx.stroke();
  });
  const points=values.map((value,index)=>({
    value,
    label:series[index].label,
    x:pad.l+(index/(values.length-1||1))*chartWidth,
    y:pad.t+((top-value)/range)*chartHeight
  }));
  const gradient=ctx.createLinearGradient(0,pad.t,0,pad.t+chartHeight);
  gradient.addColorStop(0,`${color}30`);
  gradient.addColorStop(1,`${color}00`);
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  points.slice(1).forEach(point=>ctx.lineTo(point.x,point.y));
  ctx.lineWidth=2.5;
  ctx.strokeStyle=color;
  ctx.stroke();
  ctx.lineTo(points[points.length-1].x,pad.t+chartHeight);
  ctx.lineTo(points[0].x,pad.t+chartHeight);
  ctx.closePath();
  ctx.fillStyle=gradient;
  ctx.fill();
  points.forEach((point,index)=>{
    ctx.beginPath();
    ctx.arc(point.x,point.y,index===points.length-1?4:3,0,Math.PI*2);
    ctx.fillStyle=index===points.length-1?'#f2f2f2':color;
    ctx.fill();
  });
  const labelColor='rgba(255,255,255,0.5)';
  ctx.fillStyle=labelColor;
  ctx.font='10px sans-serif';
  ctx.fillText(formatShortDateLabel(series[0].label),pad.l,pad.t+chartHeight+16);
  const endLabel=formatShortDateLabel(series[series.length-1].label);
  const endWidth=ctx.measureText(endLabel).width;
  ctx.fillText(endLabel,width-pad.r-endWidth,pad.t+chartHeight+16);
  if(meta){
    const formatter=config.formatter||((value)=>`${Math.round(value)}`);
    meta.innerHTML=`<span>${config.metaLabel||'Start'} <strong>${formatter(values[0])}</strong></span><span>${config.metaMidLabel||'Latest'} <strong>${formatter(values[values.length-1])}</strong></span>`;
  }
  attachCanvasTooltip(canvas,points,config.formatter||((value)=>`${Math.round(value)}`));
}
let mealModalState={index:null,mealName:'',mealTime:'',mealKcal:0};
function openMealModal(index,meal){
  mealModalState.index=index;
  mealModalState.mealName=meal.name||'';
  mealModalState.mealTime=meal.time||'';
  mealModalState.mealKcal=meal.kcal||0;
  const modal=document.getElementById('mealModal');
  const ovl=document.getElementById('mealModalOvl');
  if(!modal||!ovl)return;
  document.getElementById('mealModalTitle').textContent=`Log ${meal.name}`;
  document.getElementById('mealModalMeta').textContent=`${meal.time} · ${meal.kcal} kcal · ${meal.items.length} items`;
  document.getElementById('mealLogItem').value='';
  document.getElementById('mealLogKcal').value=meal.kcal||'';
  modal.style.display='block';
  ovl.style.display='block';
}
window.openMealModal=openMealModal;
function closeMealModal(){
  const modal=document.getElementById('mealModal');
  const ovl=document.getElementById('mealModalOvl');
  if(modal)modal.style.display='none';
  if(ovl)ovl.style.display='none';
  mealModalState={index:null,mealName:'',mealTime:'',mealKcal:0};
}
window.closeMealModal=closeMealModal;
async function saveMealLog(){
  if(mealModalState.index===null)return;
  const item=document.getElementById('mealLogItem').value.trim();
  const kcal=parseInt(document.getElementById('mealLogKcal').value,10);
  if(!item||!Number.isFinite(kcal)||kcal<=0){
    showToast('Meal log empty','Add a food item or note and calories.');
    return;
  }
  const key=new Date().toISOString().split('T')[0];
  const state=getMealLogState();
  state[key]=state[key]||{};
  state[key][mealModalState.index]={item,kcal,loggedAt:new Date().toISOString()};
  saveMealLogState(state);
  const u=window.currentUser;
  if(u&&window.fbSaveSession){
    try{
      const logId=key+'_meal_'+mealModalState.index;
      const payload={
        isoDate:key,
        dayName:new Date().toLocaleDateString('en-US',{weekday:'long'}),
        mealIndex:mealModalState.index,
        mealName:mealModalState.mealName,
        mealTime:mealModalState.mealTime,
        item,kcal,
        logType:'meal',
        userId:u.uid
      };
      await window.fbSaveSession(payload);
    }catch(err){console.error(err);}
  }
  trackFlowEvent('meal_logged',{mealIndex:mealModalState.index,mealName:mealModalState.mealName,kcal,item});
  closeMealModal();
  refreshPrimarySurfaces();
  showToast('Meal logged','Added to today.');
}
window.saveMealLog=saveMealLog;
function toggleMealSlotLog(index){
  const plan=window.currentPlanData;
  if(!plan||!plan.meals||!plan.meals[index])return;
  openMealModal(index,plan.meals[index]);
}
window.toggleMealSlotLog=toggleMealSlotLog;
function drawLineChartIntoSeries(series,canvasId,emptyId,color,height=120){
  renderInsightChart(series,canvasId,emptyId,color,{height,formatter:(value)=>`${Math.round(value*10)/10}`});
}
function renderVolumeInto(sessions,targetId){
  const muscles={chest:0,back:0,shoulders:0,biceps:0,triceps:0,glutes:0,quads:0,hamstrings:0,core:0};
  const landmarks={chest:[10,18],back:[12,22],shoulders:[10,20],biceps:[6,14],triceps:[6,14],glutes:[12,24],quads:[10,20],hamstrings:[10,20],core:[6,14]};
  sessions.slice(0,16).forEach(sess=>{(sess.exercises||[]).forEach(ex=>{if(muscles.hasOwnProperty(ex.muscle))muscles[ex.muscle]+=(ex.sets?.length||3);});});
  const max=Math.max(...Object.values(muscles),1);
  const rows=Object.entries(muscles).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([m,v])=>{
    const [lo,hi]=landmarks[m]||[8,16];
    const status=v<lo?'<span style="color:#ff4d00;">Below</span>':v>hi?'<span style="color:#ffaa00;">High</span>':'<span style="color:#c8ff00;">On target</span>';
    return`<div class="vol-bar-wrap"><div class="vol-bar-label"><span>${cap(m)}</span><span>${v} sets · ${status}</span></div><div class="vol-bar-track"><div class="vol-bar-fill" style="width:${Math.round(v/max*100)}%;"></div></div><div style="font-size:10px;color:#888;margin-top:4px;">Landmark: ${lo}-${hi} sets</div></div>`;
  }).join('')||'<div class="chart-empty">Log more sessions to see set volume.</div>';
  const target=document.getElementById(targetId);
  if(target)target.innerHTML=rows;
}
function drawWeightChartInto(checkins,canvasId,emptyId){
  const series=checkins.filter(c=>c.weight).reverse().slice(-12).map(item=>({value:parseFloat(item.weight),label:item.date||''}));
  drawLineChartIntoSeries(series,canvasId,emptyId,'#c8ff00',120);
}
function buildGoalProgressMarkup(checkins,p,game){
  const gw=p.goalWeight;
  const currentWeight=checkins.find(c=>c.weight)?.weight||p.weight;
  if(!gw||!currentWeight)return `<div class="stats-mini"><strong>Lv ${game.level}</strong><span>${game.xp} XP earned · add weight logs to unlock goal tracking.</span></div>`;
  const start=p.weight||currentWeight;
  const total=Math.abs(gw-start)||0.001;
  const progress=Math.abs(parseFloat(currentWeight)-start);
  const pct=Math.min(100,Math.round(progress/total*100));
  return `<div class="stats-mini"><strong>${pct}%</strong><span>${currentWeight}kg now · ${gw}kg target · Lv ${game.level}</span></div>`;
}
function getSaunaTargetForGoal(goal){
  return goal==='recovery'?2:goal==='cardio'?4:3;
}
function getProfileTrainingDays(profile){
  const count=Math.min(7,Math.max(1,parseInt(profile?.days,10)||4));
  let days=Array.isArray(profile?.trainingDays)?profile.trainingDays.filter(day=>WEEKDAYS.includes(day)):[];
  if(!days.length&&profile?.trainingDayMap&&typeof profile.trainingDayMap==='object'&&!Array.isArray(profile.trainingDayMap)){
    days=Object.keys(profile.trainingDayMap).filter(day=>WEEKDAYS.includes(day));
  }
  days=[...new Set(days)].sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));
  if(days.length<count){
    const fill=WEEKDAYS.filter(day=>!days.includes(day)).slice(0,count-days.length);
    days=[...days,...fill];
  }
  return days.slice(0,count);
}
function getProfileSaunaDays(profile,goalOverride){
  const goal=goalOverride||profile?.saunaGoal||'recovery';
  const count=getSaunaTargetForGoal(goal);
  return normalizeSchedule(profile?.saunaSchedule,count,WEEKDAYS.slice(0,count));
}
function buildProfileReminderSummary(profile){
  const items=[];
  if(profile?.notifCheckin!==false)items.push('Check-In');
  if(profile?.notifEmom)items.push('EMOM');
  if(profile?.notifSauna)items.push('Sauna');
  return items.length?items.join(' · '):'Reminders off';
}
// ── ADVANCED ANALYTICS ──
function estimate1RM(weight,reps){
  if(!weight||!reps||reps<1||reps>20)return weight;
  return Math.round(weight/(1.0278-0.0278*reps)*10)/10;
}
function calcExerciseStats(sessions,exerciseName){
  const relevant=sessions.filter(s=>(s.exercises||[]).some(ex=>ex.name&&ex.name.toLowerCase().includes(exerciseName.toLowerCase())));
  if(!relevant.length)return null;
  const allSets=relevant.flatMap(s=>(s.exercises||[]).filter(ex=>ex.name&&ex.name.toLowerCase().includes(exerciseName.toLowerCase())).flatMap(ex=>ex.sets||[]));
  if(!allSets.length)return null;
  const heaviest=allSets.reduce((max,set)=>Math.max(max,parseFloat(set.weight)||0),0);
  const totalVolume=allSets.reduce((sum,set)=>{const w=parseFloat(set.weight)||0,r=parseInt(set.reps,10)||0;return sum+w*r;},0);
  const estMax=estimate1RM(heaviest,allSets.find(s=>parseFloat(s.weight)===heaviest)?.reps||5);
  return {heaviest,estMax,totalVolume,setCount:allSets.length,recent:relevant.slice(0,3)};
}
function buildInsightCard(title,changed,reason,action){
  return '<div class="insight-card"><div class="insight-title">'+title+'</div><div class="insight-section"><div class="insight-label">What changed</div><div class="insight-text">'+changed+'</div></div><div class="insight-section"><div class="insight-label">Why</div><div class="insight-text">'+reason+'</div></div><div class="insight-section"><div class="insight-label">What to do</div><div class="insight-text">'+action+'</div></div></div>';
}
function generateInsightCards(checkins,sessions){
  const cards=[];
  if(!sessions.length)return cards;
  const recentSessions=sessions.slice(0,7);
  const avgVolume=recentSessions.reduce((sum,s)=>{const vol=(s.exercises||[]).reduce((sv,ex)=>(ex.sets||[]).length+sv,0);return sum+vol},0)/Math.max(recentSessions.length,1);
  const eightWeekVolume=sessions.slice(0,28).reduce((sum,s)=>{const vol=(s.exercises||[]).reduce((sv,ex)=>(ex.sets||[]).length+sv,0);return sum+vol},0)/4;
  if(avgVolume>eightWeekVolume*1.15){
    cards.push(buildInsightCard('Volume Surge','Your recent session volume is 15% higher than your 2-month baseline.','You may have increased intensity or added volume to drive adaptation.','Monitor fatigue; consider strategic deloads to avoid overuse.'));
  }else if(avgVolume<eightWeekVolume*0.85){
    cards.push(buildInsightCard('Volume Dip','Your recent session volume is 15% lower than average.','Possible reasons: recovering from a block, missing sessions, or lighter training week.','Check your energy levels in the latest check-in and adjust plan intensity if needed.'));
  }
  const recentCheckins=getHabitCheckins(checkins).slice(0,5);
  if(recentCheckins.length>=3){
    const avgEnergy=recentCheckins.reduce((sum,c)=>sum+(c.energy||0),0)/recentCheckins.length;
    if(avgEnergy>=8){
      cards.push(buildInsightCard('Energy Peak','Your energy score is consistently 8/10 or higher.','High energy usually precedes breakthrough weeks; capitalize now.','Push for a session PR or increase volume volume this week.'));
    }else if(avgEnergy<=4){
      cards.push(buildInsightCard('Recovery Needed','Your energy score is consistently 4/10 or lower.','Fatigue may be accumulating from training, stress, or sleep debt.','Use deload week, increase sauna sessions, and prioritize sleep.'));
    }
  }
  const liftTrend=recentCheckins.map(c=>c.lifts).slice(0,5);
  if(liftTrend.length>=3){
    const recentLifts=liftTrend.filter(l=>l==='pbs'||l==='slightly_up').length;
    if(recentLifts>=3){
      cards.push(buildInsightCard('Strength Progression','3+ recent check-ins show PR or "up" lift trends.','Your plan periodization is working; you are in an expansion phase.','Log your lifts carefully to capture new PRs and track 1RM growth.'));
    }
  }
  return cards;
}
function getHomeNextAction({checkins,sessions,todaySession,plan}){
  const todayIso=new Date().toISOString().split('T')[0];
  const lastCheckinMs=checkins.length?toMs(checkins[0].createdAt):0;
  const daysSinceCheckin=lastCheckinMs?daysAgo(lastCheckinMs):99;
  const hasGymToday=sessions.some(s=>s.isoDate===todayIso&&s.dayName!=='Custom EMOM');
  const latestWeight=checkins.find(item=>item.weight)?.weight||null;
  const isTrainingDay=todaySession?.tag!=='rest'&&todaySession?.tag!=='active';
  if(daysSinceCheckin>=4){
    return{label:'Run check-in',detail:`Last check-in was ${daysSinceCheckin} day${daysSinceCheckin===1?'':'s'} ago. Refresh recovery inputs before hard training.`,ctaText:'Check-In',ctaAction:"goTo('checkin')"};
  }
  if(isTrainingDay&&!hasGymToday){
    return{label:'Log today training',detail:'Today is scheduled training. Log your session to keep progression and load analytics accurate.',ctaText:'Log gym',ctaAction:"goTo('logselect')"};
  }
  if(!latestWeight){
    return{label:'Capture bodyweight',detail:'No recent bodyweight log detected. Add one to improve calorie and trend quality.',ctaText:'Nutrition',ctaAction:"goTo('nutritionHub')"};
  }
  const highStrain=plan?.analysis?.tier===0||Boolean(plan?.analysis?.autoDeloadReason);
  if(highStrain){
    return{label:'Prioritize recovery',detail:'Readiness is constrained. Prioritize recovery protocol before adding extra training stress.',ctaText:'Recovery',ctaAction:"goTo('sauna')"};
  }
  return{label:'Review performance',detail:'Core tasks are current. Open performance analytics to detect the next progression target.',ctaText:'Statistics',ctaAction:"goTo('statsHub')"};
}
function renderHomeDashboard({p,checkins,sessions,plan,streak,game}){
  const heroBadges=document.getElementById('heroBadges');
  const streakMini=document.getElementById('homeStreakMini');
  const protocolCard=document.getElementById('homeProtocolCard');
  const nutritionCard=document.getElementById('homeNutritionCard');
  const trendCard=document.getElementById('homeTrendCard');
  const actionStrip=document.getElementById('homeActionStrip');
  if(heroBadges){
    const level=getLevel(checkins.length);
    heroBadges.innerHTML=`<div class="badge g">${p.days}x/week</div><div class="badge b">${p.sessionLen}min</div><div class="badge">${trEnum('experience',p.experience)}</div>${(p.focusMuscles||[]).map(m=>`<div class="badge p">${trEnum('muscle',m)}</div>`).join('')}<div class="level-badge" style="color:${level.color};border-color:${level.color}50;background:${level.color}10;">${level.name}</div>`;
  }
  if(streakMini)streakMini.textContent=`${Math.max(0,streak.count)}w`;
  const primary=getPrimarySession(plan);
  const todaySession=primary.session;
  const exerciseCount=todaySession?.exercises?.filter(ex=>ex.scheme!=='—').length||0;
  const ml=plan.analysis?.ml;
  const trainingDays=getProfileTrainingDays(p);
  const saunaDays=getProfileSaunaDays(p);
  const calorieMode=p.customCalories?`${p.customCalories} kcal locked`:`${trEnum('dietGoal',p.dietGoal)} adaptive`;
  const reminderSummary=buildProfileReminderSummary(p);
  const isFreshStart=!checkins.length&&!sessions.length;
  const nextAction=getHomeNextAction({checkins,sessions,todaySession,plan});
  const mlBadge=ml?.enabled
    ?`<div class="tiny-stat">ML active · ${(ml.probability*100).toFixed(0)}% readiness${ml.adjusted?` · mode ${ml.baseTier}→${plan.analysis.tier}`:''}</div>`
    :`<div class="tiny-stat">ML warming up · ${ml?.samples||0}/8 samples</div>`;
  if(protocolCard){
    protocolCard.innerHTML=isFreshStart
      ?`<div class="section-kicker">Launch Brief</div><div class="section-title">Ready for ${goalLabel(p.goal)||'your goal'}</div><div class="section-copy">Your split, calories, recovery defaults, and reminders are live. Pick your first move.</div><div class="tiny-stat-row"><div class="tiny-stat">${trainingDays.join(' · ')}</div><div class="tiny-stat">${calorieMode}</div></div><div class="launch-grid"><div class="launch-card"><strong>Training</strong><span>${trainingDays.join(' · ')} · ${p.sessionLen} min</span></div><div class="launch-card"><strong>Focus</strong><span>${(p.focusMuscles||[]).map(m=>trEnum('muscle',m)).join(' · ')||'General balance'}</span></div><div class="launch-card"><strong>Recovery</strong><span>${cap(p.saunaGoal||'recovery')} · ${saunaDays.join(' · ')}</span></div><div class="launch-card"><strong>Reminders</strong><span>${reminderSummary}</span></div></div><div class="protocol-strip"><div class="protocol-row"><div><div class="protocol-label">Starter session</div><div class="protocol-value">${todaySession?.day||trainingDays[0]} · ${todaySession?.name||'Adaptive split ready'}</div></div><button class="btn btn-outline btn-sm" id="wtPlan" onclick="viewCurrentPlan()">Open plan</button></div><div class="protocol-row"><div><div class="protocol-label">Best next step</div><div class="protocol-value">Run your first check-in so recovery, calories, and adaptation go live.</div></div><button class="btn btn-outline btn-sm" id="wtCheckin" onclick="goTo('checkin')">Check-In</button></div></div>`
        :`<div class="section-kicker">Daily System</div><div class="section-title">What to do today</div><div class="section-copy">${nextAction.detail}</div><div class="tiny-stat-row">${mlBadge}<div class="tiny-stat">${plan.analysis.autoDeloadReason?'Auto deload active':'Adaptive tier live'}</div></div><div class="protocol-strip"><div class="protocol-row"><div><div class="protocol-label">Next best action</div><div class="protocol-value">${nextAction.label}</div></div><button class="btn btn-outline btn-sm highlight-btn" onclick="${nextAction.ctaAction}">${nextAction.ctaText}</button></div></div>`;
  }
  if(nutritionCard){
    nutritionCard.innerHTML=`<div class="section-kicker">Diet Overview</div><div class="metric-big">${plan.analysis.kcal}</div><div class="metric-sub">${isFreshStart?`${calorieMode} from your profile · `:''}Daily target with ${plan.meals.length} meal slot${plan.meals.length===1?'':'s'} · ${plan.analysis.protein}g protein · ${plan.analysis.carbs}g carbs</div><div class="tiny-stat-row"><div class="tiny-stat">Protein ${plan.analysis.protein}g</div><div class="tiny-stat">Carbs ${plan.analysis.carbs}g</div><div class="tiny-stat">Fats ${plan.analysis.fat}g</div></div>`;
  }
  if(trendCard){
    trendCard.innerHTML=`<div class="section-kicker">Logged Trend</div><div class="chart-shell compact"><div class="chart-shell-head"><span>Bodyweight / readiness</span><span>Tap chart</span></div><canvas id="homeCheckinChart" style="width:100%;height:110px;"></canvas><div id="homeCheckinChartMeta" class="chart-meta"></div><div id="homeCheckinEmpty" class="chart-empty" style="display:none;">Add check-ins to unlock your trend line.</div></div><div class="tiny-stat-row"><div class="tiny-stat">Gym ${sessions.filter(s=>s.dayName!=='Custom EMOM').length}</div><div class="tiny-stat">EMOM ${sessions.filter(s=>String(s.dayName||'').includes('EMOM')).length}</div><div class="tiny-stat">Sauna ${saunaState.sessions}</div></div>`;
    const series=(checkins.filter(c=>c.weight).reverse().slice(-8).map(item=>({value:parseFloat(item.weight),label:item.date||''})));
    if(series.length>=2)renderInsightChart(series,'homeCheckinChart','homeCheckinEmpty','#00d4ff',{height:110,formatter:(value)=>`${value.toFixed(1)} kg`,metaLabel:'Start',metaMidLabel:'Latest'});else renderInsightChart(checkins.slice(-8).map(item=>({value:parseFloat(item.energy)||0,label:item.date||''})),'homeCheckinChart','homeCheckinEmpty','#00d4ff',{height:110,formatter:(value)=>`Energy ${Math.round(value)}/10`,metaLabel:'First',metaMidLabel:'Latest'});
  }
  if(actionStrip){
    actionStrip.innerHTML=isFreshStart
      ?`<div class="section-kicker">First Steps</div><div class="home-actions"><button class="mini-action-card" id="wtCheckin" onclick="goTo('checkin')"><div class="mini-action-head"><span class="mini-action-icon lime"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><h4>First Check-In</h4></div><p>Log recovery and bodyweight to activate the plan.</p></button><button class="mini-action-card" id="wtPlan" onclick="viewCurrentPlan()"><div class="mini-action-head"><span class="mini-action-icon cyan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><h4>Starter Plan</h4></div><p>Review the split built from your ${goalLabel(p.goal)||'goal'} setup.</p></button><button class="mini-action-card" id="wtSauna" onclick="goTo('sauna')"><div class="mini-action-head"><span class="mini-action-icon orange"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20v-6a4 4 0 0 1 8 0v6M6 20h12M8 7c0-1.7 1-2.5 2.2-3.5M12 7c0-1.7 1-2.5 2.2-3.5M16 7c0-1.7 1-2.5 2.2-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><h4>Recovery Setup</h4></div><p>${cap(p.saunaGoal||'recovery')} mode on ${saunaDays.join(' · ')}.</p></button><button class="mini-action-card" id="wtSettings" onclick="goTo('settings')"><div class="mini-action-head"><span class="mini-action-icon gold"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.7h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L4.6 11a7.9 7.9 0 0 0-.1 1 7.9 7.9 0 0 0 .1 1l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" fill="currentColor"/></svg></span><h4>Edit Profile</h4></div><p>Update schedule, calories, reminders, and recovery defaults.</p></button></div>`
      :`<div class="section-kicker">Quick Actions</div><div class="home-actions"><button class="mini-action-card" id="wtCheckin" onclick="goTo('checkin')"><div class="mini-action-head"><span class="mini-action-icon lime"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><h4>Check-In</h4></div><p>${nextAction.label==='Run check-in'?nextAction.detail:(checkins.length?`Last update ${daysAgo(toMs(checkins[0].createdAt))}d ago`:'Run your first check-in to generate the plan.')}</p></button><button class="mini-action-card" id="wtLog" onclick="goTo('logselect')"><div class="mini-action-head"><span class="mini-action-icon cyan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h4l2-4 4 8 2-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><h4>Log Training</h4></div><p>Save gym work and keep the plan adaptive.</p></button><button class="mini-action-card" id="wtEmom" onclick="goToEmomBuilder()"><div class="mini-action-head"><span class="mini-action-icon blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg></span><h4>Build EMOM</h4></div><p>Configure minute intervals with structured reps.</p></button><button class="mini-action-card" id="wtStrength" onclick="goTo('statsHub')"><div class="mini-action-head"><span class="mini-action-icon gold"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><h4>Statistics</h4></div><p>See strength, progress, and recovery trends.</p></button></div>`;
  }
}
function renderTrainingHub({plan,activities=[]}){
  const weekLabel=document.getElementById('trainingHubWeekLabel');
  const title=document.getElementById('trainingHubTitle');
  const weekWrap=document.getElementById('trainingWeekOverview');
  const todayWrap=document.getElementById('trainingTodayCard');
  const cardioWrap=document.getElementById('trainingCardioCard');
  if(!weekWrap||!todayWrap||!plan)return;
  const today=getTodayWeekday();
  const primary=getPrimarySession(plan).session;
  if(weekLabel)weekLabel.textContent=`Week ${plan.analysis?.block?.week||1}`;
  if(title)title.textContent=primary?.tag==='rest'?'Recovery today':`Today: ${primary?.name||'Training'}`;
  window.currentTrainingSplitDays=Array.isArray(plan.splitDays)?plan.splitDays:[];
  weekWrap.innerHTML=`<div class="week-chip-row week-chip-row-compact">${plan.splitDays.map((day,idx)=>`<div class="week-chip compact ${day.day===today?'today':''} ${day.tag==='rest'||day.tag==='active'?'rest':''}" style="cursor:pointer;" onclick="showDayPlanByIndex(${idx})"><div class="week-chip-day">${day.day}</div><div class="week-chip-name">${day.name}</div><div class="week-chip-tag">${day.tag==='rest'?'Recovery':day.tag==='active'?'Active':(day.exercises||[]).filter(ex=>ex.scheme!=='—').length+' lifts'}</div></div>`).join('')}</div>`;
  const list=(primary?.exercises||[]).filter(ex=>ex.scheme!=='—').slice(0,8);
  todayWrap.innerHTML=`<div class="session-feature session-feature-link" onclick="openPlanTab('training')"><div class="session-feature-head"><div><div class="section-kicker">Today</div><div class="session-feature-title">${primary?.day||today} · ${primary?.name||'Training day'}</div><div class="session-feature-copy">${primary?.note||'Open the training tab for the full session.'}</div></div><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openPlanTab('training')">Training plan</button></div><div class="session-ex-list">${list.length?list.map(ex=>`<div class="session-ex-item"><div><div class="session-ex-name">${ex.name}</div><div class="session-ex-meta">${ex.muscle?cap(ex.muscle):'Accessory'}${ex.isFocus?' · focus':''}</div></div><div class="session-ex-scheme">${ex.scheme}</div></div>`).join(''):'<div class="chart-empty">Recovery day. Open the training tab if you still need the full plan.</div>'}</div></div>`;
  if(cardioWrap)cardioWrap.innerHTML=renderCardioSummaryHTML(activities,window.userProfile?.weight);
}
function showDayPlan(dayName,dayData){
  const exList=(dayData.exercises||[]).filter(ex=>ex.scheme!=='—');
  const headline=`${dayName} · ${dayData.name||'Training'}`;
  const exText=exList.length
    ?exList.slice(0,5).map(ex=>`${ex.name} (${ex.scheme})`).join(' | ')
    :'Rest day or active recovery';
  const msg=dayData.note?`${dayData.note} | ${exText}`:exText;
  showToast(headline,msg,8000);
}
window.showDayPlan=showDayPlan;
function showDayPlanByIndex(index){
  const days=Array.isArray(window.currentTrainingSplitDays)?window.currentTrainingSplitDays:[];
  const dayData=days[index];
  if(!dayData)return;
  openPlanTab('training',dayData.day||'');
}
window.showDayPlanByIndex=showDayPlanByIndex;
function renderCardioSummaryHTML(activities,weightKg){
  if(!activities||!activities.length)return`<div class="info-box" style="margin-bottom:14px;"><div class="info-lbl">Cardio &amp; Activities</div><div style="font-size:13px;color:#888;">No cardio logged yet. Tap Log Cardio Activity to add runs, swims, cycles and more — calorie burn is factored into your daily target.</div></div>`;
  const cutoff=Date.now()-7*24*60*60*1000;
  const recent=activities.filter(a=>getActivityTimestamp(a)>=cutoff);
  const weeklyBurn=recent.reduce((sum,a)=>sum+calcActivityCalories(a.sport,a.duration,weightKg),0);
  const rows=activities.slice(0,5).map(a=>{const sport=CARDIO_SPORTS.find(s=>s.key===a.sport)||{label:a.sport,icon:'🏃'};const kcal=calcActivityCalories(a.sport,a.duration,weightKg);return`<div class="session-ex-item"><div><div class="session-ex-name">${sport.icon} ${sport.label}</div><div class="session-ex-meta">${a.duration} min · ${a.date||a.isoDate||''}</div></div><div class="session-ex-scheme">+${kcal} kcal</div></div>`;}).join('');
  return`<div class="info-box" style="margin-bottom:14px;"><div class="info-lbl" style="display:flex;justify-content:space-between;align-items:center;"><span>Cardio &amp; Activities</span>${weeklyBurn?`<span style="color:#c8ff00;font-weight:700;">+${weeklyBurn} kcal this week</span>`:''}</div><div class="session-ex-list" style="margin-top:8px;">${rows}</div></div>`;
}
function renderNutritionHub({checkins,plan}){
  const macroWrap=document.getElementById('nutritionMacroStrip');
  const mealsWrap=document.getElementById('nutritionMeals');
  if(!macroWrap||!mealsWrap||!plan)return;
  macroWrap.innerHTML=`<div class="macro-strip"><div class="macro-pill"><strong>${plan.analysis.kcal}</strong><span>kcal</span></div><div class="macro-pill"><strong>${plan.analysis.protein}g</strong><span>protein</span></div><div class="macro-pill"><strong>${plan.analysis.carbs}g</strong><span>carbs</span></div><div class="macro-pill"><strong>${plan.analysis.fat}g</strong><span>fat</span></div></div>`;
  const kcalSeries=checkins.filter(item=>item.planSummary?.kcal).reverse().slice(-8).map(item=>({value:parseFloat(item.planSummary.kcal),label:item.date||''}));
  renderInsightChart(kcalSeries,'nutritionKcalChart','nutritionKcalEmpty','#c8ff00',{height:130,formatter:(value)=>`${Math.round(value)} kcal`,metaLabel:'First target',metaMidLabel:'Current target'});
  const mealState=getMealLogState()[new Date().toISOString().split('T')[0]]||{};
  mealsWrap.innerHTML=plan.meals.map((meal,index)=>{
    const logged=mealState[index];
    const loggedDetail=logged?`<div class="meal-log-detail" style="font-size:12px;color:#c8ff00;margin-top:4px;"><strong>${logged.item}</strong> · ${logged.kcal} kcal</div>`:'';
    return`<div class="meal-slot-card"><div class="meal-slot-head"><div class="meal-num">${meal.num}</div><div class="meal-slot-copy"><div class="meal-slot-name">${meal.name}</div><div class="meal-slot-time">${meal.time} · ${meal.kcal} kcal</div></div><button class="meal-slot-toggle ${logged?'logged':''}" onclick="toggleMealSlotLog(${index})">${logged?'✓':'+'}</button></div><ul class="meal-slot-items">${meal.items.map(([food,qty])=>`<li><span>${food}</span><span>${qty}</span></li>`).join('')}</ul>${loggedDetail}</div>`;
  }).join('');
  const latestWeight=checkins.find(item=>item.weight)?.weight||window.userProfile?.weight||null;
  const weightMeta=document.getElementById('nutritionWeightMeta');
  const weightInput=document.getElementById('nutritionWeightInput');
  if(weightMeta)weightMeta.textContent=latestWeight?`Latest bodyweight: ${latestWeight} kg`:'No bodyweight logged yet. Save one here to start your trend.';
  if(weightInput&&document.activeElement!==weightInput)weightInput.value='';
}
function renderStatsHub({p,checkins,sessions,plan,game,streak}){
  const trainingSection=document.getElementById('statsTrainingSection');
  const nutritionSection=document.getElementById('statsNutritionSection');
  const recoverySection=document.getElementById('statsRecoverySection');
  if(!trainingSection||!nutritionSection||!recoverySection||!plan)return;
  trainingSection.innerHTML=`<div class="stats-card"><div class="stats-card-head"><div class="stats-card-head-main"><span class="stats-card-icon cyan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h4l2-4 4 8 2-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="stats-card-title">Training</div><div class="stats-card-copy">Strength access plus weekly set landmarks from your recent logs.</div></div></div><button class="btn btn-outline btn-sm highlight-btn" onclick="goTo('strength')">Strength</button></div><div id="statsVolumeWrap"></div></div>`;
  renderVolumeInto(sessions,'statsVolumeWrap');
  const insightCards=generateInsightCards(checkins,sessions);
  if(insightCards.length){
    const insightHtml=`<div style="margin-top:16px;"><div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:12px;padding:0 16px;">Clinical Insights</div><div style="padding:0 16px;">${insightCards.join('')}</div></div>`;
    trainingSection.innerHTML+=insightHtml;
    insightCards.forEach((card,idx)=>{
      const types=['volume_surge','energy_peak','strength_progression'];
      trackFlowEvent('insight_shown',{insightType:types[idx%3],position:'stats_hub_training'});
    });
  }
  nutritionSection.innerHTML=`<div class="stats-card"><div class="stats-card-head"><div class="stats-card-head-main"><span class="stats-card-icon lime"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c1.7 2 2.5 4 2.5 6S8.7 14 7 16c-1.7-2-2.5-4-2.5-6S5.3 6 7 4zm10 0c1.7 2 2.5 4 2.5 6s-.8 4-2.5 6c-1.7-2-2.5-4-2.5-6S15.3 6 17 4zM12 10v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="stats-card-title">Nutrition</div><div class="stats-card-copy">Bodyweight trend, goal progress, and the gamified layer underneath it.</div></div></div><button class="btn btn-outline btn-sm highlight-btn" onclick="goTo('nutritionHub')">Nutrition</button></div><div class="chart-shell"><div class="chart-shell-head"><span>Weight Change</span><span>Tap chart</span></div><canvas id="statsWeightChart" style="width:100%;height:120px;"></canvas><div id="statsWeightChartMeta" class="chart-meta"></div><div id="statsWeightEmpty" class="chart-empty" style="display:none;">Add bodyweight in check-ins to start this graph.</div></div><div class="stats-grid">${buildGoalProgressMarkup(checkins,p,game)}<div class="stats-mini"><strong>${streak.count} week${streak.count===1?'':'s'}</strong><span>${game.xp} XP earned · next level at ${game.nextXp} XP.</span></div></div></div>`;
  const ml=plan.analysis?.ml;
  nutritionSection.innerHTML=`<div class="stats-card"><div class="stats-card-head"><div class="stats-card-head-main"><span class="stats-card-icon lime"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4c1.7 2 2.5 4 2.5 6S8.7 14 7 16c-1.7-2-2.5-4-2.5-6S5.3 6 7 4zm10 0c1.7 2 2.5 4 2.5 6s-.8 4-2.5 6c-1.7-2-2.5-4-2.5-6S15.3 6 17 4zM12 10v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="stats-card-title">Nutrition</div><div class="stats-card-copy">Bodyweight trend, goal progress, and the gamified layer underneath it.</div></div></div><button class="btn btn-outline btn-sm highlight-btn" onclick="goTo('nutritionHub')">Nutrition</button></div><div class="chart-shell"><div class="chart-shell-head"><span>Weight Change</span><span>Tap chart</span></div><canvas id="statsWeightChart" style="width:100%;height:120px;"></canvas><div id="statsWeightChartMeta" class="chart-meta"></div><div id="statsWeightEmpty" class="chart-empty" style="display:none;">Add bodyweight in check-ins to start this graph.</div></div><div class="stats-grid">${buildGoalProgressMarkup(checkins,p,game)}<div class="stats-mini"><strong>${streak.count} week${streak.count===1?'':'s'}</strong><span>${game.xp} XP earned · next level at ${game.nextXp} XP.</span></div><div class="stats-mini"><strong>${ml?.enabled?(ml.probability*100).toFixed(0)+'%' : (ml?.samples||0)+'/8'}</strong><span>${ml?.enabled?`ML readiness confidence ${(ml.confidence*100).toFixed(0)}%${ml.adjusted?` · mode adjusted ${ml.baseTier}→${plan.analysis.tier}`:''}`:'ML trainer inactive until enough check-ins are logged.'}</span></div></div></div>`;
  renderInsightChart(checkins.filter(c=>c.weight).reverse().slice(-12).map(item=>({value:parseFloat(item.weight),label:item.date||''})),'statsWeightChart','statsWeightEmpty','#c8ff00',{height:120,formatter:(value)=>`${value.toFixed(1)} kg`,metaLabel:'First log',metaMidLabel:'Latest'});
  const recoveryScore=Math.min(100,Math.round((saunaState.sessions/getSaunaTargetCount())*100));
  const recoveryMode=saunaState.goal==='recovery'?'Soft Reset':saunaState.goal==='cardio'?'Heat Engine':saunaState.goal==='stress'?'Calm Operator':'Long Game';
  recoverySection.innerHTML=`<div class="stats-card"><div class="stats-card-head"><div class="stats-card-head-main"><span class="stats-card-icon orange"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20v-6a4 4 0 0 1 8 0v6M6 20h12M8 7c0-1.7 1-2.5 2.2-3.5M12 7c0-1.7 1-2.5 2.2-3.5M16 7c0-1.7 1-2.5 2.2-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><div class="stats-card-title">Recovery</div><div class="stats-card-copy">A lighter, more playful look at how the sauna system is being used.</div></div></div><button class="btn btn-outline btn-sm highlight-btn" onclick="goTo('sauna')">Recovery</button></div><div class="stats-grid"><div class="stats-mini"><strong>${saunaState.sessions}</strong><span>Sauna sessions logged in this device session.</span></div><div class="stats-mini"><strong>${recoveryScore}%</strong><span>Of this week’s recovery target hit based on current sauna goal.</span></div><div class="stats-mini"><strong>${recoveryMode}</strong><span>Your current heat persona from the selected sauna goal.</span></div><div class="stats-mini"><strong>${getSaunaProtocol().heat.reduce((sum,val)=>sum+val,0)} min</strong><span>Total hot exposure in the current protocol build.</span></div></div></div>`;
}
async function refreshPrimarySurfaces(){
  const p=window.userProfile;
  if(!p?.setupComplete)return;
  syncProfileDrivenState();
  const name=(window.currentUser?.displayName||'').split(' ')[0]||'there';
  const greeting=document.getElementById('heroGreeting');
  const sub=document.getElementById('heroSub');
  if(greeting)greeting.textContent=tf('home.greeting',{name});
  if(sub)sub.textContent=tf('home.goalSub',{goal:goalLabel(p.goal)||'ADDAPT'});
  const [checkins,sessions,activities]=await Promise.all([window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([]),window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([]),window.fbLoadActivities?window.fbLoadActivities():Promise.resolve([])]);
  const habitCheckins=getHabitCheckins(checkins);
  const streak=calcStreak(habitCheckins);
  const game=calcGamification(habitCheckins,sessions);
  APP_STATE.gamification={xp:game.xp,level:game.level,nextXp:game.nextXp};
  const plan=buildLivePlan(checkins,sessions,undefined,activities);
  const ctx={p,checkins,sessions,activities,plan,streak,game};
  renderHomeDashboard(ctx);
  renderTrainingHub(ctx);
  renderNutritionHub(ctx);
  renderStatsHub(ctx);
  checkMilestones(habitCheckins.length);
}
function updateHomeUI(){refreshPrimarySurfaces();}

function renderPhaseCard(block){const{name,week,total,isStr,weeksLeft,earlyTrigger}=block;const col=isStr?'#00d4ff':'#c8ff00';const pct=Math.round(week/total*100);document.getElementById('phaseCardWrap').innerHTML=`<div class="phase-card"><div class="phase-top"><div><div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${col};margin-bottom:4px;">Current Phase</div><div class="phase-name" style="color:${col};">${name} Block</div><div style="font-size:12px;color:#888;margin-top:3px;">${isStr?'Lower reps · heavier weight · 3–4 min rest':'Higher reps · moderate weight · more volume'}</div></div><div><div class="phase-week" style="color:${col};">${week}<span style="font-size:14px;color:#888;font-weight:400;">/${total}</span></div><div class="phase-week-lbl">weeks</div></div></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col};"></div></div><div class="phase-meta"><span>${pct}% complete</span><span>${weeksLeft} week${weeksLeft!==1?'s':''} left</span></div><div class="phase-next">Next: <strong>${isStr?'Hypertrophy Block':'Strength Block'}</strong> in ${weeksLeft} week${weeksLeft!==1?'s':''}.</div>${earlyTrigger?`<div class="phase-trigger" style="background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.2);color:#ffaa00;">${earlyTrigger}</div>`:''}</div>`;}

function renderGWCard(checkins,p){const gw=p.goalWeight,cw=checkins.find(c=>c.weight)?.weight||p.weight;if(!gw||!cw){document.getElementById('gwCardWrap').innerHTML='';return;}const start=p.weight||cw,totalDiff=Math.abs(gw-start)||0.001,progressDiff=Math.abs(parseFloat(cw)-start),pct=Math.min(100,Math.round(progressDiff/totalDiff*100)),rate=p.dietGoal==='bulk'?0.3:p.dietGoal==='cut'?0.4:0.1,weeksLeft=Math.round(Math.abs(gw-parseFloat(cw))/(rate||0.1));document.getElementById('gwCardWrap').innerHTML=`<div class="gw-card"><div class="gw-top"><div><div style="font-size:10px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">Goal Weight</div><div style="font-family:'Syne',-apple-system,sans-serif;font-weight:700;font-size:15px;">${cw}kg → ${gw}kg</div></div><div class="gw-pct">${pct}%</div></div><div class="gw-bar-track"><div class="gw-bar-fill" style="width:${pct}%;"></div></div><div class="gw-meta"><span>${cw}kg now</span><span>${gw}kg target</span></div><div class="gw-eta">${pct>=100?'<strong>Goal reached!</strong>':weeksLeft>0?'Estimated: <strong>~'+weeksLeft+' weeks</strong> to reach '+gw+'kg':'Keep logging weight to track progress'}</div></div>`;}

// ════════════════════════════════════
// CHECK-IN SUBMIT
// ════════════════════════════════════
function submitCheckin(){
  const energy=parseInt(document.getElementById('eS').value),stress=parseInt(document.getElementById('sS').value),weight=document.getElementById('ciW').value?parseFloat(document.getElementById('ciW').value):null,notes=document.getElementById('ciNotes').value||'',sleep=document.querySelector('#sleepC .chip.sel')?.dataset.val||'7-8hrs',lifts=document.querySelector('#liftC .chip.sel')?.dataset.val||'same',diet=document.querySelector('#dietC .chip.sel')?.dataset.val||'under',calOverride=getCalOverride();
  window.currentCheckin={energy,stress,weight,notes,sleep,lifts,diet,calOverride,isoDate:new Date().toISOString().split('T')[0],date:new Date().toLocaleDateString('en-GB')};
  trackFlowEvent('checkin_submitted',{hasWeight:Boolean(weight),energy,stress,lifts,diet});
  goTo('generating');runSteps();
  setTimeout(async()=>{
    finishSteps();
    const[lastSessions,pastCheckins,recentActivities]=await Promise.all([window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([]),window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([]),window.fbLoadActivities?window.fbLoadActivities():Promise.resolve([])]);
    const plan=buildPlan(window.userProfile,window.currentCheckin,lastSessions,pastCheckins,recentActivities);
    window.currentPlanData=plan;
    if(window.fbSaveCheckin)await window.fbSaveCheckin({...window.currentCheckin,planSummary:plan.summary});
    trackFlowEvent('checkin_saved',{kcal:plan.summary?.kcal||plan.analysis?.kcal||null,tier:plan.analysis?.tier||null});
    renderPlan(plan);checkMilestones(getHabitCheckins(pastCheckins).length+1);goTo('result');
  },5400);
}
window.submitCheckin=submitCheckin;
function runSteps(){if(stepInterval){clearInterval(stepInterval);stepInterval=null;}for(let i=1;i<=8;i++){const s=document.getElementById('gs'+i);if(s){s.className='gstep';s.querySelector('.gstep-icon').textContent='○';}}document.getElementById('gs1').classList.add('cur');let i=1;stepInterval=setInterval(()=>{const p=document.getElementById('gs'+i);if(p){p.className='gstep done';p.querySelector('.gstep-icon').textContent='✓';}i++;const c=document.getElementById('gs'+i);if(c)c.classList.add('cur');if(i>8){clearInterval(stepInterval);stepInterval=null;}},630);}
function finishSteps(){if(stepInterval){clearInterval(stepInterval);stepInterval=null;}for(let i=1;i<=8;i++){const s=document.getElementById('gs'+i);if(s){s.className='gstep done';s.querySelector('.gstep-icon').textContent='✓';}}}
function swTab(n,el){document.querySelectorAll('.tab-body').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));document.getElementById('tab-'+n).classList.add('active');el.classList.add('active');}
window.swTab=swTab;

function openPlanTab(activeTab='overview',focusDay=''){
  const ci=window.currentCheckin||getDefaultDashboardCheckin();
  window.currentCheckin=ci;
  Promise.all([window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([]),window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([]),window.fbLoadActivities?window.fbLoadActivities():Promise.resolve([])]).then(([sessions,checkins,activities])=>{
    const plan=buildLivePlan(checkins,sessions,ci,activities);
    renderPlan(plan,activeTab,focusDay);
    goTo('result');
  });
}
window.openPlanTab=openPlanTab;

async function saveNutritionWeight(){
  const input=document.getElementById('nutritionWeightInput');
  if(!input)return;
  const weight=parseFloat(input.value);
  if(!Number.isFinite(weight)||weight<20||weight>400){
    showToast('Weight invalid','Enter a realistic bodyweight in kg.');
    input.focus();
    return;
  }
  const base={...getDefaultDashboardCheckin(),...(window.currentCheckin||{})};
  const quickCheckin={
    ...base,
    weight,
    notes:base.notes||'Quick weight log from nutrition hub',
    isoDate:new Date().toISOString().split('T')[0],
    date:new Date().toLocaleDateString('en-GB'),
    quickWeightOnly:true
  };
  const [sessions,checkins,activities]=await Promise.all([
    window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([]),
    window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([]),
    window.fbLoadActivities?window.fbLoadActivities():Promise.resolve([])
  ]);
  const plan=buildPlan(window.userProfile,quickCheckin,sessions,checkins,activities);
  if(window.fbSaveCheckin)await window.fbSaveCheckin({...quickCheckin,planSummary:plan.summary});
  window.currentCheckin=quickCheckin;
  input.value='';
  showToast('Weight saved',`${weight} kg added to your data.`);
  trackFlowEvent('nutrition_weight_saved',{weight});
  await refreshPrimarySurfaces();
}
window.saveNutritionWeight=saveNutritionWeight;

// ════════════════════════════════════
// CARDIO ACTIVITY LOGGER
// ════════════════════════════════════
let selectedCardioSport=null;
function renderLogCardio(){
  selectedCardioSport=null;
  const chipsWrap=document.getElementById('cardioSportChips');
  if(chipsWrap){
    chipsWrap.innerHTML=CARDIO_SPORTS.map(s=>`<div class="chip" onclick="selectCardioSport(this,'${s.key}')">${s.icon} ${s.label}</div>`).join('');
  }
  const dur=document.getElementById('cardioDurSlider');
  if(dur)dur.value=30;
  const durVal=document.getElementById('cardioDurVal');
  if(durVal)durVal.textContent='30 min';
  const preview=document.getElementById('cardioCalPreview');
  if(preview)preview.style.display='none';
  const btn=document.getElementById('cardioSaveBtn');
  if(btn)btn.disabled=true;
}
window.renderLogCardio=renderLogCardio;
function selectCardioSport(el,key){
  document.querySelectorAll('#cardioSportChips .chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  selectedCardioSport=key;
  updateCardioCalPreview();
}
window.selectCardioSport=selectCardioSport;
function updateCardioDur(val){
  const durVal=document.getElementById('cardioDurVal');
  if(durVal)durVal.textContent=val+' min';
  updateCardioCalPreview();
}
window.updateCardioDur=updateCardioDur;
function updateCardioCalPreview(){
  const dur=parseInt(document.getElementById('cardioDurSlider')?.value||30);
  const weightKg=window.userProfile?.weight||75;
  const preview=document.getElementById('cardioCalPreview');
  const calVal=document.getElementById('cardioCalVal');
  const btn=document.getElementById('cardioSaveBtn');
  if(!selectedCardioSport){if(preview)preview.style.display='none';if(btn)btn.disabled=true;return;}
  const kcal=calcActivityCalories(selectedCardioSport,dur,weightKg);
  if(calVal)calVal.textContent='+'+kcal+' kcal burned';
  if(preview)preview.style.display='block';
  if(btn)btn.disabled=false;
}
async function submitActivityLog(){
  if(!selectedCardioSport){showToast('Select a sport','Choose what you did before saving.');return;}
  const dur=parseInt(document.getElementById('cardioDurSlider')?.value||30);
  const isoDate=new Date().toISOString().split('T')[0];
  const date=new Date().toLocaleDateString('en-GB');
  const weightKg=window.userProfile?.weight||75;
  const kcal=calcActivityCalories(selectedCardioSport,dur,weightKg);
  const activity={sport:selectedCardioSport,duration:dur,kcal,isoDate,date};
  if(window.fbSaveActivity)await window.fbSaveActivity(activity);
  showToast('Activity logged',`${CARDIO_SPORTS.find(s=>s.key===selectedCardioSport)?.label||selectedCardioSport} · ${dur} min · +${kcal} kcal`);
  refreshPrimarySurfaces();
  goTo('trainingHub');
}
window.submitActivityLog=submitActivityLog;

// ════════════════════════════════════
// EXPANDED EXERCISE LIBRARY
// ════════════════════════════════════
const EX_LIB={
  // ── CHEST ──
  bench:         {name:'Barbell Bench Press',        muscle:'chest',      pattern:'push_h', eq:['full']},
  incline_bench: {name:'Incline Barbell Bench Press',muscle:'chest',      pattern:'push_h', eq:['full']},
  decline_bench: {name:'Decline Barbell Press',      muscle:'chest',      pattern:'push_h', eq:['full']},
  db_bench:      {name:'DB Bench Press',             muscle:'chest',      pattern:'push_h', eq:['full','dumbbells']},
  incline_db:    {name:'Incline DB Press',           muscle:'chest',      pattern:'push_h', eq:['full','dumbbells']},
  decline_db:    {name:'Decline DB Press',           muscle:'chest',      pattern:'push_h', eq:['full','dumbbells']},
  db_fly:        {name:'DB Fly',                     muscle:'chest',      pattern:'iso',    eq:['full','dumbbells']},
  incline_db_fly:{name:'Incline DB Fly',             muscle:'chest',      pattern:'iso',    eq:['full','dumbbells']},
  cable_fly_low: {name:'Cable Fly (Low-to-High)',    muscle:'chest',      pattern:'iso',    eq:['full']},
  cable_fly_mid: {name:'Cable Fly (Mid)',            muscle:'chest',      pattern:'iso',    eq:['full']},
  cable_fly_high:{name:'Cable Fly (High-to-Low)',    muscle:'chest',      pattern:'iso',    eq:['full']},
  cable_cross:   {name:'Cable Crossover',            muscle:'chest',      pattern:'iso',    eq:['full']},
  pec_deck:      {name:'Pec Deck Machine',           muscle:'chest',      pattern:'iso',    eq:['full']},
  chest_press_m: {name:'Chest Press Machine',        muscle:'chest',      pattern:'push_h', eq:['full']},
  dips:          {name:'Dips (Chest)',               muscle:'chest',      pattern:'push_h', eq:['full']},
  pushup:        {name:'Push-Ups',                   muscle:'chest',      pattern:'push_h', eq:['full','dumbbells','bands','none']},
  wide_pushup:   {name:'Wide Push-Ups',              muscle:'chest',      pattern:'push_h', eq:['full','dumbbells','bands','none']},
  band_chest:    {name:'Band Chest Press',           muscle:'chest',      pattern:'push_h', eq:['bands']},
  band_fly:      {name:'Band Fly',                   muscle:'chest',      pattern:'iso',    eq:['bands']},
  svend_press:   {name:'Svend Press',                muscle:'chest',      pattern:'iso',    eq:['full','dumbbells']},
  // ── SHOULDERS ──
  ohp:           {name:'Barbell Overhead Press',     muscle:'shoulders',  pattern:'push_v', eq:['full']},
  db_ohp:        {name:'DB Shoulder Press',          muscle:'shoulders',  pattern:'push_v', eq:['full','dumbbells']},
  arnold:        {name:'Arnold Press',               muscle:'shoulders',  pattern:'push_v', eq:['full','dumbbells']},
  seated_ohp:    {name:'Seated DB Shoulder Press',   muscle:'shoulders',  pattern:'push_v', eq:['full','dumbbells']},
  smith_ohp:     {name:'Smith Machine OHP',          muscle:'shoulders',  pattern:'push_v', eq:['full']},
  cable_ohp:     {name:'Cable Overhead Press',       muscle:'shoulders',  pattern:'push_v', eq:['full']},
  band_press:    {name:'Band Overhead Press',        muscle:'shoulders',  pattern:'push_v', eq:['bands']},
  pike_pushup:   {name:'Pike Push-Up',               muscle:'shoulders',  pattern:'push_v', eq:['none','bands']},
  hspu:          {name:'Handstand Push-Up',          muscle:'shoulders',  pattern:'push_v', eq:['none']},
  lat_raise:     {name:'DB Lateral Raise',           muscle:'shoulders',  pattern:'iso',    eq:['full','dumbbells']},
  cable_lat:     {name:'Cable Lateral Raise',        muscle:'shoulders',  pattern:'iso',    eq:['full']},
  band_lat:      {name:'Band Lateral Raise',         muscle:'shoulders',  pattern:'iso',    eq:['bands']},
  lean_lat:      {name:'Leaning DB Lateral Raise',   muscle:'shoulders',  pattern:'iso',    eq:['full','dumbbells']},
  rear_delt:     {name:'Rear Delt Fly (DB)',         muscle:'shoulders',  pattern:'iso',    eq:['full','dumbbells']},
  cable_rear:    {name:'Cable Rear Delt Fly',        muscle:'shoulders',  pattern:'iso',    eq:['full']},
  face_pull:     {name:'Cable Face Pull',            muscle:'shoulders',  pattern:'iso',    eq:['full']},
  band_face_pull:{name:'Band Face Pull',             muscle:'shoulders',  pattern:'iso',    eq:['bands','none']},
  upright_row:   {name:'Upright Row (DB)',           muscle:'shoulders',  pattern:'iso',    eq:['full','dumbbells']},
  reverse_pec:   {name:'Reverse Pec Deck',           muscle:'shoulders',  pattern:'iso',    eq:['full']},
  // ── BACK ──
  pullups:       {name:'Weighted Pull-Ups',          muscle:'back',       pattern:'pull_v', eq:['full']},
  pullups_bw:    {name:'Pull-Ups',                   muscle:'back',       pattern:'pull_v', eq:['full','dumbbells','bands','none']},
  chinup:        {name:'Chin-Ups',                   muscle:'back',       pattern:'pull_v', eq:['full','dumbbells','bands','none']},
  lat_pulldown:  {name:'Lat Pulldown',               muscle:'back',       pattern:'pull_v', eq:['full']},
  close_pulldown:{name:'Close-Grip Lat Pulldown',    muscle:'back',       pattern:'pull_v', eq:['full']},
  single_pulldown:{name:'Single-Arm Pulldown',       muscle:'back',       pattern:'pull_v', eq:['full']},
  straight_pulldown:{name:'Straight-Arm Pulldown',   muscle:'back',       pattern:'iso',    eq:['full']},
  barbell_row:   {name:'Barbell Row',                muscle:'back',       pattern:'pull_h', eq:['full']},
  pendlay_row:   {name:'Pendlay Row',                muscle:'back',       pattern:'pull_h', eq:['full']},
  cable_row:     {name:'Seated Cable Row',           muscle:'back',       pattern:'pull_h', eq:['full']},
  cable_row_wide:{name:'Wide-Grip Cable Row',        muscle:'back',       pattern:'pull_h', eq:['full']},
  db_row:        {name:'Single-Arm DB Row',          muscle:'back',       pattern:'pull_h', eq:['full','dumbbells']},
  chest_sup_row: {name:'Chest-Supported DB Row',     muscle:'back',       pattern:'pull_h', eq:['full','dumbbells']},
  tbar_row:      {name:'T-Bar Row',                  muscle:'back',       pattern:'pull_h', eq:['full']},
  machine_row:   {name:'Machine Row',                muscle:'back',       pattern:'pull_h', eq:['full']},
  inverted_row:  {name:'Inverted Row',               muscle:'back',       pattern:'pull_h', eq:['none','bands']},
  band_row:      {name:'Band Row',                   muscle:'back',       pattern:'pull_h', eq:['bands','none']},
  pullover:      {name:'Cable Pullover',             muscle:'back',       pattern:'iso',    eq:['full']},
  db_pullover:   {name:'DB Pullover',                muscle:'back',       pattern:'iso',    eq:['full','dumbbells']},
  superman:      {name:'Superman Hold',              muscle:'back',       pattern:'iso',    eq:['none','bands']},
  hyperext:      {name:'Back Extension',             muscle:'back',       pattern:'hinge',  eq:['full']},
  // ── BICEPS ──
  ez_curl:       {name:'EZ-Bar Curl',                muscle:'biceps',     pattern:'iso',    eq:['full']},
  barbell_curl:  {name:'Barbell Curl',               muscle:'biceps',     pattern:'iso',    eq:['full']},
  db_curl:       {name:'DB Curl',                    muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  hammer_curl:   {name:'Hammer Curl',                muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  incline_curl:  {name:'Incline DB Curl',            muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  conc_curl:     {name:'Concentration Curl',         muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  spider_curl:   {name:'Spider Curl',                muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  cable_curl:    {name:'Cable Curl',                 muscle:'biceps',     pattern:'iso',    eq:['full']},
  cable_hammer:  {name:'Cable Rope Hammer Curl',     muscle:'biceps',     pattern:'iso',    eq:['full']},
  preacher_curl: {name:'Preacher Curl',              muscle:'biceps',     pattern:'iso',    eq:['full']},
  reverse_curl:  {name:'Reverse Curl',               muscle:'biceps',     pattern:'iso',    eq:['full','dumbbells']},
  band_curl:     {name:'Band Curl',                  muscle:'biceps',     pattern:'iso',    eq:['bands']},
  band_hammer:   {name:'Band Hammer Curl',           muscle:'biceps',     pattern:'iso',    eq:['bands']},
  chin_bw:       {name:'Chin-Up (Bicep Focus)',      muscle:'biceps',     pattern:'pull_v', eq:['full','dumbbells','bands','none']},
  // ── TRICEPS ──
  rope_pushdown: {name:'Tricep Rope Pushdown',       muscle:'triceps',    pattern:'iso',    eq:['full']},
  bar_pushdown:  {name:'Tricep Bar Pushdown',        muscle:'triceps',    pattern:'iso',    eq:['full']},
  skull_crush:   {name:'Skull Crushers (EZ)',        muscle:'triceps',    pattern:'iso',    eq:['full']},
  db_skull:      {name:'DB Skull Crushers',          muscle:'triceps',    pattern:'iso',    eq:['full','dumbbells']},
  overhead_ext:  {name:'Overhead Tricep Extension',  muscle:'triceps',    pattern:'iso',    eq:['full','dumbbells']},
  cable_overhead:{name:'Cable Overhead Extension',   muscle:'triceps',    pattern:'iso',    eq:['full']},
  cg_bench:      {name:'Close-Grip Bench Press',     muscle:'triceps',    pattern:'push_h', eq:['full']},
  db_kickback:   {name:'DB Tricep Kickback',         muscle:'triceps',    pattern:'iso',    eq:['dumbbells']},
  cable_kickback_tri:{name:'Cable Tricep Kickback',  muscle:'triceps',    pattern:'iso',    eq:['full']},
  dips_tri:      {name:'Dips (Tricep)',              muscle:'triceps',    pattern:'push_h', eq:['full']},
  diamond_pu:    {name:'Diamond Push-Up',            muscle:'triceps',    pattern:'iso',    eq:['none','bands']},
  band_pushdown: {name:'Band Tricep Pushdown',       muscle:'triceps',    pattern:'iso',    eq:['bands']},
  band_ext:      {name:'Band Overhead Extension',    muscle:'triceps',    pattern:'iso',    eq:['bands']},
  // ── QUADS ──
  back_squat:    {name:'Barbell Back Squat',         muscle:'quads',      pattern:'squat',  eq:['full']},
  front_squat:   {name:'Front Squat',                muscle:'quads',      pattern:'squat',  eq:['full']},
  hack_squat:    {name:'Hack Squat Machine',         muscle:'quads',      pattern:'squat',  eq:['full']},
  leg_press:     {name:'Leg Press',                  muscle:'quads',      pattern:'squat',  eq:['full']},
  leg_press_wide:{name:'Wide-Stance Leg Press',      muscle:'quads',      pattern:'squat',  eq:['full']},
  goblet_squat:  {name:'Goblet Squat',               muscle:'quads',      pattern:'squat',  eq:['full','dumbbells']},
  bss:           {name:'Bulgarian Split Squat',      muscle:'quads',      pattern:'squat',  eq:['full','dumbbells']},
  walking_lunge: {name:'Walking Lunge (DB)',         muscle:'quads',      pattern:'squat',  eq:['full','dumbbells']},
  db_lunge:      {name:'DB Reverse Lunge',           muscle:'quads',      pattern:'squat',  eq:['dumbbells']},
  step_up:       {name:'DB Step-Up',                 muscle:'quads',      pattern:'squat',  eq:['full','dumbbells']},
  leg_ext:       {name:'Leg Extension',              muscle:'quads',      pattern:'iso',    eq:['full']},
  sissy_squat:   {name:'Sissy Squat',                muscle:'quads',      pattern:'squat',  eq:['full','dumbbells','bands','none']},
  band_squat:    {name:'Band Squat',                 muscle:'quads',      pattern:'squat',  eq:['bands']},
  bw_squat:      {name:'Bodyweight Squat',           muscle:'quads',      pattern:'squat',  eq:['none']},
  jump_squat:    {name:'Jump Squat',                 muscle:'quads',      pattern:'squat',  eq:['none']},
  wall_sit:      {name:'Wall Sit',                   muscle:'quads',      pattern:'iso',    eq:['none']},
  // ── HAMSTRINGS ──
  deadlift:      {name:'Conventional Deadlift',      muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  sumo_dl:       {name:'Sumo Deadlift',              muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  rdl:           {name:'Romanian Deadlift',          muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  db_rdl:        {name:'DB Romanian Deadlift',       muscle:'hamstrings', pattern:'hinge',  eq:['full','dumbbells']},
  single_rdl:    {name:'Single-Leg RDL (DB)',        muscle:'hamstrings', pattern:'hinge',  eq:['full','dumbbells']},
  stiff_leg_dl:  {name:'Stiff-Leg Deadlift',        muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  leg_curl:      {name:'Lying Leg Curl',             muscle:'hamstrings', pattern:'iso',    eq:['full']},
  seated_curl:   {name:'Seated Leg Curl',            muscle:'hamstrings', pattern:'iso',    eq:['full']},
  nordic:        {name:'Nordic Curl',                muscle:'hamstrings', pattern:'hinge',  eq:['full','dumbbells','bands','none']},
  good_morning:  {name:'Good Morning',               muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  db_good_morn:  {name:'DB Good Morning',            muscle:'hamstrings', pattern:'hinge',  eq:['dumbbells']},
  band_leg_curl: {name:'Band Lying Leg Curl',        muscle:'hamstrings', pattern:'iso',    eq:['bands']},
  glute_ham:     {name:'Glute-Ham Raise',            muscle:'hamstrings', pattern:'hinge',  eq:['full']},
  // ── GLUTES ──
  hip_thrust:    {name:'Hip Thrust (Barbell)',       muscle:'glutes',     pattern:'iso',    eq:['full']},
  db_hip_thrust: {name:'DB Hip Thrust',              muscle:'glutes',     pattern:'iso',    eq:['dumbbells']},
  band_hip_thrust:{name:'Band Hip Thrust',           muscle:'glutes',     pattern:'iso',    eq:['bands']},
  glute_bridge:  {name:'Glute Bridge',               muscle:'glutes',     pattern:'iso',    eq:['full','dumbbells','bands','none']},
  single_bridge: {name:'Single-Leg Glute Bridge',    muscle:'glutes',     pattern:'iso',    eq:['none','bands']},
  cable_kickback:{name:'Cable Glute Kickback',       muscle:'glutes',     pattern:'iso',    eq:['full']},
  band_kickback: {name:'Band Glute Kickback',        muscle:'glutes',     pattern:'iso',    eq:['bands','none']},
  donkey_kick:   {name:'Donkey Kick',                muscle:'glutes',     pattern:'iso',    eq:['bands','none','dumbbells']},
  fire_hydrant:  {name:'Fire Hydrant',               muscle:'glutes',     pattern:'iso',    eq:['bands','none']},
  abductor_m:    {name:'Hip Abductor Machine',       muscle:'glutes',     pattern:'iso',    eq:['full']},
  clamshell:     {name:'Clamshell (Band)',           muscle:'glutes',     pattern:'iso',    eq:['bands','none']},
  band_walk:     {name:'Band Side Walk',             muscle:'glutes',     pattern:'iso',    eq:['bands']},
  curtsy_lunge:  {name:'Curtsy Lunge',               muscle:'glutes',     pattern:'squat',  eq:['full','dumbbells','none']},
  sumo_squat:    {name:'Sumo Squat (DB)',            muscle:'glutes',     pattern:'squat',  eq:['full','dumbbells']},
  cable_pull_through:{name:'Cable Pull-Through',    muscle:'glutes',     pattern:'hinge',  eq:['full']},
  // ── CALVES ──
  standing_calf: {name:'Standing Calf Raise',        muscle:'calves',     pattern:'iso',    eq:['full','dumbbells']},
  seated_calf:   {name:'Seated Calf Raise',          muscle:'calves',     pattern:'iso',    eq:['full']},
  leg_press_calf:{name:'Leg Press Calf Raise',       muscle:'calves',     pattern:'iso',    eq:['full']},
  smith_calf:    {name:'Smith Machine Calf Raise',   muscle:'calves',     pattern:'iso',    eq:['full']},
  sl_calf:       {name:'Single-Leg Calf Raise',      muscle:'calves',     pattern:'iso',    eq:['full','dumbbells','none','bands']},
  db_calf:       {name:'DB Standing Calf Raise',     muscle:'calves',     pattern:'iso',    eq:['dumbbells']},
  bw_calf:       {name:'Bodyweight Calf Raise',      muscle:'calves',     pattern:'iso',    eq:['none']},
  jump_rope:     {name:'Jump Rope',                  muscle:'calves',     pattern:'iso',    eq:['none']},
  // ── CORE ──
  plank:         {name:'Plank',                      muscle:'core',       pattern:'iso',    eq:['full','dumbbells','bands','none']},
  side_plank:    {name:'Side Plank',                 muscle:'core',       pattern:'iso',    eq:['full','dumbbells','bands','none']},
  cable_crunch:  {name:'Cable Crunch',               muscle:'core',       pattern:'iso',    eq:['full']},
  leg_raise:     {name:'Hanging Leg Raise',          muscle:'core',       pattern:'iso',    eq:['full']},
  knee_raise:    {name:'Hanging Knee Raise',         muscle:'core',       pattern:'iso',    eq:['full']},
  ab_wheel:      {name:'Ab Wheel Rollout',           muscle:'core',       pattern:'iso',    eq:['full','dumbbells']},
  russian_twist: {name:'Russian Twist',              muscle:'core',       pattern:'iso',    eq:['full','dumbbells','none','bands']},
  bw_crunch:     {name:'Crunch',                     muscle:'core',       pattern:'iso',    eq:['none','bands']},
  bicycle_crunch:{name:'Bicycle Crunch',             muscle:'core',       pattern:'iso',    eq:['none']},
  dead_bug:      {name:'Dead Bug',                   muscle:'core',       pattern:'iso',    eq:['none']},
  hollow_hold:   {name:'Hollow Body Hold',           muscle:'core',       pattern:'iso',    eq:['none']},
  v_up:          {name:'V-Up',                       muscle:'core',       pattern:'iso',    eq:['none']},
  pallof_press:  {name:'Pallof Press',               muscle:'core',       pattern:'iso',    eq:['full','bands']},
  cable_twist:   {name:'Cable Wood Chop',            muscle:'core',       pattern:'iso',    eq:['full']},
  flutter_kick:  {name:'Flutter Kick',               muscle:'core',       pattern:'iso',    eq:['none']},
};

// ════════════════════════════════════
// SWAP ALTERNATIVES — keyed by muscle + equipment
// Returns same muscle, similar movement pattern first, then other patterns
// ════════════════════════════════════
const SWAP_ALTS={
  chest:{
    full:   ['incline_bench','decline_bench','db_bench','incline_db','decline_db','cable_fly_mid','cable_fly_low','cable_fly_high','pec_deck','chest_press_m','db_fly','incline_db_fly','cable_cross','dips','svend_press'],
    dumbbells:['db_bench','incline_db','decline_db','db_fly','incline_db_fly','svend_press','pushup','wide_pushup','dips'],
    bands:  ['band_chest','band_fly','pushup','wide_pushup'],
    none:   ['pushup','wide_pushup','diamond_pu'],
  },
  shoulders:{
    full:   ['db_ohp','arnold','seated_ohp','smith_ohp','cable_ohp','cable_lat','lean_lat','cable_rear','face_pull','reverse_pec','upright_row','lat_raise','rear_delt'],
    dumbbells:['arnold','seated_ohp','db_ohp','lat_raise','lean_lat','rear_delt','upright_row','band_face_pull'],
    bands:  ['band_press','band_lat','band_face_pull','pike_pushup'],
    none:   ['pike_pushup','hspu','band_face_pull'],
  },
  back:{
    full:   ['lat_pulldown','close_pulldown','single_pulldown','straight_pulldown','pullups','chinup','cable_row','cable_row_wide','machine_row','tbar_row','barbell_row','pendlay_row','db_row','chest_sup_row','pullover','db_pullover','hyperext'],
    dumbbells:['db_row','chest_sup_row','pullups_bw','chinup','db_pullover','inverted_row','superman'],
    bands:  ['band_row','pullups_bw','chinup','inverted_row','superman'],
    none:   ['pullups_bw','chinup','inverted_row','band_row','superman'],
  },
  biceps:{
    full:   ['barbell_curl','ez_curl','db_curl','hammer_curl','incline_curl','conc_curl','spider_curl','preacher_curl','cable_curl','cable_hammer','reverse_curl','chin_bw'],
    dumbbells:['db_curl','hammer_curl','incline_curl','conc_curl','spider_curl','reverse_curl','chin_bw'],
    bands:  ['band_curl','band_hammer','chin_bw'],
    none:   ['chin_bw','band_curl'],
  },
  triceps:{
    full:   ['rope_pushdown','bar_pushdown','skull_crush','db_skull','overhead_ext','cable_overhead','cg_bench','dips_tri','cable_kickback_tri','db_kickback'],
    dumbbells:['db_skull','overhead_ext','db_kickback','dips_tri','diamond_pu'],
    bands:  ['band_pushdown','band_ext','diamond_pu'],
    none:   ['diamond_pu','dips_tri','band_pushdown'],
  },
  quads:{
    full:   ['front_squat','hack_squat','leg_press','leg_press_wide','bss','walking_lunge','step_up','leg_ext','goblet_squat','sissy_squat'],
    dumbbells:['goblet_squat','bss','walking_lunge','db_lunge','step_up','sissy_squat'],
    bands:  ['band_squat','bss','sissy_squat','jump_squat'],
    none:   ['bw_squat','bss','jump_squat','sissy_squat','wall_sit'],
  },
  hamstrings:{
    full:   ['sumo_dl','stiff_leg_dl','rdl','db_rdl','single_rdl','leg_curl','seated_curl','nordic','good_morning','glute_ham'],
    dumbbells:['db_rdl','single_rdl','db_good_morn','nordic'],
    bands:  ['band_leg_curl','nordic','single_rdl'],
    none:   ['nordic','single_rdl'],
  },
  glutes:{
    full:   ['db_hip_thrust','glute_bridge','single_bridge','cable_kickback','cable_pull_through','abductor_m','sumo_squat','curtsy_lunge','donkey_kick','band_walk','clamshell'],
    dumbbells:['db_hip_thrust','glute_bridge','sumo_squat','curtsy_lunge','single_bridge','donkey_kick'],
    bands:  ['band_hip_thrust','band_kickback','clamshell','donkey_kick','band_walk','fire_hydrant','single_bridge'],
    none:   ['glute_bridge','single_bridge','donkey_kick','fire_hydrant','curtsy_lunge','clamshell'],
  },
  calves:{
    full:   ['leg_press_calf','smith_calf','seated_calf','sl_calf','db_calf'],
    dumbbells:['db_calf','sl_calf','bw_calf'],
    bands:  ['sl_calf','bw_calf','jump_rope'],
    none:   ['bw_calf','sl_calf','jump_rope'],
  },
  core:{
    full:   ['cable_crunch','leg_raise','knee_raise','ab_wheel','cable_twist','pallof_press','russian_twist','side_plank','hollow_hold'],
    dumbbells:['ab_wheel','russian_twist','side_plank','dead_bug','hollow_hold','bicycle_crunch'],
    bands:  ['pallof_press','russian_twist','side_plank','bicycle_crunch','dead_bug'],
    none:   ['bicycle_crunch','dead_bug','hollow_hold','v_up','flutter_kick','side_plank','russian_twist'],
  },
};

// ── PATTERN LABELS for swap display ──
const PAT_LABEL={push_h:'Horizontal Push',push_v:'Vertical Push',pull_h:'Horizontal Pull',pull_v:'Vertical Pull',squat:'Squat Pattern',hinge:'Hip Hinge',iso:'Isolation'};

function openSwap(exId){
  const ex=EX_LIB[exId];if(!ex)return;
  swapTargetEx={exId,name:ex.name,muscle:ex.muscle,pattern:ex.pattern};
  const eq=window.userProfile?.equipment||'full';
  // Get alternatives for exact muscle, filter out the current exercise
  const altIds=(SWAP_ALTS[ex.muscle]||{})[eq]||[];
  const alts=altIds.map(id=>({id,...EX_LIB[id]})).filter(e=>e&&e.name&&e.name!==ex.name);
  // Sort: same pattern first
  alts.sort((a,b)=>(a.pattern===ex.pattern?-1:1)-(b.pattern===ex.pattern?-1:1));
  document.getElementById('swapTitle').textContent='Swap: '+ex.name;
  document.getElementById('swapSub').textContent=cap(ex.muscle)+' exercise alternatives';
  // Group by pattern
  const groups={};alts.forEach(e=>{const pg=e.pattern===ex.pattern?'Same Pattern — '+cap((PAT_LABEL[e.pattern]||e.pattern)):PAT_LABEL[e.pattern]||cap(e.pattern);if(!groups[pg])groups[pg]=[];groups[pg].push(e);});
  let html='';
  Object.entries(groups).forEach(([g,list])=>{
    html+=`<div class="swap-group-lbl">${g}</div>`;
    list.forEach(e=>{html+=`<div class="swap-opt"><div><div class="swap-opt-name">${e.name}</div><div class="swap-opt-meta">${cap(e.muscle)}</div></div><button class="swap-sel" onclick="doSwap('${e.name}','${e.muscle}')">Select</button></div>`;});
  });
  if(!html)html='<div class="empty" style="padding:20px 0;">No alternatives for your equipment.<br>Try a different equipment setting in Settings.</div>';
  document.getElementById('swapOpts').innerHTML=html;
  document.getElementById('swapOvl').classList.add('open');
  document.getElementById('swapSheet').classList.add('open');
}
window.openSwap=openSwap;
function closeSwap(){document.getElementById('swapOvl').classList.remove('open');document.getElementById('swapSheet').classList.remove('open');}
window.closeSwap=closeSwap;
function doSwap(newName,newMuscle){
  if(window.currentPlanData&&swapTargetEx){
    window.currentPlanData.splitDays.forEach(d=>{d.exercises=d.exercises.map(e=>e.name===swapTargetEx.name?{...e,name:newName,muscle:newMuscle}:e);});
    const prefs=window.userProfile?.swapPrefs||{};prefs[swapTargetEx.name]=newName;if(window.userProfile)window.userProfile.swapPrefs=prefs;if(window.fbSaveProfile)window.fbSaveProfile(window.userProfile);
    renderPlan(window.currentPlanData);
  }
  closeSwap();showToast('Exercise swapped',`Now using: ${newName}`);
}
window.doSwap=doSwap;

// ════════════════════════════════════
// SESSION BUILDER
// ════════════════════════════════════
function buildSession(name,tag,exIds,equipment,sessionLen,sets,cReps,iReps,focusMuscles,isStr,suggestFn){
  const lim={30:4,45:6,60:8,90:12}[sessionLen]||8;
  const includeArms=sessionLen>=45;
  let exList=exIds.map(id=>EX_LIB[id]).filter(e=>{if(!e)return false;if(!e.eq.includes(equipment))return false;if(!includeArms&&(e.muscle==='biceps'||e.muscle==='triceps'))return false;return true;});
  const hasPush=exList.some(e=>e.pattern.startsWith('push'));const hasPull=exList.some(e=>e.pattern.startsWith('pull'));const hasLeg=exList.some(e=>e.pattern==='squat'||e.pattern==='hinge');
  if(tag==='full'){if(!hasPush){const fb=getEx(['bench','db_bench','pushup'],equipment)[0];if(fb)exList.unshift(fb);}if(!hasPull){const fb=getEx(['barbell_row','db_row','pullups_bw'],equipment)[0];if(fb)exList.unshift(fb);}if(!hasLeg){const fb=getEx(['back_squat','goblet_squat','bw_squat'],equipment)[0];if(fb)exList.unshift(fb);}}
  const focusEx=exList.filter(e=>focusMuscles.includes(e.muscle));const restEx=exList.filter(e=>!focusMuscles.includes(e.muscle));
  const sorted=[...focusEx,...restEx].slice(0,lim);
  const exercises=sorted.map(e=>{const isComp=e.pattern==='squat'||e.pattern==='hinge'||e.pattern==='push_h'||e.pattern==='pull_h'||e.pattern==='pull_v'||e.pattern==='push_v';const scheme=e.muscle==='calves'||e.muscle==='core'?(e.name.includes('Plank')||e.name.includes('Hold')||e.name.includes('Sit')?'3×45s':sets+'×15'):(sets+'×'+(isComp?cReps:iReps));const suggest=suggestFn?suggestFn(e.name,scheme):null;return{...e,scheme,suggest,isFocus:focusMuscles.includes(e.muscle)};});
  return{name,tag,exercises,note:isStr?'Strength block — 3–4 min rest. Stop 1 rep before failure.':''};
}
function getEx(ids,eq){return ids.map(id=>EX_LIB[id]).filter(e=>e&&e.eq.includes(eq));}


// ════════════════════════════════════════════════════════════════
// ADDAPT — UNIFIED PLAN ENGINE
// ════════════════════════════════════════════════════════════════
// Flow: getGoalProfile → getWeeklySetTargets → getSessionTemplates
//       → distributeVolume → buildOneSession → assembleSplitDays

// ── 1. GOAL PROFILE ──────────────────────────────────────────────
function getGoalProfile(goal,focusMuscles=[]){
  const base={
    vtaper:   {priority:['back','shoulders'],          secondary:['chest','triceps','biceps','core'],   maintenance:['quads','hamstrings','glutes','calves']},
    hourglass:{priority:['glutes','shoulders'],         secondary:['hamstrings','quads','back','core'],  maintenance:['chest','biceps','triceps','calves']},
    strength: {priority:['quads','hamstrings','chest','back','shoulders'],secondary:['glutes','triceps','biceps','core'],maintenance:['calves']},
    general:  {priority:['back','quads'],              secondary:['chest','shoulders','glutes','hamstrings','core'],maintenance:['biceps','triceps','calves']},
  }[goal]||{priority:['back','quads'],secondary:['chest','shoulders','glutes','hamstrings','core'],maintenance:['biceps','triceps','calves']};
  const promoted=[...new Set([...focusMuscles,...base.priority])];
  const secondary=base.secondary.filter(m=>!promoted.includes(m));
  const maintenance=base.maintenance.filter(m=>!promoted.includes(m)&&!secondary.includes(m));
  return{priority:promoted,secondary,maintenance};
}

// ── 2. WEEKLY SET TARGETS ─────────────────────────────────────────
function getWeeklySetTargets(gp,goal,days,sessionLen,tier){
  const deloadMult=tier===0?0.5:tier===1?0.8:1.0;
  const lenAdj=sessionLen<=30?-3:sessionLen<=45?-1:sessionLen>=90?2:0;
  const trainDays=Math.min(days,6);
  const targets={};
  const allMuscles=[...gp.priority,...gp.secondary,...gp.maintenance];
  for(const muscle of allMuscles){
    let base;
    if(gp.priority.includes(muscle)){
      base=goal==='strength'?14:16;
      // extra volume for custom focus muscles beyond the default priority pair
      const defaultPriority={vtaper:['back','shoulders'],hourglass:['glutes','shoulders'],strength:['quads','hamstrings','chest','back','shoulders'],general:['back','quads']}[goal]||['back','quads'];
      if(!defaultPriority.includes(muscle))base+=2;
    } else if(gp.secondary.includes(muscle)){
      base=10;
    } else {
      base=trainDays<=2?6:8;
    }
    base+=lenAdj;
    base=Math.round(base*deloadMult);
    base=Math.max(gp.maintenance.includes(muscle)?4:6,base);
    targets[muscle]=base;
  }
  return targets;
}

// ── 3. SESSION TEMPLATES ─────────────────────────────────────────
// Explicitly defined per goal × days.
// No named splits required — just muscle order per session.
// V-taper includes legs 2×/week. All goals can include any muscle
// wherever it makes sense for frequency targets.
function getSessionTemplates(goal,days){
  const d=Math.min(days===7?6:days,6);
  const T={
    vtaper:{
      1:[{name:'Full Body',                     tag:'full', muscles:['back','shoulders','quads','hamstrings','chest','biceps','triceps','core']}],
      2:[{name:'Upper — Back + Delts',          tag:'upper',muscles:['back','shoulders','chest','biceps','triceps','core']},
         {name:'Lower + Shoulders',             tag:'full', muscles:['quads','hamstrings','glutes','shoulders','calves','core']}],
      3:[{name:'Upper A — Width',               tag:'upper',muscles:['back','shoulders','biceps','chest','triceps','core']},
         {name:'Lower A',                       tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Upper B — Delts + Chest',       tag:'upper',muscles:['shoulders','chest','back','triceps','biceps']}],
      4:[{name:'Upper A — Back Lead',           tag:'upper',muscles:['back','shoulders','biceps','chest','core']},
         {name:'Lower A — Quad Focus',          tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Upper B — Delts + Chest',       tag:'upper',muscles:['shoulders','chest','triceps','back','biceps']},
         {name:'Lower B — Posterior Chain',     tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']}],
      5:[{name:'Upper A — Back Lead',           tag:'upper',muscles:['back','shoulders','biceps','chest','core']},
         {name:'Lower A — Quad Focus',          tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Upper B — Delts + Chest',       tag:'upper',muscles:['shoulders','chest','triceps','back']},
         {name:'Lower B — Posterior Chain',     tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']},
         {name:'Back + Arms Focus',             tag:'focus',muscles:['back','shoulders','biceps','triceps','core']}],
      6:[{name:'Pull A — Lat Width',            tag:'upper',muscles:['back','biceps','shoulders','core']},
         {name:'Lower A — Quad Focus',          tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Push — Delts + Chest',          tag:'upper',muscles:['shoulders','chest','triceps','back']},
         {name:'Pull B — Thickness',            tag:'upper',muscles:['back','biceps','shoulders']},
         {name:'Lower B — Posterior Chain',     tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']},
         {name:'Delts + Arms',                  tag:'focus',muscles:['shoulders','back','biceps','triceps','core']}],
    },
    hourglass:{
      1:[{name:'Full Body — Glute Bias',        tag:'full', muscles:['glutes','hamstrings','quads','shoulders','back','core','calves']}],
      2:[{name:'Lower — Glute Focus',           tag:'lower',muscles:['glutes','hamstrings','quads','calves','core']},
         {name:'Upper + Glute Pump',            tag:'full', muscles:['shoulders','back','glutes','hamstrings','core','calves']}],
      3:[{name:'Lower A — Glute Bias',          tag:'lower',muscles:['glutes','hamstrings','quads','calves','core']},
         {name:'Upper — Delts + Back',          tag:'upper',muscles:['shoulders','back','chest','biceps','triceps','core']},
         {name:'Lower B — Glutes + Hams',       tag:'lower',muscles:['glutes','quads','hamstrings','calves','core']}],
      4:[{name:'Lower A — Glute Bias',          tag:'lower',muscles:['glutes','hamstrings','quads','calves','core']},
         {name:'Upper A — Delts + Back',        tag:'upper',muscles:['shoulders','back','biceps','triceps','core']},
         {name:'Lower B — Glutes + Quads',      tag:'lower',muscles:['glutes','quads','hamstrings','calves','core']},
         {name:'Upper B — Shape Upper',         tag:'upper',muscles:['back','shoulders','chest','biceps','triceps']}],
      5:[{name:'Lower A — Glute Bias',          tag:'lower',muscles:['glutes','hamstrings','quads','calves','core']},
         {name:'Upper A — Delts + Back',        tag:'upper',muscles:['shoulders','back','biceps','triceps','core']},
         {name:'Lower B — Glutes + Quads',      tag:'lower',muscles:['glutes','quads','hamstrings','calves']},
         {name:'Upper B — Shape Upper',         tag:'upper',muscles:['back','shoulders','chest','biceps','triceps']},
         {name:'Glute Pump Day',                tag:'focus',muscles:['glutes','hamstrings','core','calves']}],
      6:[{name:'Lower A — Glute Bias',          tag:'lower',muscles:['glutes','hamstrings','quads','calves','core']},
         {name:'Upper A — Delts + Back',        tag:'upper',muscles:['shoulders','back','biceps','triceps']},
         {name:'Glute Specialisation',          tag:'focus',muscles:['glutes','hamstrings','core','calves']},
         {name:'Lower B — Glutes + Quads',      tag:'lower',muscles:['glutes','quads','hamstrings','calves']},
         {name:'Upper B — Shape Upper',         tag:'upper',muscles:['back','shoulders','chest','biceps','triceps']},
         {name:'Glute Pump + Core',             tag:'focus',muscles:['glutes','hamstrings','core','calves']}],
    },
    strength:{
      1:[{name:'Full Body Strength',            tag:'full', muscles:['quads','hamstrings','chest','back','shoulders','triceps','core']}],
      2:[{name:'Squat + Bench',                 tag:'full', muscles:['quads','hamstrings','chest','back','triceps','core']},
         {name:'Deadlift + Press',              tag:'full', muscles:['hamstrings','back','shoulders','chest','biceps','core']}],
      3:[{name:'Squat Day',                     tag:'lower',muscles:['quads','hamstrings','glutes','core']},
         {name:'Bench Day',                     tag:'upper',muscles:['chest','shoulders','triceps','back']},
         {name:'Deadlift Day',                  tag:'lower',muscles:['hamstrings','back','glutes','quads','core']}],
      4:[{name:'Squat Day',                     tag:'lower',muscles:['quads','hamstrings','glutes','core']},
         {name:'Bench Day',                     tag:'upper',muscles:['chest','shoulders','triceps','back']},
         {name:'Deadlift Day',                  tag:'lower',muscles:['hamstrings','back','glutes','core']},
         {name:'Press + Pull',                  tag:'upper',muscles:['shoulders','back','chest','biceps','triceps']}],
      5:[{name:'Squat Day',                     tag:'lower',muscles:['quads','hamstrings','glutes','core']},
         {name:'Bench Day',                     tag:'upper',muscles:['chest','shoulders','triceps','back']},
         {name:'Deadlift Day',                  tag:'lower',muscles:['hamstrings','back','glutes','core']},
         {name:'Press Day',                     tag:'upper',muscles:['shoulders','chest','triceps','back']},
         {name:'Pull + Variation',              tag:'upper',muscles:['back','biceps','quads','core']}],
      6:[{name:'Squat Day',                     tag:'lower',muscles:['quads','hamstrings','glutes','core']},
         {name:'Bench Day',                     tag:'upper',muscles:['chest','shoulders','triceps','back']},
         {name:'Deadlift Day',                  tag:'lower',muscles:['hamstrings','back','glutes','core']},
         {name:'Press Day',                     tag:'upper',muscles:['shoulders','chest','triceps','back']},
         {name:'Pull Day',                      tag:'upper',muscles:['back','biceps','shoulders','core']},
         {name:'Technique + Hypertrophy',       tag:'full', muscles:['quads','hamstrings','chest','back','core']}],
    },
    general:{
      1:[{name:'Full Body',                     tag:'full', muscles:['quads','hamstrings','glutes','chest','back','shoulders','core','calves']}],
      2:[{name:'Full Body A',                   tag:'full', muscles:['quads','chest','back','shoulders','hamstrings','core']},
         {name:'Full Body B',                   tag:'full', muscles:['hamstrings','glutes','back','chest','shoulders','core','calves']}],
      3:[{name:'Push',                          tag:'upper',muscles:['chest','shoulders','triceps','core']},
         {name:'Pull',                          tag:'upper',muscles:['back','biceps','shoulders','core']},
         {name:'Legs',                          tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']}],
      4:[{name:'Upper A',                       tag:'upper',muscles:['chest','back','shoulders','biceps','triceps','core']},
         {name:'Lower A',                       tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Upper B',                       tag:'upper',muscles:['back','shoulders','chest','biceps','triceps']},
         {name:'Lower B',                       tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']}],
      5:[{name:'Upper A',                       tag:'upper',muscles:['chest','back','shoulders','biceps','triceps']},
         {name:'Lower A',                       tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Full Body — Athletic',          tag:'full', muscles:['back','chest','quads','hamstrings','shoulders','core']},
         {name:'Upper B',                       tag:'upper',muscles:['shoulders','back','chest','biceps','triceps']},
         {name:'Lower B',                       tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']}],
      6:[{name:'Push A',                        tag:'upper',muscles:['chest','shoulders','triceps','core']},
         {name:'Pull A',                        tag:'upper',muscles:['back','biceps','shoulders','core']},
         {name:'Legs A',                        tag:'lower',muscles:['quads','hamstrings','glutes','calves','core']},
         {name:'Push B',                        tag:'upper',muscles:['shoulders','chest','triceps']},
         {name:'Pull B',                        tag:'upper',muscles:['back','biceps','shoulders','core']},
         {name:'Legs B',                        tag:'lower',muscles:['hamstrings','glutes','quads','calves','core']}],
    },
  };
  return(T[goal]||T.general)[d]||T.general[4];
}

// ── 4. DISTRIBUTE VOLUME ──────────────────────────────────────────
// Split each muscle's weekly set target evenly across the sessions
// that include it. First session gets the remainder sets.
function distributeVolume(templates,weeklyTargets){
  const perSession=templates.map(()=>({}));
  for(const[muscle,totalSets]of Object.entries(weeklyTargets)){
    const indices=templates.map((t,i)=>t.muscles.includes(muscle)?i:-1).filter(i=>i>=0);
    if(!indices.length)continue;
    const base=Math.floor(totalSets/indices.length);
    const rem=totalSets%indices.length;
    indices.forEach((idx,rank)=>{perSession[idx][muscle]=base+(rank===0?rem:0);});
  }
  return perSession;
}

// ── 5. EXERCISE PICKER ───────────────────────────────────────────
const SESSION_EX_BANK={
  chest:     {anchor:['bench','db_bench','pushup'],           work:['incline_bench','incline_db','chest_press_m'],  iso:['cable_fly_mid','pec_deck','db_fly','incline_db']},
  back:      {anchor:['barbell_row','pullups_bw','lat_pulldown'], work:['cable_row','db_row','machine_row'],         iso:['pullover','db_pullover','machine_row','hyperext']},
  shoulders: {anchor:['ohp','db_ohp','arnold'],               work:['lat_raise','cable_lat','rear_delt'],           iso:['face_pull','cable_rear','lean_lat','reverse_pec']},
  biceps:    {anchor:['chin_bw','barbell_curl'],              work:['ez_curl','db_curl','hammer_curl'],             iso:['incline_curl','cable_curl','preacher_curl','conc_curl']},
  triceps:   {anchor:['cg_bench','dips_tri'],                 work:['rope_pushdown','skull_crush','overhead_ext'],  iso:['bar_pushdown','overhead_ext','db_kickback']},
  glutes:    {anchor:['hip_thrust','db_hip_thrust','bss'],                    work:['glute_bridge','hip_thrust','abductor_m'],  iso:['band_walk','clamshell','donkey_kick','fire_hydrant']},
  quads:     {anchor:['back_squat','front_squat','leg_press'],work:['hack_squat','bss','walking_lunge'],            iso:['leg_ext','sissy_squat','goblet_squat']},
  hamstrings:{anchor:['deadlift','rdl','db_rdl'],             work:['leg_curl','seated_curl','good_morning'],       iso:['nordic','band_leg_curl','single_rdl']},
  calves:    {anchor:['standing_calf'],                       work:['seated_calf','smith_calf'],                iso:['sl_calf','db_calf','bw_calf']},
  core:      {anchor:['plank'],                               work:['cable_crunch','leg_raise','ab_wheel'],         iso:['side_plank','hollow_hold','dead_bug','bw_crunch']},
};
function pickEx(muscle,kind,equipment,used){
  const bank=SESSION_EX_BANK[muscle]||{};
  const order=kind==='anchor'?['anchor','work','iso']:kind==='work'?['work','iso','anchor']:['iso','work','anchor'];
  const allLib = getAllExercises();
  for(const bucket of order){for(const id of(bank[bucket]||[])){const ex=allLib[id];if(ex&&ex.eq.includes(equipment)&&!used.has(ex.name))return{id,...ex};}}
  for(const bucket of['anchor','work','iso']){for(const id of(bank[bucket]||[])){const ex=allLib[id];if(ex&&ex.eq.includes(equipment))return{id,...ex};}}
  return null;
}
function getScheme(isStr,tier,muscle){
  if(muscle==='calves')return['3×15','3×15'];
  if(muscle==='core')return['3×30–45s','3×30–45s'];
  const s={hyp:{2:['3×8–12','3×12–15'],1:['3×10–12','3×12–15'],0:['3×12–15','3×15']},str:{2:['4×4–6','3×8–10'],1:['4×5–7','3×8–10'],0:['3×8–10','3×10–12']}};
  return(s[isStr?'str':'hyp'][tier])||['3×8–12','3×12–15'];
}
function setsIn(scheme){const m=String(scheme).match(/^(\d+)×/);return m?parseInt(m[1]):3;}

// ── 6. BUILD ONE SESSION ─────────────────────────────────────────
function buildOneSession(template,muscleSetBudget,goalProfile,equipment,sessionLen,isStr,tier,suggestFn){
  const maxEx={30:4,45:5,60:7,90:9}[sessionLen]||7;
  const exercises=[];
  const used=new Set();
  for(const muscle of template.muscles){
    if(exercises.length>=maxEx)break;
    const budget=muscleSetBudget[muscle]||0;
    if(budget<=0)continue;
    const[compSch,isoSch]=getScheme(isStr,tier,muscle);
    const compSets=setsIn(compSch),isoSets=setsIn(isoSch);
    const isAnchorMuscle=muscle===template.muscles[0];
    let remaining=budget;
    // Compound / anchor
    if(remaining>=compSets&&exercises.length<maxEx){
      const ex=pickEx(muscle,isAnchorMuscle?'anchor':'work',equipment,used);
      if(ex){used.add(ex.name);exercises.push({...ex,scheme:compSch,suggest:suggestFn?suggestFn(ex.name,compSch):null,isFocus:goalProfile.priority.includes(muscle)});remaining-=compSets;}
    }
    // Isolation if budget remains
    if(remaining>=isoSets&&exercises.length<maxEx){
      const ex=pickEx(muscle,'iso',equipment,used);
      if(ex){used.add(ex.name);const sch=`${isoSets}×${isoSch.split('×')[1]||'12–15'}`;exercises.push({...ex,scheme:sch,suggest:suggestFn?suggestFn(ex.name,sch):null,isFocus:goalProfile.priority.includes(muscle)});}
    }
  }
  let note='';
  if(tier===0)note='Deload week — all loads at 50–60%. Technique focus only.';
  else if(isStr)note='Strength block — 3–4 min rest on compounds. Stop 1 rep before failure.';
  else if(template.tag==='focus')note='Focus day — priority muscles hit first and hardest.';
  return{name:template.name,tag:template.tag,exercises,note};
}

// ── 7. ASSEMBLE SPLIT DAYS ───────────────────────────────────────
const _TRAIN_SCHED_DEFAULTS={1:['Mon'],2:['Mon','Thu'],3:['Mon','Wed','Fri'],4:['Mon','Tue','Thu','Fri'],5:['Mon','Tue','Thu','Fri','Sat'],6:['Mon','Tue','Wed','Fri','Sat','Sun']};

function assembleSplitDays(profile,equipment,sessionLen,focusMuscles,isStr,tier,suggestFn,scheduleOverride){
  const{goal='general',days=4}=profile;
  const trainDays=Math.min(days===7?6:days,6);
  const goalProfile=getGoalProfile(goal,focusMuscles);
  const weeklyTargets=getWeeklySetTargets(goalProfile,goal,days,sessionLen,tier);
  const templates=getSessionTemplates(goal,days);
  const perSession=distributeVolume(templates,weeklyTargets);
  const builtSessions=templates.map((t,i)=>buildOneSession(t,perSession[i],goalProfile,equipment,sessionLen,isStr,tier,suggestFn));

  // Build default day→sessionIndex map
  const defaultDays=_TRAIN_SCHED_DEFAULTS[trainDays]||_TRAIN_SCHED_DEFAULTS[4];
  let trainDayMap={};
  defaultDays.forEach((day,idx)=>{trainDayMap[day]=idx;});

  // Apply saved override — only accept if it covers every session exactly once
  if(scheduleOverride&&typeof scheduleOverride==='object'&&!Array.isArray(scheduleOverride)){
    const entries=Object.entries(scheduleOverride).filter(([day,idx])=>WEEKDAYS.includes(day)&&Number.isInteger(idx)&&idx>=0&&idx<builtSessions.length);
    const uniqueIdx=new Set(entries.map(([,idx])=>idx));
    if(entries.length===builtSessions.length&&uniqueIdx.size===builtSessions.length)trainDayMap=Object.fromEntries(entries);
  }

  const splitDays=WEEKDAYS.map(day=>{
    if(trainDayMap[day]!==undefined&&builtSessions[trainDayMap[day]])return{day,...builtSessions[trainDayMap[day]]};
    return{day,...(days===7?{name:'Active Recovery',tag:'active',exercises:[{name:'Walk or mobility',scheme:'20–30 min',muscle:'',pattern:'',isFocus:false,suggest:null}],note:'Keep moving without adding fatigue.'}:{name:'Rest Day',tag:'rest',exercises:[{name:'Rest and recover',scheme:'—',muscle:'',pattern:'',isFocus:false,suggest:null}],note:'Eat well and sleep 7–9 hrs.'})};
  });

  const defaultPriority={vtaper:['back','shoulders'],hourglass:['glutes','shoulders'],strength:['quads','hamstrings','chest','back','shoulders'],general:['back','quads']}[goal]||['back','quads'];
  const rationale=[
    {vtaper:'Lats and delts lead every session. Legs trained 2× per week — width needs full-body frequency to work.',hourglass:'Glutes get the most weekly sessions, with upper days added for shoulder-to-waist contrast.',strength:'Sessions built around the big lifts first; accessory work fills remaining budget.',general:'Volume spread evenly with priority muscles leading each session.'}[goal]||'',
    focusMuscles.length?`${focusMuscles.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(' and ')} promoted to priority — appear first and get extra weekly sets.`:'',
    `Priority muscles: ${goalProfile.priority.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(', ')} — ${trainDays>=4?'2×':'1–2×'} per week.`,
  ].filter(Boolean).join(' ');

  return{splitDays,splitMeta:{goalProfile,weeklySets:weeklyTargets,frequency:Object.fromEntries(Object.keys(weeklyTargets).map(m=>[m,templates.filter(t=>t.muscles.includes(m)).length])),rationale}};
}

// ════════════════════════════════════
// PLAN ENGINE
// ════════════════════════════════════
function buildPlan(profile,checkin,lastSessions=[],pastCheckins=[],recentActivities=[]){
  if(!profile)profile={goal:'general',experience:'intermediate',days:4,sessionLen:60,focusMuscles:['chest','back'],equipment:'full',dietGoal:'maintain',restrictions:['none'],weight:75,height:175,age:25,sex:'male'};
  const{goal='general',experience='beginner',days=3,sessionLen=60,focusMuscles=[],equipment='full',dietGoal='maintain',restrictions=['none'],weight:pw,height=175,age=25,sex='male',customCalories}=profile;
  const{energy,stress,sleep,lifts,diet,weight:cw,calOverride}=checkin;
  const weight=cw||pw||75;
  let tier;if(energy<=3)tier=0;else if(energy<=5)tier=((sleep==='7-8hrs'||sleep==='8+hrs')&&stress<=5)?1:0;else if(energy<=7)tier=(sleep==='<5hrs'||stress>=8)?1:2;else tier=((sleep==='<5hrs'||sleep==='5-6hrs')&&stress>=7)?1:2;
  const baseTier=tier;
  const autoDeloadReason=getAutoDeloadTrigger(pastCheckins,lastSessions);
  if(autoDeloadReason)tier=0;
  const mlSignal=getMlReadinessSignal(pastCheckins,checkin);
  if(!autoDeloadReason&&mlSignal.enabled&&mlSignal.confidence>=0.18){
    if(mlSignal.probability>=0.67&&tier<2)tier++;
    else if(mlSignal.probability<=0.33&&tier>0)tier--;
  }
  const block=calcBlock(pastCheckins);const isStr=block.isStr&&tier!==0;
  const RR={beginner:{comp:{2:'10–15',1:'12–15',0:'15'},iso:{2:'12–15',1:'15',0:'15–20'}},intermediate:{comp:{2:'8–12',1:'10–12',0:'12–15'},iso:{2:'10–12',1:'12',0:'15'}},advanced:{comp:{2:'6–10',1:'8–10',0:'10–12'},iso:{2:'8–10',1:'10',0:'12'}}};
  const SRR={beginner:{comp:{2:'6–8',1:'8–10',0:'10–12'},iso:{2:'8–10',1:'10',0:'12'}},intermediate:{comp:{2:'3–6',1:'5–6',0:'8–10'},iso:{2:'6–8',1:'8',0:'10'}},advanced:{comp:{2:'1–5',1:'3–5',0:'6–8'},iso:{2:'4–6',1:'6',0:'8'}}};
  const rr=(isStr?SRR:RR)[experience]||(isStr?SRR:RR).intermediate;
  const cReps=rr.comp[tier],iReps=rr.iso[tier];
  const SM={30:{2:3,1:2,0:2},45:{2:3,1:3,0:2},60:{2:4,1:3,0:3},90:{2:5,1:4,0:3}};
  let sets=(SM[sessionLen]||SM[60])[tier];if(isStr)sets=Math.max(sets-1,2);
  const sIdx={};lastSessions.forEach(sess=>{if(sess.exercises)sess.exercises.forEach(ex=>{if(!sIdx[ex.name]||sess.isoDate>sIdx[ex.name].isoDate)sIdx[ex.name]={isoDate:sess.isoDate,maxWeight:ex.maxWeight,maxReps:ex.maxReps};});});
  function suggestW(name,scheme){const last=sIdx[name];if(!last?.maxWeight)return null;const w=parseFloat(last.maxWeight);if(!w)return null;const top=parseInt((scheme||'').split('–')[1])||10;if(last.maxReps>=top)return'Try '+(Math.round((w+2.5)*2)/2)+'kg';if(last.maxReps<top-3)return'Try '+(Math.round(w*0.95*2)/2)+'kg';return'Try '+w+'kg';}
  const sAdj=sex==='female'?-161:5;const bmr=Math.round(10*weight+6.25*height-5*age+sAdj);const tdee=Math.round(bmr*1.55);
  let kcalBase;if(calOverride){kcalBase=calOverride;}else if(customCalories){kcalBase=customCalories;}else{kcalBase={bulk:tdee+350,maintain:tdee,cut:tdee-400}[dietGoal]||tdee;}
  const dietAdj={way_under:200,under:100,on_target:0,over:-150}[diet]||0;
  const trend=calcWeightTrend(pastCheckins,weight,dietGoal);
  const cardioAdj=calcWeeklyCardioAdj(recentActivities,weight);
  let kcal=kcalBase+dietAdj+trend.adj+cardioAdj;if(tier===0)kcal=Math.max(kcal,tdee-50);kcal=Math.round(kcal/50)*50;
  const protein=Math.round(weight*(dietGoal==='cut'?2.4:2.0));const fatK=Math.round(kcal*0.28);const fat=Math.round(fatK/9);const carbs=Math.round((kcal-protein*4-fatK)/4);
  const adaptiveSplit=assembleSplitDays(profile,equipment,sessionLen,focusMuscles,isStr,tier,suggestW,profile.trainingDayMap||profile.trainingSchedule);
  const splitDays=adaptiveSplit.splitDays;
  const mealCount=kcal<2000?3:kcal<2800?4:kcal<3600?5:6;
  const meals=buildMeals(kcal,protein,carbs,fat,mealCount,restrictions,dietGoal);
  return{summary:{tier,kcal,protein,carbs,fat,days,goal},analysis:{energy,stress,sleep,tier,lifts,diet,kcal,protein,carbs,fat,dietGoal,weight,tdee,trendMsg:trend.msg,trendAdj:trend.adj,cardioAdj,block,isStr,calOverride,autoDeloadReason,ml:{...mlSignal,baseTier,adjusted:baseTier!==tier}},splitDays,meals,tier,focusMuscles,experience,sIdx,splitMeta:adaptiveSplit.splitMeta};
}

// ── MEAL BUILDER ──
function buildMeals(kcal,protein,carbs,fat,count,restrictions,dietGoal){
  const vegan=restrictions.includes('vegan'),veg=restrictions.includes('vegetarian')||vegan,noDairy=restrictions.includes('dairy_free')||vegan,halal=restrictions.includes('halal');
  const ps=vegan?['Tofu','Tempeh','Lentils','Chickpeas']:veg?['Eggs','Greek yoghurt','Tofu','Lentils']:halal?['Chicken breast','Turkey','Beef mince (halal)','Salmon']:['Chicken thigh','Salmon','Beef mince','Tuna'];
  const mk=Math.round(kcal/count),mp=Math.round(protein/count),sc=kcal/4000;
  const T=[{name:'Breakfast',time:'7:00 AM',items:[['Oats (dry)',Math.round(90*sc)+'g'],[noDairy?'Oat milk':'Whole milk','250ml'],['Banana','1 large'],['Peanut butter','2 tbsp'],[vegan?'Chia seeds':'Eggs',vegan?'20g':'2']]},{name:'Mid-Morning',time:'10:30 AM',items:[[vegan?'Soy yoghurt':noDairy?'Coconut yoghurt':'Greek yoghurt','150g'],['Granola','50g'],['Mixed nuts','25g'],['Berries','handful']]},{name:'Lunch',time:'1:00 PM',items:[['White rice (cooked)',Math.round(200*sc)+'g'],[ps[0]+' (cooked)',Math.round(180*sc)+'g'],['Avocado','half'],['Olive oil','1 tbsp'],['Mixed veg','150g']]},{name:'Pre-Workout',time:'60–90 min before',items:[['Bagel','1'],[vegan?'Almond butter':'Peanut butter','1.5 tbsp'],[vegan?'Pea protein shake':'Whey shake','1 scoop'],['Banana','1']]},{name:'Post-Workout',time:'Within 60 min',items:[[ps[1],'200g'],['Sweet potato',Math.round(250*sc)+'g'],['Olive oil','1 tbsp'],['Spinach','100g'],[noDairy?'Oat milk':'Whole milk','200ml']]},{name:'Before Bed',time:'30 min before sleep',items:[[vegan?'Soy protein':noDairy?'Protein shake':'Cottage cheese','200g'],['Mixed nuts','20g']]},];
  return T.slice(0,count).map((t,i)=>({num:i+1,...t,kcal:i===count-1?kcal-mk*(count-1):mk,protein:mp}));
}

// ════════════════════════════════════
// RENDER PLAN
// ════════════════════════════════════
function renderPlan(plan,activeTab='overview',focusDay=''){
  const{analysis,splitDays,meals,tier,focusMuscles,experience,splitMeta}=plan;
  const{energy,kcal,protein,carbs,fat,dietGoal,tdee,trendMsg,trendAdj,cardioAdj,block,isStr,calOverride,autoDeloadReason,ml}=analysis;
  const p=window.userProfile||{};
  const profileHtml=splitMeta?`<h2>Goal Profile</h2><ul><li><span>Priority muscles</span><span class="li-r">${splitMeta.goalProfile.priority.map(cap).join(' · ')}</span></li><li><span>Secondary muscles</span><span class="li-r">${splitMeta.goalProfile.secondary.map(cap).join(' · ')}</span></li><li><span>Maintenance muscles</span><span class="li-r">${splitMeta.goalProfile.maintenance.map(cap).join(' · ')}</span></li></ul>`:'';
  const freqHtml=splitMeta?`<h2>Frequency Engine</h2><ul>${Object.entries(splitMeta.frequency).map(([muscle,freq])=>`<li><span>${cap(muscle)}</span><span class="li-r">${freq}x / week</span></li>`).join('')}</ul>`:'';
  const setHtml=splitMeta?`<h2>Set Bank</h2><ul>${Object.entries(splitMeta.weeklySets).map(([muscle,total])=>`<li><span>${cap(muscle)}</span><span class="li-r">${total} sets · ${(splitMeta.frequency[muscle]||1)}x/week</span></li>`).join('')}</ul>`:'';
  const whyHtml=splitMeta?`<h2>Why This Split Works</h2><p>${splitMeta.rationale}</p>`:'';
  const dietMsg={way_under:'Calories raised. Use liquid calories — add milk to shakes.',under:'Slightly under. Add a glass of whole milk to 2 meals for +300 kcal.',on_target:'Diet adherence was on point. Keep it up.',over:'Over target. Tighten portions at meals 2 and 3.'}[analysis.diet]||'';
  const mlInsight=ml?.enabled
    ?`<p style="font-size:12px;color:${ml.adjusted?'#c8ff00':'#888'};">ML readiness ${(ml.probability*100).toFixed(0)}% · confidence ${(ml.confidence*100).toFixed(0)}% · samples ${ml.samples}${ml.adjusted?` · mode adjusted ${ml.baseTier}→${tier}`:''}</p>`
    :`<p style="font-size:12px;color:#666;">ML readiness model inactive (${ml?.samples||0} samples). Keep logging check-ins to enable it.</p>`;
  const mlPerfCard=ml?.enabled&&ml?.performance
    ?`<div style="padding:12px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.22);border-radius:10px;margin-bottom:12px;"><div style="font-size:10px;color:#00d4ff;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">ML Performance · v${ml.version}${ml.cached?' · cached':''}</div><div style="font-size:13px;color:#f2f2f2;line-height:1.5;">Accuracy ${(ml.performance.accuracy*100).toFixed(0)}% · Brier loss ${ml.performance.brier.toFixed(3)} · ${ml.performance.samples} training samples</div></div>`
    :'';
  const cardioAdjHtml=cardioAdj?`<div style="padding:12px;background:rgba(200,255,0,0.05);border:1px solid rgba(200,255,0,0.15);border-radius:10px;margin-bottom:12px;"><div style="font-size:10px;color:#c8ff00;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Cardio Adjustment · +${cardioAdj} kcal/day</div><div style="font-size:13px;color:#f2f2f2;">Weekly cardio activity is raising your daily calorie target to offset the burn. Keep logging runs, swims and cycles to keep it accurate.</div></div>`:'';
  document.getElementById('tab-overview').innerHTML=`<div class="stat-row"><div class="stat-box"><div class="stat-val">${energy}/10</div><div class="stat-lbl">Energy</div></div><div class="stat-box"><div class="stat-val">${kcal}</div><div class="stat-lbl">kcal${calOverride?' (custom)':''}</div></div><div class="stat-box"><div class="stat-val">${protein}g</div><div class="stat-lbl">Protein</div></div><div class="stat-box"><div class="stat-val">${{0:'Deload',1:'Mod',2:'Full'}[tier]}</div><div class="stat-lbl">Mode</div></div></div><div class="block-card ${isStr?'str':'hyp'}"><div class="block-tag">${isStr?'Strength Block':'Hypertrophy Block'}</div><div class="block-name">${block.name} Block — Week ${block.week} of ${block.total}</div><div class="block-desc">${isStr?'Lower reps, heavier weight, 3–4 min rest. Neural adaptation.':'Higher reps, moderate weight, shorter rest. Muscle growth and volume.'}</div>${block.earlyTrigger?`<div style="font-size:12px;color:#ffaa00;margin-bottom:8px;">${block.earlyTrigger}</div>`:''}<div class="block-row"><div class="block-bar-track"><div class="block-bar-fill" style="width:${Math.round(block.week/block.total*100)}%;"></div></div><div class="block-weeks">${block.week}/${block.total} weeks</div></div></div><h2>Analysis</h2><p>Recovery: <strong>${{0:'poor — deload week',1:'moderate — controlled effort',2:'strong — push hard'}[tier]}</strong></p>${mlInsight}${mlPerfCard}${autoDeloadReason?`<p style="color:#ffaa00;">${autoDeloadReason}</p>`:''}<p>${{regressed:'Lifts went backwards. Do not add weight — fix recovery and nutrition first.',same:'Held steady. Target +1 rep or 2.5kg on at least one compound.',slightly_up:'Good progress. Keep increments small and consistent.',pbs:'PRs hit. Ride this momentum carefully.'}[analysis.lifts]||''}</p><p>${dietMsg}</p>${trendMsg?`<div style="padding:12px;background:${trendAdj>0?'rgba(200,255,0,0.05)':trendAdj<0?'rgba(255,77,0,0.05)':'rgba(255,255,255,0.02)'};border:1px solid ${trendAdj>0?'rgba(200,255,0,0.15)':trendAdj<0?'rgba(255,77,0,0.15)':'rgba(255,255,255,0.06)'};border-radius:10px;margin-bottom:12px;"><div style="font-size:10px;color:${trendAdj>0?'#c8ff00':trendAdj<0?'#ff4d00':'#888'};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Weight Trend${trendAdj?` · ${trendAdj>0?'+':''}${trendAdj} kcal`:''}</div><div style="font-size:13px;color:#f2f2f2;">${trendMsg}</div></div>`:''}${cardioAdjHtml}<h2>Macros</h2><ul><li><span>Daily Calories</span><span class="li-r">${kcal} kcal${calOverride?' (custom)':''}</span></li><li><span>TDEE estimate</span><span class="li-r">${tdee} kcal</span></li>${cardioAdj?`<li><span>Cardio adjustment</span><span class="li-r" style="color:#c8ff00;">+${cardioAdj} kcal/day</span></li>`:''}<li><span>Protein</span><span class="li-r">${protein}g · ${protein*4} kcal</span></li><li><span>Carbs</span><span class="li-r">${carbs}g · ${carbs*4} kcal</span></li><li><span>Fats</span><span class="li-r">${fat}g · ${fat*9} kcal</span></li></ul><h2>Profile</h2><ul><li><span>Goal</span><span class="li-r">${cap(p.goal||'general')}</span></li><li><span>Focus muscles</span><span class="li-r">${(focusMuscles||[]).map(cap).join(' & ')}</span></li><li><span>Experience</span><span class="li-r">${cap(experience)}</span></li><li><span>Split</span><span class="li-r">${p.days||4} days · ${p.sessionLen||60} min</span></li><li><span>Diet goal</span><span class="li-r">${cap(dietGoal)}</span></li></ul>${profileHtml}${freqHtml}${setHtml}${whyHtml}`;
  // Training tab
  let th='<h2>Training Plan</h2>'+renderTrainingScheduleEditor(splitDays);
  splitDays.forEach(day=>{
    const isRest=day.tag==='rest',isActive=day.tag==='active';const tagCls={'upper':'t-u','lower':'t-l','full':'t-f','focus':'t-fo','rest':'t-r','active':'t-a'}[day.tag]||'t-r';
    th+=`<div class="day-card"><div class="day-hdr" onclick="togDay(this)"><div><div class="day-title">${day.day}</div><div class="day-sub">${day.name}</div></div><div style="display:flex;align-items:center;gap:8px;"><div class="day-tag ${tagCls}">${day.tag.toUpperCase()}</div><div style="color:#888;font-size:13px;transition:transform 0.2s;">▼</div></div></div><div class="day-body">`;
    day.exercises.forEach(ex=>{
      const exId=Object.keys(EX_LIB).find(k=>EX_LIB[k].name===ex.name)||null;
      th+=`<div class="ex-row"><div class="ex-left"><div class="ex-name">${ex.name}</div>${ex.isFocus?`<span class="ex-tag focus">Focus</span>`:''}<span class="ex-tag pattern" style="display:${ex.muscle&&!isRest&&!isActive?'inline-block':'none'}">${cap(ex.muscle||'')}</span>${ex.suggest?`<div class="ex-suggest">${ex.suggest}</div>`:''}</div><div class="ex-right"><div class="ex-scheme">${ex.scheme}</div>${!isRest&&!isActive&&exId?`<button class="swap-btn" onclick="openSwap('${exId}')">swap</button>`:''}</div></div>`;
    });
    const noteClass=day.isDeload?'deload':isStr?'str':isRest||isActive?'rest':'';
    if(day.note)th+=`<div class="day-note ${noteClass}">${day.note}</div>`;
    th+=`</div></div>`;
  });
  document.getElementById('tab-training').innerHTML=th;
  initScheduleDnD('training');
  if(lastTrainingMove){setTimeout(()=>{document.querySelectorAll('.sched-slot.move-flash').forEach(el=>el.classList.remove('move-flash'));lastTrainingMove=null;},650);}
  // Diet tab
  let dh=`<h2>Diet Plan</h2><ul><li><span>Daily target</span><span class="li-r">${kcal} kcal</span></li><li><span>Protein</span><span class="li-r">${protein}g</span></li><li><span>Carbs</span><span class="li-r">${carbs}g</span></li><li><span>Fats</span><span class="li-r">${fat}g</span></li></ul>`;
  meals.forEach((m,mi)=>{dh+=`<div class="meal-card"><div class="meal-hdr" onclick="togMeal(this)"><div class="meal-num">${m.num}</div><div class="meal-info"><div class="meal-name">${m.name}</div><div class="meal-time">${m.time}</div></div><div class="meal-kcal">${m.kcal}<span> kcal</span></div><div class="meal-chev">▼</div></div><div class="meal-body"><ul class="meal-items">${m.items.map(([f,q])=>`<li><span>${f}</span><span>${q}</span></li>`).join('')}</ul><button class="swap-btn" style="margin-top:10px;" onclick="swapMeal(${mi})">swap meal</button></div></div>`;});
  document.getElementById('tab-diet').innerHTML=dh;
  // Recovery tab
  const rb={0:`<p><strong>Recovery week.</strong> Train at 50–60% only.</p><ul><li><span>Sleep</span><span class="li-r">8.5hrs in bed</span></li><li><span>No screens</span><span class="li-r">45 min before bed</span></li><li><span>Magnesium glycinate</span><span class="li-r">400mg before bed</span></li><li><span>Vitamin D</span><span class="li-r">2000IU with breakfast</span></li><li><span>Cardio</span><span class="li-r">None</span></li><li><span>Mobility</span><span class="li-r">10 min daily</span></li></ul>`,1:`<p><strong>Moderate recovery.</strong> Hold 1–2 reps from failure.</p><ul><li><span>Session length</span><span class="li-r">Under 55 min</span></li><li><span>Rest periods</span><span class="li-r">2–3 min compounds</span></li><li><span>Creatine</span><span class="li-r">5g daily</span></li><li><span>Magnesium</span><span class="li-r">300mg before bed</span></li><li><span>Water</span><span class="li-r">3.5L daily</span></li></ul>`,2:`<p><strong>Recovery is strong.</strong> Push hard — these are the weeks that matter.</p><ul><li><span>Overload</span><span class="li-r">Add weight to 2+ exercises</span></li><li><span>Sleep</span><span class="li-r">Same schedule on weekends</span></li><li><span>Creatine</span><span class="li-r">5g daily</span></li><li><span>Omega-3</span><span class="li-r">2g EPA+DHA with dinner</span></li><li><span>Pre-workout</span><span class="li-r">Meal 4 · 60–90 min before</span></li></ul>`}[tier];
  document.getElementById('tab-recovery').innerHTML='<h2>Recovery Protocol</h2>'+rb;
  document.getElementById('planDate').textContent=window.currentCheckin?.date||'';
  document.querySelectorAll('.tab-body').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
  const nextTab=document.getElementById('tab-'+activeTab)||document.getElementById('tab-overview');
  const nextBtn=[...document.querySelectorAll('.ptab')].find(btn=>btn.textContent.trim().toLowerCase()===activeTab)||document.querySelector('.ptab');
  if(nextTab)nextTab.classList.add('active');
  if(nextBtn)nextBtn.classList.add('active');
  if(activeTab==='training'&&focusDay){
    const cards=[...document.querySelectorAll('#tab-training .day-card')];
    const match=cards.find(card=>card.querySelector('.day-title')?.textContent?.trim()===focusDay);
    if(match){
      const body=match.querySelector('.day-body');
      const chev=match.querySelector('.day-hdr div:last-child');
      if(body&&!body.classList.contains('open')){
        body.classList.add('open');
        if(chev)chev.style.transform='rotate(180deg)';
      }
      setTimeout(()=>match.scrollIntoView({behavior:'smooth',block:'start'}),80);
    }
  }
}

// ── TOGGLES ──
function togDay(h){const b=h.nextElementSibling,ch=h.querySelector('div:last-child');b.classList.toggle('open');if(ch)ch.style.transform=b.classList.contains('open')?'rotate(180deg)':'';}
window.togDay=togDay;
function togMeal(h){const b=h.nextElementSibling,ch=h.querySelector('.meal-chev');b.classList.toggle('open');if(ch)ch.classList.toggle('open');}
window.togMeal=togMeal;
const MEAL_SWAP_BANK={
  Breakfast:[['Protein oats','oats + protein + berries'],['Egg and toast plate','eggs + sourdough + fruit'],['Yoghurt granola bowl','greek yoghurt + granola + nuts']],
  'Mid-Morning':[['High protein wrap','turkey wrap + fruit'],['Smoothie combo','banana smoothie + nuts'],['Skyr and rice cakes','skyr + rice cakes + honey']],
  Lunch:[['Chicken rice bowl','chicken + rice + veg'],['Salmon potato bowl','salmon + potato + greens'],['Beef pasta bowl','lean beef + pasta + spinach']],
  'Pre-Workout':[['Banana bagel stack','bagel + nut butter + banana'],['Rice cake stack','rice cakes + jam + whey'],['Yoghurt fruit cup','yoghurt + fruit + granola']],
  'Post-Workout':[['Chicken and jasmine rice','chicken + rice + olive oil'],['Lean beef and potato','beef + potato + veg'],['Shake and cereal','whey shake + cereal + fruit']],
  'Before Bed':[['Casein bowl','casein + berries'],['Cottage cheese mix','cottage cheese + nuts'],['Protein pudding','protein pudding + fruit']],
};
function swapMeal(mealIdx){
  if(!window.currentPlanData?.meals?.[mealIdx])return;
  const meal=window.currentPlanData.meals[mealIdx];
  const key=meal.name;
  const options=MEAL_SWAP_BANK[key]||[];
  if(!options.length){showToast('No swap options','Meal alternatives are not available for this slot yet.');return;}
  const pick=options[Math.floor(Math.random()*options.length)];
  const rebuilt={...meal,name:pick[0],items:pick[1].split('+').map(x=>[x.trim(),'1 portion'])};
  window.currentPlanData.meals[mealIdx]=rebuilt;
  renderPlan(window.currentPlanData,'diet');
  showToast('Meal swapped',`${key} replaced with ${pick[0]}.`);
}
window.swapMeal=swapMeal;

// ── LOG SESSION ──
function renderLogSelect(){const plan=window.currentPlanData,body=document.getElementById('logDayList'),hint=document.getElementById('logModeHint');if(hint)hint.textContent=pendingLogMode==='emom'?'EMOM mode is armed: pick today\'s session to auto-start a 12-minute EMOM timer.':'Which session did you train today?';if(!plan){body.innerHTML='<div class="empty">Complete a check-in first to generate your plan.</div>';return;}body.innerHTML=plan.splitDays.filter(d=>d.tag!=='rest'&&d.tag!=='active').map((d,i)=>`<div class="card" onclick="openLogDay(${i})"><div class="card-top"><div class="day-tag t-${d.tag}" style="font-size:10px;">${d.tag.toUpperCase()}</div><div class="card-arrow">→</div></div><div class="card-title">${d.day} — ${d.name}</div><div class="card-desc">${d.exercises.filter(e=>e.scheme!=='—').length} exercises</div></div>`).join('');}
let logDayIndex=null;
function openCustomEmomLogSession(config){
  const rounds=Math.max(1,Math.min(40,parseInt(config?.rounds,10)||12));
  const exerciseItems=normalizeEmomExerciseItems(config);
  if(!exerciseItems.length){showToast('Add exercises','Choose at least one movement and reps.');return false;}
  const exercises=exerciseItems.map(item=>item.name);
  currentLogDay={
    day:'EMOM',
    name:'Custom EMOM',
    tag:'emom',
    exercises:exerciseItems.map(item=>({name:item.name,muscle:'conditioning',pattern:'conditioning',scheme:`${rounds}×${item.reps}`,isEmom:true,emomReps:item.reps,emomKey:item.key}))
  };
  document.getElementById('logTitle').textContent='EMOM - Custom';
  document.getElementById('logDayInfo').textContent=`${rounds} minutes · Rotation: ${exerciseItems.map(item=>`${item.name} ${item.reps}r`).join(' · ')}`;
  const exSel=document.getElementById('wTimerExerciseSel');
  if(exSel)exSel.innerHTML='<option value="">Select exercise</option>'+exerciseItems.map(item=>`<option value="${item.name}">${item.name} (${item.reps}r)</option>`).join('');
  APP_STATE.workoutTimer.activeExercise=exercises[0]||'';
  APP_STATE.workoutTimer.activeSet=1;
  stopRestTimer(true);
  document.getElementById('logExWrap').innerHTML=exerciseItems.map(item=>{
    const safeName=item.name.replace(/[^a-zA-Z0-9]/g,'_');
    return `<div class="log-ex-card"><div class="log-ex-hdr"><div class="log-ex-name">${item.name}</div><div class="log-ex-info">Target ${item.reps} reps per minute · Best set after EMOM</div></div><div class="log-sets"><div class="log-set-row"><div class="log-set-num">Best</div><input type="number" class="log-in" placeholder="kg" step="0.5" id="w_${safeName}_0"><span class="log-lbl">kg ×</span><input type="number" class="log-in" placeholder="reps" id="r_${safeName}_0"><span class="log-lbl">reps</span></div></div></div>`;
  }).join('');
  wireLogInputHelpers();
  renderWorkoutTimer();
  if('mediaSession' in navigator)updateMediaSession(Math.floor(APP_STATE.workoutTimer.seconds/60),'Custom EMOM');
  goTo('logsession');
  return true;
}
function startSavedEmom(index){
  const template=loadEmomTemplate(index);
  if(!template)return;
  if(!openCustomEmomLogSession(template))return;
  const items=normalizeEmomExerciseItems(template);
  startEmomTimer(template.rounds||template.minutes,template.work,template.rest,items);
  trackFlowEvent('emom_started',{source:'template',minutes:template.rounds||template.minutes||12,exerciseCount:items.length});
}
window.startSavedEmom=startSavedEmom;
function startCustomEmom(){
  const config=readEmomBuilderConfig();
  if(!config.exerciseItems.length){showToast('Add exercises','Choose at least one movement and reps.');return;}
  if(!openCustomEmomLogSession(config))return;
  startEmomTimer(config.rounds,config.work,config.rest,config.exerciseItems);
  trackFlowEvent('emom_started',{source:'custom',minutes:config.rounds,exerciseCount:config.exerciseItems.length});
}
window.startCustomEmom=startCustomEmom;
async function openLogDay(idx){
  const plan=window.currentPlanData;
  if(!plan)return;
  const trainDays=plan.splitDays.filter(d=>d.tag!=='rest'&&d.tag!=='active');
  const day=trainDays[idx];
  logDayIndex=idx;
  currentLogDay=day;
  document.getElementById('logTitle').textContent=day.day+' - '+day.name;
  document.getElementById('logDayInfo').textContent=day.exercises.filter(e=>e.scheme!=='—').length+' exercises · Enter weight and reps per set';
  const last=window.fbLoadLastSession?await window.fbLoadLastSession(day.name):null;
  const lastIdx={};
  if(last?.exercises)last.exercises.forEach(e=>{lastIdx[e.name]=e;});
  // Use merged exercise list for muscle info
  const allLib = getAllExercises();
  const exList = day.exercises.filter(e => e.scheme !== '—' && e.muscle);
  const exSel = document.getElementById('wTimerExerciseSel');
  if (exSel) {
    exSel.innerHTML = '<option value="">Select exercise</option>' + exList.map(ex => `<option value="${ex.name}">${ex.name}</option>`).join('');
  }
  APP_STATE.workoutTimer.activeExercise = APP_STATE.workoutTimer.activeExercise || exList[0]?.name || '';
  APP_STATE.workoutTimer.activeSet = 1;
  stopRestTimer(true);
  document.getElementById('logExWrap').innerHTML = exList.map(ex => {
    const setCount = parseInt((ex.scheme || '').match(/\d+/)?.[0]) || 3;
    const lastEx = lastIdx[ex.name];
    const lastWt = lastEx?.maxWeight || '';
    const safeName = ex.name.replace(/[^a-zA-Z0-9]/g, '_');
    // Try to get muscle/pattern/eq from merged library for display
    let muscle = ex.muscle, pattern = ex.pattern, eq = ex.eq;
    for (const k in allLib) {
      if (allLib[k].name === ex.name) {
        muscle = allLib[k].muscle;
        pattern = allLib[k].pattern;
        eq = allLib[k].eq;
        break;
      }
    }
    const setsHtml = Array.from({ length: setCount }, (_, si) => `<div class="log-set-row"><div class="log-set-num">Set ${si + 1}</div><input type="number" class="log-in" placeholder="${lastWt || 'kg'}" step="0.5" id="w_${safeName}_${si}"><span class="log-lbl">kg ×</span><input type="number" class="log-in" placeholder="reps" id="r_${safeName}_${si}"><span class="log-lbl">reps</span></div>`).join('');
    return `<div class="log-ex-card"><div class="log-ex-hdr"><div class="log-ex-name">${ex.name}</div><div class="log-ex-info">${ex.scheme}${lastEx ? ` · Last: ${lastEx.maxWeight}kg × ${lastEx.maxReps}` : ''}</div></div><div class="log-sets">${setsHtml}</div></div>`;
  }).join('');
  wireLogInputHelpers();
  if(pendingLogMode==='emom'){startEmomTimer(12);pendingLogMode='normal';}
  renderWorkoutTimer();
  if('mediaSession' in navigator)updateMediaSession(Math.floor(APP_STATE.workoutTimer.seconds/60),day.name);
  goTo('logsession');
}
window.openLogDay=openLogDay;
function wireLogInputHelpers(){
  const inputs=[...document.querySelectorAll('#logExWrap .log-in')];
  inputs.forEach((input,idx)=>{
    input.addEventListener('focus',()=>input.select(),{once:true});
    input.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      e.preventDefault();
      const next=inputs[idx+1];
      if(next)next.focus();
      else submitSessionLog();
    });
  });
}
async function submitSessionLog(){
  if(!currentLogDay){showToast('Error','No session selected.');return;}
  const exList=currentLogDay.exercises.filter(e=>e.scheme!=='—'&&e.muscle);
  const exercises=exList.map(ex=>{
    const setCount=parseInt((ex.scheme||'').match(/\d+/)?.[0])||3;
    const safeName=ex.name.replace(/[^a-zA-Z0-9]/g,'_');
    const sets=Array.from({length:setCount},(_,si)=>{
      const wEl=document.getElementById(`w_${safeName}_${si}`);
      const rEl=document.getElementById(`r_${safeName}_${si}`);
      if(!wEl?.value||!rEl?.value)return null;
      return{weight:parseFloat(wEl.value),reps:parseInt(rEl.value,10)};
    }).filter(Boolean);
    if(!sets.length)return null;
    const maxWeight=Math.max(...sets.map(s=>s.weight));
    const maxSet=sets.find(s=>s.weight===maxWeight);
    const parsedTarget=parseInt((ex.scheme||'').split('–')[1],10)||0;
    const targetReps=Math.max(1,parseInt(ex.emomReps,10)||parsedTarget||10);
    return{name:ex.name,muscle:ex.muscle,sets,maxWeight,maxReps:maxSet?.reps||0,targetReps};
  }).filter(Boolean);
  if(!exercises.length){showToast('Nothing logged','Enter at least one weight to save.');return;}
  const prs=exercises.filter(e=>{
    const last=window.currentPlanData?.sIdx[e.name];
    return last?.maxWeight&&e.maxWeight>parseFloat(last.maxWeight);
  });
  const isoDate=new Date().toISOString().split('T')[0];
  await window.fbSaveSession({dayName:currentLogDay.name,day:currentLogDay.day,isoDate,date:new Date().toLocaleDateString('en-GB'),exercises,elapsedSeconds:APP_STATE.workoutTimer.seconds});
  trackFlowEvent('session_logged',{mode:currentLogDay.tag==='emom'?'emom':'gym',exerciseCount:exercises.length,elapsedSeconds:APP_STATE.workoutTimer.seconds});
  if(prs.length)showToast('New PRs!',prs.map(e=>`${e.name}: ${e.maxWeight}kg`).join(', '),5000);
  else showToast('Session saved','Great work. Keep it consistent.');
  resetWorkoutTimer();
  goTo('home');
}
window.submitSessionLog=submitSessionLog;

// ── STRENGTH ──
let allEx=[];
function loadStrength(){
  Promise.all([
    window.fbLoadSessions ? window.fbLoadSessions() : Promise.resolve([]),
    window.fbLoadCheckins ? window.fbLoadCheckins() : Promise.resolve([])
  ]).then(([sessions, checkins]) => {
    const exMap = {};
    // Use merged exercise list for muscle info
    const allLib = getAllExercises();
    sessions.forEach(sess => {
      (sess.exercises || []).forEach(ex => {
        if (!exMap[ex.name]) {
          // Try to get muscle from merged library
          let muscle = ex.muscle;
          for (const k in allLib) {
            if (allLib[k].name === ex.name) {
              muscle = allLib[k].muscle;
              break;
            }
          }
          exMap[ex.name] = { name: ex.name, muscle, history: [] };
        }
        exMap[ex.name].history.push({ date: sess.isoDate || sess.date, weight: ex.maxWeight, reps: ex.maxReps });
      });
    });
    allEx = Object.values(exMap).sort((a, b) => a.name.localeCompare(b.name));
    renderExList('');
    renderVolume(sessions);
    drawWeightChart(checkins);
    drawStreaksChart(checkins);
  });
}

// Draw streaks chart (calendar bar)
function drawStreaksChart(checkins){
  const canvas = document.getElementById('streaksChart');
  const empty = document.getElementById('streaksChartEmpty');
  if(!canvas) return;
  if(!checkins || checkins.length < 1){
    canvas.style.display = 'none';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';
  canvas.style.display = 'block';
  // Group check-ins by week
  const weekMap = {};
  checkins.forEach(c=>{
    const d = new Date(toMs(c.createdAt));
    d.setHours(0,0,0,0);
    const weekStart = getWeekStartMs(d);
    weekMap[weekStart] = (weekMap[weekStart]||0)+1;
  });
  // Get last 12 weeks
  const now = new Date();
  now.setHours(0,0,0,0);
  let weeks = [];
  for(let i=11;i>=0;i--){
    const w = getWeekStartMs(now.getTime() - i*7*24*60*60*1000);
    weeks.push(w);
  }
  const vals = weeks.map(w=>weekMap[w]||0);
  // Draw bar chart
  const W = canvas.offsetWidth||280, H = 80;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const maxV = Math.max(...vals,1);
  const pad = {l:28, r:10, t:10, b:18};
  const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  // Y axis
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t);
  ctx.lineTo(pad.l,pad.t+cH);
  ctx.stroke();
  // Bars
  const barW = cW/weeks.length*0.7;
  weeks.forEach((w,i)=>{
    const x = pad.l + i*cW/weeks.length + (cW/weeks.length-barW)/2;
    const y = pad.t + cH - (vals[i]/maxV)*cH;
    ctx.fillStyle = vals[i]>0?'#00d4ff':'#222';
    ctx.fillRect(x,y,barW,(vals[i]/maxV)*cH);
    // Week label
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    const dt = new Date(w);
    ctx.fillText(`${dt.getDate()}/${dt.getMonth()+1}`,x+2,H-6);
  });
  // Y axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  ctx.fillText(maxV,H>40?pad.l-18:2,pad.t+8);
  ctx.fillText('0',H>40?pad.l-14:2,pad.t+cH);
}
function renderExList(f) {
  // Use merged exercise list for muscle info
  const allLib = getAllExercises();
  const filtered = allEx.filter(e => e.name.toLowerCase().includes(f.toLowerCase()));
  const wrap = document.getElementById('exListWrap');
  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty">No logged exercises yet.</div>';
    return;
  }
  wrap.innerHTML = filtered.map(e => {
    const pr = Math.max(...e.history.map(h => parseFloat(h.weight) || 0));
    // Try to get muscle from merged library for display
    let muscle = e.muscle;
    for (const k in allLib) {
      if (allLib[k].name === e.name) {
        muscle = allLib[k].muscle;
        break;
      }
    }
    return `<div class="ex-item" onclick="showExChart('${e.name}')"><div><div class="ex-item-name">${e.name}</div><div style="font-size:11px;color:#888;margin-top:2px;">${cap(muscle || '')} · ${e.history.length} sessions</div></div><div class="pr-tag">PR: ${pr}kg</div></div>`;
  }).join('');
}
window.filterEx=v=>renderExList(v);
function showExChart(name){
  const ex=allEx.find(e=>e.name===name);
  if(!ex)return;
  document.getElementById('exListWrap').style.display='none';
  document.getElementById('exChartWrap').style.display='block';
  document.getElementById('exChartTitle').textContent=name;
  if(ex.history.length<2){
    document.getElementById('exChart').style.display='none';
    document.getElementById('exChartEmpty').style.display='block';
  }else{
    document.getElementById('exChart').style.display='block';
    document.getElementById('exChartEmpty').style.display='none';
    drawLineChart(ex.history,'exChart',150,'#c8ff00');
  }
  const pr=Math.max(...ex.history.map(h=>parseFloat(h.weight)||0));
  const prEntry=ex.history.find(h=>parseFloat(h.weight)===pr);
  if(pr>0){
    document.getElementById('exPRBox').style.display='block';
    document.getElementById('exPRText').textContent=pr+'kg';
    document.getElementById('exPRDate').textContent='Set on '+(prEntry?.date||'');
    // PR Timeline
    const allPRs = ex.history.reduce((arr, h, i, src) => {
      if(i===0 || parseFloat(h.weight) > Math.max(...src.slice(0,i).map(x=>parseFloat(x.weight)||0))) arr.push(h);
      return arr;
    }, []);
    if(allPRs.length>1){
      document.getElementById('exPRTimelineBox').style.display='block';
      document.getElementById('exPRTimeline').innerHTML = allPRs.map(h=>`${h.weight}kg <span style='color:#888'>(${h.date})</span>`).join(' <span style=\"color:#00d4ff\">•</span> ');
    }else{
      document.getElementById('exPRTimelineBox').style.display='none';
    }
  }else{
    document.getElementById('exPRBox').style.display='none';
    document.getElementById('exPRTimelineBox').style.display='none';
  }
}
window.showExChart=showExChart;
function showExList(){document.getElementById('exListWrap').style.display='block';document.getElementById('exChartWrap').style.display='none';}
window.showExList=showExList;
function swPTab(n,el){document.querySelectorAll('.prog-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');document.getElementById('prog-charts').style.display=n==='charts'?'block':'none';document.getElementById('prog-volume').style.display=n==='volume'?'block':'none';}
window.swPTab=swPTab;
function renderVolume(sessions){
  const muscles={chest:0,back:0,shoulders:0,biceps:0,triceps:0,glutes:0,quads:0,hamstrings:0,core:0};
  const landmarks={chest:[10,18],back:[12,22],shoulders:[10,20],biceps:[6,14],triceps:[6,14],glutes:[12,24],quads:[10,20],hamstrings:[10,20],core:[6,14]};
  sessions.slice(0,16).forEach(sess=>{(sess.exercises||[]).forEach(ex=>{if(muscles.hasOwnProperty(ex.muscle))muscles[ex.muscle]+=(ex.sets?.length||3);});});
  const max=Math.max(...Object.values(muscles),1);
  const rows=Object.entries(muscles).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([m,v])=>{
    const [lo,hi]=landmarks[m]||[8,16];
    const status=v<lo?'<span style="color:#ff4d00;">Below</span>':v>hi?'<span style="color:#ffaa00;">High</span>':'<span style="color:#c8ff00;">On target</span>';
    return`<div class="vol-bar-wrap"><div class="vol-bar-label"><span>${cap(m)}</span><span>${v} sets · ${status}</span></div><div class="vol-bar-track"><div class="vol-bar-fill" style="width:${Math.round(v/max*100)}%;"></div></div><div style="font-size:10px;color:#888;margin-top:4px;">Landmark: ${lo}-${hi} sets</div></div>`;
  }).join('');
  document.getElementById('volWrap').innerHTML='<div class="chart-wrap"><div class="chart-lbl">Volume — Last Sessions (Sets)</div>'+rows+'</div>';
}
function drawWeightChart(checkins){const wt=checkins.filter(c=>c.weight).reverse().slice(-12);const c=document.getElementById('wtChart'),e=document.getElementById('wtChartEmpty');if(wt.length<2){if(c)c.style.display='none';if(e)e.style.display='block';return;}if(e)e.style.display='none';if(c)c.style.display='block';drawLineChart(wt.map(x=>({weight:x.weight,date:x.date})),'wtChart',120,'#c8ff00');}
function drawLineChart(data,cid,H,color){const canvas=document.getElementById(cid);if(!canvas)return;const W=canvas.offsetWidth||300;canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const weights=data.map(d=>parseFloat(d.weight)||0),labels=data.map(d=>d.date||'');const minV=Math.min(...weights)*0.97,maxV=Math.max(...weights)*1.03,range=maxV-minV||1;const pad={l:38,r:10,t:10,b:22};const cW=W-pad.l-pad.r,cH=H-pad.t-pad.b;ctx.clearRect(0,0,W,H);ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;[0,0.5,1].forEach(f=>{const y=pad.t+cH*f;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.fillText((maxV-range*f).toFixed(1),0,y+3);});const pts=weights.map((w,i)=>({x:pad.l+(i/(weights.length-1||1))*cW,y:pad.t+((maxV-w)/range)*cH}));ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.lineTo(pts[pts.length-1].x,pad.t+cH);ctx.lineTo(pts[0].x,pad.t+cH);ctx.closePath();const g=ctx.createLinearGradient(0,pad.t,0,pad.t+cH);g.addColorStop(0,color+'26');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fill();pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});}

// ── HISTORY ──
async function loadHistory(){const body=document.getElementById('histBody');body.innerHTML=`<div class="empty">${t('history.loading')}</div>`;const entries=window.fbLoadCheckins?await window.fbLoadCheckins():[];if(!entries.length){body.innerHTML=`<div class="empty">${t('history.empty')}</div>`;return;}body.innerHTML=entries.map(e=>{const en=parseInt(e.energy)||5;const cls=en>=7?'e-hi':en>=4?'e-mid':'e-lo';const d=daysAgo(toMs(e.createdAt));const whenLbl=d===0?t('history.today'):d===1?t('history.yesterday'):tf('history.daysAgo',{days:d});return`<div class="hist-badge" onclick="viewHist('${e.id}')"><div><div style="font-weight:500;font-size:14px;">${e.date||''} <span style="font-size:11px;color:#888;">· ${whenLbl}</span></div><div style="font-size:12px;color:#888;margin-top:2px;">${e.weight?e.weight+'kg · ':''} ${(e.lifts||'').replace(/_/g,' ')} · ${e.sleep||''}</div></div><div style="text-align:right;"><div class="e-val ${cls}">${e.energy}<span style="font-size:12px;font-weight:400;">/10</span></div><div style="font-size:11px;color:#888;">${t('history.energy')}</div></div></div>`;}).join('');}
window.viewHist=async function(id){const[entries,sessions]=await Promise.all([window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([]),window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([])]);const e=entries.find(x=>x.id===id);if(!e)return;window.currentCheckin=e;const plan=buildLivePlan(entries,sessions,e);renderPlan(plan);goTo('result');};

function viewCurrentPlan(){
  openPlanTab('overview');
}
window.viewCurrentPlan=viewCurrentPlan;

function sanitizeEditableProfile(raw){
  const parseNum=(value,fallback,min,max)=>{const num=parseFloat(value);if(!Number.isFinite(num))return fallback;return Math.min(max,Math.max(min,num));};
  const days=Math.min(7,Math.max(1,parseInt(raw.days,10)||4));
  const focus=[...new Set((raw.focusMuscles||[]).filter(m=>m&&typeof m==='string'))].slice(0,2);
  const trainingDays=normalizeSchedule(raw.trainingDays,days,WEEKDAYS.slice(0,days));
  const saunaGoal=raw.saunaGoal||'recovery';
  const saunaSchedule=normalizeSchedule(raw.saunaSchedule,getSaunaTargetForGoal(saunaGoal),WEEKDAYS.slice(0,getSaunaTargetForGoal(saunaGoal)));
  const restrictions=[...new Set((raw.restrictions||[]).filter(Boolean))];
  const cleanedRestrictions=restrictions.length?(restrictions.includes('none')&&restrictions.length>1?restrictions.filter(item=>item!=='none'):restrictions):['none'];
  const customCalories=parseInt(raw.customCalories,10);
  return {
    ...raw,
    goal:raw.goal||'general',
    sex:raw.sex||'male',
    experience:raw.experience||'intermediate',
    days,
    sessionLen:[30,45,60,90].includes(parseInt(raw.sessionLen,10))?parseInt(raw.sessionLen,10):60,
    equipment:raw.equipment||'full',
    dietGoal:raw.dietGoal||'maintain',
    height:parseNum(raw.height,175,120,230),
    weight:parseNum(raw.weight,75,35,300),
    age:Math.round(parseNum(raw.age,25,14,90)),
    goalWeight:parseNum(raw.goalWeight,parseNum(raw.weight,75,35,300),35,300),
    focusMuscles:focus.length===2?focus:['chest','back'],
    restrictions:cleanedRestrictions,
    trainingDays,
    trainingDayMap:Object.fromEntries(trainingDays.map((day,index)=>[day,index])),
    customCalories:Number.isFinite(customCalories)&&customCalories>0?customCalories:null,
    saunaGoal,
    saunaSchedule,
    notifCheckin:raw.notifCheckin!==false,
    notifEmom:!!raw.notifEmom,
    notifSauna:!!raw.notifSauna,
  };
}
function getSettingsSelectedDays(containerId){
  return [...document.querySelectorAll(`#${containerId} .day-btn.sel`)].map(btn=>btn.dataset.day).sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));
}
function getSettingsSelectedChips(containerId){
  return [...document.querySelectorAll(`#${containerId} .chip.sel`)].map(btn=>btn.dataset.value);
}
function syncSettingsTrainingHint(){
  const target=parseInt(document.getElementById('settingsDays')?.value,10)||0;
  const selected=getSettingsSelectedDays('settingsTrainingDays');
  const note=document.getElementById('settingsTrainingNote');
  if(note)note.textContent=selected.length===target?selected.join(' · '):`${selected.length}/${target} training days selected`;
}
function syncSettingsFocusHint(){
  const selected=getSettingsSelectedChips('settingsFocusChips');
  const note=document.getElementById('settingsFocusNote');
  if(note)note.textContent=selected.length===2?selected.map(cap).join(' · '):selected.length===1?`${cap(selected[0])} selected · choose 1 more`:'Choose exactly 2 focus muscles';
}
function syncSettingsSaunaHint(){
  const target=getSaunaTargetForGoal(document.getElementById('settingsSaunaGoal')?.value||'recovery');
  const selected=getSettingsSelectedDays('settingsSaunaDays');
  const note=document.getElementById('settingsSaunaNote');
  if(note)note.textContent=selected.length===target?selected.join(' · '):`${selected.length}/${target} sauna days selected`;
}
function toggleSettingsTrainingDay(el,day){
  const target=parseInt(document.getElementById('settingsDays')?.value,10)||0;
  if(el.classList.contains('sel'))el.classList.remove('sel');
  else{
    const selected=getSettingsSelectedDays('settingsTrainingDays');
    if(selected.length>=target){showToast('Too many days',`Choose exactly ${target} training days.`);return;}
    el.classList.add('sel');
  }
  syncSettingsTrainingHint();
}
window.toggleSettingsTrainingDay=toggleSettingsTrainingDay;
function toggleSettingsSaunaDay(el,day){
  const target=getSaunaTargetForGoal(document.getElementById('settingsSaunaGoal')?.value||'recovery');
  if(el.classList.contains('sel'))el.classList.remove('sel');
  else{
    const selected=getSettingsSelectedDays('settingsSaunaDays');
    if(selected.length>=target){showToast('Too many days',`Choose exactly ${target} sauna days.`);return;}
    el.classList.add('sel');
  }
  syncSettingsSaunaHint();
}
window.toggleSettingsSaunaDay=toggleSettingsSaunaDay;
function toggleSettingsFocus(el,muscle){
  const selected=getSettingsSelectedChips('settingsFocusChips');
  if(el.classList.contains('sel'))el.classList.remove('sel');
  else{
    if(selected.length>=2){showToast('Focus limit','Choose exactly 2 focus muscles.');return;}
    el.classList.add('sel');
  }
  syncSettingsFocusHint();
}
window.toggleSettingsFocus=toggleSettingsFocus;
function toggleSettingsRestriction(el,value){
  const noneChip=document.querySelector('#settingsRestrictions .chip[data-value="none"]');
  if(value==='none'){
    document.querySelectorAll('#settingsRestrictions .chip').forEach(chip=>chip.classList.remove('sel'));
    el.classList.add('sel');
    return;
  }
  if(noneChip)noneChip.classList.remove('sel');
  el.classList.toggle('sel');
  const selected=getSettingsSelectedChips('settingsRestrictions').filter(item=>item!=='none');
  if(!selected.length&&noneChip)noneChip.classList.add('sel');
}
window.toggleSettingsRestriction=toggleSettingsRestriction;
function updateSettingsDayTarget(){
  const target=parseInt(document.getElementById('settingsDays')?.value,10)||0;
  const pills=[...document.querySelectorAll('#settingsTrainingDays .day-btn.sel')];
  while(pills.length>target){pills.pop().classList.remove('sel');}
  const targetLabel=document.getElementById('settingsTrainingTarget');
  if(targetLabel)targetLabel.textContent=String(target);
  syncSettingsTrainingHint();
}
window.updateSettingsDayTarget=updateSettingsDayTarget;
function updateSettingsSaunaTarget(){
  const target=getSaunaTargetForGoal(document.getElementById('settingsSaunaGoal')?.value||'recovery');
  const pills=[...document.querySelectorAll('#settingsSaunaDays .day-btn.sel')];
  while(pills.length>target){pills.pop().classList.remove('sel');}
  const targetLabel=document.getElementById('settingsSaunaTarget');
  if(targetLabel)targetLabel.textContent=String(target);
  syncSettingsSaunaHint();
}
window.updateSettingsSaunaTarget=updateSettingsSaunaTarget;
async function saveSettingsProfile(){
  if(!window.userProfile)return;
  const days=parseInt(document.getElementById('settingsDays')?.value,10)||4;
  const trainingDays=getSettingsSelectedDays('settingsTrainingDays');
  const focusMuscles=getSettingsSelectedChips('settingsFocusChips');
  const saunaGoal=document.getElementById('settingsSaunaGoal')?.value||'recovery';
  const saunaDays=getSettingsSelectedDays('settingsSaunaDays');
  const saunaTarget=getSaunaTargetForGoal(saunaGoal);
  if(trainingDays.length!==days){showToast('Training schedule incomplete',`Choose exactly ${days} training days.`);return;}
  if(focusMuscles.length!==2){showToast('Focus muscles missing','Choose exactly 2 focus muscles.');return;}
  if(saunaDays.length!==saunaTarget){showToast('Sauna schedule incomplete',`Choose exactly ${saunaTarget} sauna days.`);return;}
  const restrictions=getSettingsSelectedChips('settingsRestrictions');
  const payload=sanitizeEditableProfile({
    ...window.userProfile,
    goal:document.getElementById('settingsGoal')?.value,
    sex:document.getElementById('settingsSex')?.value,
    experience:document.getElementById('settingsExperience')?.value,
    days,
    sessionLen:parseInt(document.getElementById('settingsSessionLen')?.value,10),
    equipment:document.getElementById('settingsEquipment')?.value,
    dietGoal:document.getElementById('settingsDietGoal')?.value,
    height:document.getElementById('settingsHeight')?.value,
    weight:document.getElementById('settingsWeight')?.value,
    age:document.getElementById('settingsAge')?.value,
    goalWeight:document.getElementById('settingsGoalWeight')?.value,
    customCalories:document.getElementById('settingsCustomCalories')?.value,
    trainingDays,
    focusMuscles,
    restrictions:restrictions.length?restrictions:['none'],
    saunaGoal,
    saunaSchedule:saunaDays,
    notifCheckin:!!document.getElementById('settingsNotifCheckin')?.checked,
    notifEmom:!!document.getElementById('settingsNotifEmom')?.checked,
    notifSauna:!!document.getElementById('settingsNotifSauna')?.checked,
  });
  if((payload.notifCheckin||payload.notifEmom||payload.notifSauna)&&'Notification' in window&&Notification.permission==='default')await Notification.requestPermission();
  window.userProfile=payload;
  syncProfileDrivenState();
  if(window.fbSaveProfile)await window.fbSaveProfile(payload);
  updateHomeUI();
  renderSettings();
  showToast('Profile updated','Home, plan defaults, and reminders now use the new settings.');
}
window.saveSettingsProfile=saveSettingsProfile;

function renderSettings() {
  const p = window.userProfile || {};
  const trainingDays=getProfileTrainingDays(p);
  const saunaDays=getProfileSaunaDays(p);
  const focusMuscles=[...new Set((p.focusMuscles||[]).filter(Boolean))];
  const restrictions=(p.restrictions&&p.restrictions.length?p.restrictions:['none']);
  const calorieMode=p.customCalories?`${p.customCalories} kcal fixed`:`${trEnum('dietGoal',p.dietGoal)} adaptive`;
  const reminderSummary=buildProfileReminderSummary(p);
  document.getElementById('settingsBody').innerHTML = `
    <div class="settings-card">
      <div class="settings-card-head">
        <div>
          <div class="settings-title">Profile Editor</div>
          <div class="settings-copy">Edit the fields onboarding now feeds into your starter plan, home screen, reminders, and recovery defaults.</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="testNotification()">Test Notification</button>
      </div>
      <div class="settings-pill-row"><div class="settings-pill"><strong>${trainingDays.join(' · ')}</strong><span>Training days</span></div><div class="settings-pill"><strong>${calorieMode}</strong><span>Nutrition mode</span></div><div class="settings-pill"><strong>${cap(p.saunaGoal||'recovery')}</strong><span>${saunaDays.join(' · ')}</span></div><div class="settings-pill"><strong>${reminderSummary}</strong><span>Reminder stack</span></div></div>
      <div class="settings-grid">
        <label class="settings-field"><span class="settings-field-label">Goal</span><select id="settingsGoal" class="settings-select"><option value="vtaper" ${p.goal==='vtaper'?'selected':''}>V-Taper / Athletic</option><option value="hourglass" ${p.goal==='hourglass'?'selected':''}>Hourglass / Curves</option><option value="strength" ${p.goal==='strength'?'selected':''}>Strength and Power</option><option value="general" ${!p.goal||p.goal==='general'?'selected':''}>General Fitness</option></select></label>
        <label class="settings-field"><span class="settings-field-label">Experience</span><select id="settingsExperience" class="settings-select"><option value="beginner" ${p.experience==='beginner'?'selected':''}>Beginner</option><option value="intermediate" ${!p.experience||p.experience==='intermediate'?'selected':''}>Intermediate</option><option value="advanced" ${p.experience==='advanced'?'selected':''}>Advanced</option></select></label>
        <label class="settings-field"><span class="settings-field-label">Biological sex</span><select id="settingsSex" class="settings-select"><option value="male" ${p.sex==='male'?'selected':''}>Male</option><option value="female" ${p.sex==='female'?'selected':''}>Female</option><option value="other" ${p.sex==='other'?'selected':''}>Other</option></select></label>
        <label class="settings-field"><span class="settings-field-label">Equipment</span><select id="settingsEquipment" class="settings-select"><option value="full" ${!p.equipment||p.equipment==='full'?'selected':''}>Full Gym</option><option value="dumbbells" ${p.equipment==='dumbbells'?'selected':''}>Dumbbells Only</option><option value="bands" ${p.equipment==='bands'?'selected':''}>Resistance Bands</option><option value="none" ${p.equipment==='none'?'selected':''}>Bodyweight Only</option></select></label>
        <label class="settings-field"><span class="settings-field-label">Days per week</span><select id="settingsDays" class="settings-select" onchange="updateSettingsDayTarget()">${[1,2,3,4,5,6,7].map(val=>`<option value="${val}" ${parseInt(p.days,10)===val?'selected':''}>${val}</option>`).join('')}</select></label>
        <label class="settings-field"><span class="settings-field-label">Session length</span><select id="settingsSessionLen" class="settings-select"><option value="30" ${parseInt(p.sessionLen,10)===30?'selected':''}>30 min</option><option value="45" ${parseInt(p.sessionLen,10)===45?'selected':''}>45 min</option><option value="60" ${!p.sessionLen||parseInt(p.sessionLen,10)===60?'selected':''}>60 min</option><option value="90" ${parseInt(p.sessionLen,10)===90?'selected':''}>90 min</option></select></label>
        <label class="settings-field"><span class="settings-field-label">Height</span><input id="settingsHeight" class="settings-input" type="number" value="${p.height||''}" placeholder="175"></label>
        <label class="settings-field"><span class="settings-field-label">Weight</span><input id="settingsWeight" class="settings-input" type="number" step="0.1" value="${p.weight||''}" placeholder="75"></label>
        <label class="settings-field"><span class="settings-field-label">Age</span><input id="settingsAge" class="settings-input" type="number" value="${p.age||''}" placeholder="25"></label>
        <label class="settings-field"><span class="settings-field-label">Goal weight</span><input id="settingsGoalWeight" class="settings-input" type="number" step="0.1" value="${p.goalWeight||''}" placeholder="80"></label>
        <label class="settings-field"><span class="settings-field-label">Diet mode</span><select id="settingsDietGoal" class="settings-select"><option value="bulk" ${p.dietGoal==='bulk'?'selected':''}>Bulk</option><option value="maintain" ${!p.dietGoal||p.dietGoal==='maintain'?'selected':''}>Maintain</option><option value="cut" ${p.dietGoal==='cut'?'selected':''}>Cut</option></select></label>
        <label class="settings-field settings-field-span"><span class="settings-field-label">Custom calories</span><input id="settingsCustomCalories" class="settings-input" type="number" value="${p.customCalories||''}" placeholder="Leave blank for adaptive kcal"></label>
      </div>
    </div>
    <div class="settings-card">
      <div class="settings-title">Training Schedule</div>
      <div class="settings-copy">Pick exactly <span id="settingsTrainingTarget">${p.days||4}</span> training days. These become the base layout for your adaptive split.</div>
      <div id="settingsTrainingDays" class="settings-day-row">${WEEKDAYS.map(day=>`<button type="button" class="day-btn ${trainingDays.includes(day)?'sel':''}" data-day="${day}" onclick="toggleSettingsTrainingDay(this,'${day}')">${day}</button>`).join('')}</div>
      <div id="settingsTrainingNote" class="settings-note"></div>
    </div>
    <div class="settings-card">
      <div class="settings-title">Focus and Food Setup</div>
      <div class="settings-copy">Focus muscles influence weekly set priority. Food restrictions feed straight into meal suggestions.</div>
      <div id="settingsFocusChips" class="chip-wrap settings-chip-wrap">${['chest','back','shoulders','biceps','triceps','glutes','quads','hamstrings','core','calves'].map(muscle=>`<button type="button" class="chip ${focusMuscles.includes(muscle)?'sel':''}" data-value="${muscle}" onclick="toggleSettingsFocus(this,'${muscle}')">${cap(muscle)}</button>`).join('')}</div>
      <div id="settingsFocusNote" class="settings-note"></div>
      <div id="settingsRestrictions" class="chip-wrap settings-chip-wrap">${['none','vegetarian','vegan','dairy_free','gluten_free','halal'].map(item=>`<button type="button" class="chip ${restrictions.includes(item)?'sel':''}" data-value="${item}" onclick="toggleSettingsRestriction(this,'${item}')">${cap(item)}</button>`).join('')}</div>
    </div>
    <div class="settings-card">
      <div class="settings-title">Recovery and Reminders</div>
      <div class="settings-grid settings-grid-tight">
        <label class="settings-field"><span class="settings-field-label">Sauna goal</span><select id="settingsSaunaGoal" class="settings-select" onchange="updateSettingsSaunaTarget()"><option value="cardio" ${(p.saunaGoal||'recovery')==='cardio'?'selected':''}>Cardio</option><option value="recovery" ${(p.saunaGoal||'recovery')==='recovery'?'selected':''}>Recovery</option><option value="stress" ${(p.saunaGoal||'recovery')==='stress'?'selected':''}>Stress Relief</option><option value="longevity" ${(p.saunaGoal||'recovery')==='longevity'?'selected':''}>Longevity</option></select></label>
      </div>
      <div class="settings-copy">Pick exactly <span id="settingsSaunaTarget">${getSaunaTargetForGoal(p.saunaGoal||'recovery')}</span> sauna days for the selected goal.</div>
      <div id="settingsSaunaDays" class="settings-day-row">${WEEKDAYS.map(day=>`<button type="button" class="day-btn ${saunaDays.includes(day)?'sel':''}" data-day="${day}" onclick="toggleSettingsSaunaDay(this,'${day}')">${day}</button>`).join('')}</div>
      <div id="settingsSaunaNote" class="settings-note"></div>
      <div class="settings-toggle-list">
        <label class="settings-toggle"><span>Check-in reminders</span><span class="settings-switch"><input type="checkbox" id="settingsNotifCheckin" ${p.notifCheckin!==false?'checked':''}><span class="settings-slider"></span></span></label>
        <label class="settings-toggle"><span>EMOM reminders</span><span class="settings-switch"><input type="checkbox" id="settingsNotifEmom" ${p.notifEmom?'checked':''}><span class="settings-slider"></span></span></label>
        <label class="settings-toggle"><span>Sauna reminders</span><span class="settings-switch"><input type="checkbox" id="settingsNotifSauna" ${p.notifSauna?'checked':''}><span class="settings-slider"></span></span></label>
      </div>
      <div class="settings-copy">You still need browser notification permission for reminders to fire.</div>
    </div>
    <div class="settings-actions"><div class="settings-actions-copy"><strong>Save profile changes</strong><span>Home, plan defaults, recovery setup, and reminders will update together.</span></div><button class="btn btn-acc" onclick="saveSettingsProfile()">Save Changes</button></div>
    <p style="font-size:12px;color:#888;margin-bottom:16px;">${t('settings.helper')}</p>
  `;
  syncSettingsTrainingHint();
  syncSettingsFocusHint();
  syncSettingsSaunaHint();
}

window.toggleNotifSetting = function(key, val) {
  if (!window.userProfile) return;
  window.userProfile[key] = val;
  if (window.fbSaveProfile) window.fbSaveProfile(window.userProfile);
  if (key === 'notifCheckin' && val && 'Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

window.testNotification = function() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('ADDAPT Test Notification', { body: 'Reminders are enabled!', tag: 'addapt-test', renotify: true });
    } else {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') new Notification('ADDAPT Test Notification', { body: 'Reminders are enabled!', tag: 'addapt-test', renotify: true });
        else alert('Notifications are not enabled. Please allow them in your browser.');
      });
    }
  } else {
    alert('Notifications are not supported in this browser.');
  }
}

function normalizeSchedule(days,count,fallback){if(Array.isArray(days)){const cleaned=[...new Set(days.filter(d=>WEEKDAYS.includes(d)))].sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));if(cleaned.length===count)return cleaned;}return fallback.slice();}
function getSaunaTargetCount(){return saunaState.goal==='recovery'?2:saunaState.goal==='cardio'?4:3;}
function getSaunaScheduleDays(count){const defaults=WEEKDAYS.slice(0,count);return normalizeSchedule(window.userProfile?.saunaSchedule,count,defaults);}
function getTrainingDayMap(splitDays){
  const trainingDays=splitDays.filter(d=>d.tag!=='rest'&&d.tag!=='active');
  const fallback={};trainingDays.forEach((day,idx)=>{fallback[day.day]=idx;});
  const saved=window.userProfile?.trainingDayMap;
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
    // Validate: must cover exactly the right number of sessions with unique indices
    const entries=Object.entries(saved).filter(([day,idx])=>WEEKDAYS.includes(day)&&Number.isInteger(idx)&&idx>=0&&idx<trainingDays.length);
    const uniqueIdx=new Set(entries.map(([,idx])=>idx));
    if(entries.length===trainingDays.length&&uniqueIdx.size===trainingDays.length)return Object.fromEntries(entries);
  }
  return fallback;
}
function renderTrainingScheduleEditor(splitDays){
  const trainingDays=splitDays.filter(d=>d.tag!=='rest'&&d.tag!=='active');
  const dayMap=getTrainingDayMap(splitDays);
  return`<div class="sched-box"><div class="sched-title" style="color:#c8ff00;">Training Schedule</div><div class="sched-sub">Tap a session to select it (blue), then tap the day you want it on. Drag also works on desktop.</div><div class="sched-grid">${WEEKDAYS.map(day=>{const idx=dayMap[day];const item=idx!==undefined?trainingDays[idx]:null;const moved=lastTrainingMove&&(lastTrainingMove.from===day||lastTrainingMove.to===day);return`<div class="sched-slot${item?' active':''}${moved?' move-flash':''}" data-group="training" data-day="${day}" draggable="${item?'true':'false'}"><div class="sched-grab">${item?'⋮⋮':'+'}</div><div class="sched-day">${day}</div>${item?`<div class="sched-name">${item.name}</div>`:''}</div>`;}).join('')}</div></div>`;
}
function renderSaunaScheduleEditor(activeDays){
  return`<div class="sched-box"><div class="sched-title" style="color:#f7c068;">Sauna Days</div><div class="sched-sub">Tap a sauna day to select it (blue), then tap the new day. Drag also works on desktop.</div><div class="sched-grid">${WEEKDAYS.map(day=>{const active=activeDays.includes(day);return`<div class="sched-slot${active?' active sauna':''}" data-group="sauna" data-day="${day}" draggable="${active?'true':'false'}"><div class="sched-grab">${active?'⋮⋮':'+'}</div><div class="sched-day">${day}</div>${active?`<div class="sched-name">Sauna</div>`:''}</div>`;}).join('')}</div></div>`;
}
function initScheduleDnD(group){
  // Remove all old listeners by replacing each slot with a clone
  const container=document.querySelector(`.sched-slot[data-group="${group}"]`)?.closest('.sched-grid');
  if(!container)return;
  const slots=[...container.querySelectorAll(`.sched-slot[data-group="${group}"]`)];
  slots.forEach(slot=>{
    const fresh=slot.cloneNode(true);
    slot.parentNode.replaceChild(fresh,slot);
  });
  // Re-query after clone
  const freshSlots=[...container.querySelectorAll(`.sched-slot[data-group="${group}"]`)];
  let selectedSource=null;
  const clearSelection=()=>{selectedSource=null;freshSlots.forEach(s=>s.classList.remove('pick-source'));};
  freshSlots.forEach(slot=>{
    // Desktop drag
    slot.addEventListener('dragstart',e=>{
      if(!slot.classList.contains('active')){e.preventDefault();return;}
      e.dataTransfer.setData('text/plain',JSON.stringify({group,day:slot.dataset.day}));
    });
    slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drag-over');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));
    slot.addEventListener('drop',e=>{
      e.preventDefault();slot.classList.remove('drag-over');
      const payload=e.dataTransfer.getData('text/plain');
      if(!payload)return;
      try{const data=JSON.parse(payload);if(data.group!==group)return;moveScheduledDay(group,data.day,slot.dataset.day);}catch(err){}
      clearSelection();
    });
    // Mobile tap-to-swap
    slot.addEventListener('click',e=>{
      e.stopPropagation();
      if(!selectedSource){
        if(!slot.classList.contains('active'))return;
        selectedSource=slot.dataset.day;
        slot.classList.add('pick-source');
        return;
      }
      const from=selectedSource;
      clearSelection();
      if(from===slot.dataset.day)return;
      moveScheduledDay(group,from,slot.dataset.day);
    });
  });
  // Clicking outside cancels selection
  document.addEventListener('click',clearSelection,{once:true});
}
async function moveScheduledDay(group,fromDay,toDay){
  if(fromDay===toDay)return;
  const profile=window.userProfile||{};
  if(group==='training'){
    const splitDays=window.currentPlanData?.splitDays||[];
    const dayMap={...getTrainingDayMap(splitDays)};
    if(dayMap[fromDay]===undefined)return;
    const movingIdx=dayMap[fromDay],targetIdx=dayMap[toDay];
    // Swap if target has a session, otherwise just move
    dayMap[toDay]=movingIdx;
    if(targetIdx===undefined)delete dayMap[fromDay];
    else dayMap[fromDay]=targetIdx;
    // Persist immediately before any async work
    profile.trainingDayMap=dayMap;
    window.userProfile=profile;
    lastTrainingMove={from:fromDay,to:toDay};
    if(window.fbSaveProfile)window.fbSaveProfile(profile);// fire-and-forget, don't await
    // Re-render using existing sessions to guarantee visible day cards move immediately.
    if(window.currentPlanData){
      const trainingPool=window.currentPlanData.splitDays.filter(d=>d.tag!=='rest'&&d.tag!=='active').map(d=>({...d,exercises:(d.exercises||[]).map(ex=>({...ex}))}));
      const hasActive=window.userProfile?.days===7;
      const filler=hasActive?{name:'Active Recovery',tag:'active',exercises:[{name:'Walk or mobility',scheme:'20–30 min',muscle:'',pattern:'',isFocus:false,suggest:null}],note:'Keep moving without adding fatigue.'}:{name:'Rest Day',tag:'rest',exercises:[{name:'Rest and recover',scheme:'—',muscle:'',pattern:'',isFocus:false,suggest:null}],note:'Eat well and sleep 7–9 hrs.'};
      window.currentPlanData.splitDays=WEEKDAYS.map(day=>{
        const idx=dayMap[day];
        if(idx!==undefined&&trainingPool[idx])return{day,...trainingPool[idx]};
        return{day,...filler};
      });
      renderPlan(window.currentPlanData,'training');
    }
    if(document.getElementById('settings')?.classList.contains('active'))renderSettings();
    updateHomeUI();
  } else {
    const count=getSaunaTargetCount();
    let days=getSaunaScheduleDays(count);
    if(!days.includes(fromDay))return;
    if(days.includes(toDay))days=days.map(d=>d===toDay?fromDay:d);
    days=days.map(d=>d===fromDay?toDay:d).sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));
    profile.saunaSchedule=days;
    window.userProfile=profile;
    if(window.fbSaveProfile)window.fbSaveProfile(profile);
    buildSaunaWeek();
    if(document.getElementById('settings')?.classList.contains('active'))renderSettings();
    updateHomeUI();
  }
}
async function refreshCurrentPlan(preferredTab){
  const currentActive=document.querySelector('.tab-body.active')?.id?.replace('tab-','')||preferredTab||'overview';
  const ci=window.currentCheckin||{energy:7,stress:3,sleep:'7-8hrs',lifts:'same',diet:'on_target',weight:null,notes:'',isoDate:new Date().toISOString().split('T')[0],date:new Date().toLocaleDateString('en-GB'),calOverride:null};
  const[sessions,checkins]=await Promise.all([window.fbLoadSessions?window.fbLoadSessions():Promise.resolve([]),window.fbLoadCheckins?window.fbLoadCheckins():Promise.resolve([])]);
  window.currentPlanData=buildPlan(window.userProfile,ci,sessions,checkins);
  renderPlan(window.currentPlanData,preferredTab||currentActive);
}
const saunaState={type:'traditional',goal:'cardio',weight:75,temp:85,sessions:0,timerRunning:false,timerInterval:null,stageIndex:0,timerSeconds:0};
function showSaunaPage(page,el){document.querySelectorAll('.sauna-page').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.sauna-nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById('sauna-'+page).classList.add('active');el.classList.add('active');if(page==='protocol')buildSaunaProtocol();if(page==='hydration')buildSaunaHydration();if(page==='week')buildSaunaWeek();if(page==='benefits')buildSaunaBenefits();}
function setSaunaType(type){saunaState.type=type;document.querySelectorAll('[id^="sauna-type-"]').forEach(el=>el.classList.remove('active'));document.getElementById('sauna-type-'+type).classList.add('active');buildSaunaProtocol();buildSaunaHydration();buildSaunaWeek();}
function setSaunaGoal(goal){saunaState.goal=goal;document.querySelectorAll('[id^="sauna-goal-"]').forEach(el=>el.classList.remove('active'));document.getElementById('sauna-goal-'+goal).classList.add('active');buildSaunaProtocol();buildSaunaHydration();buildSaunaWeek();}
function updateSaunaWeight(val){saunaState.weight=parseInt(val,10);document.getElementById('saunaWeightVal').textContent=val;buildSaunaHydration();}
function updateSaunaTemp(val){saunaState.temp=parseInt(val,10);document.getElementById('saunaTempVal').textContent=val;buildSaunaProtocol();}
function getSaunaProtocol(){const base=saunaState.type==='infrared'?{heat:[18,18,15],rest:[5,5],load:'LOW'}:{heat:[12,12,10],rest:[4,4],load:'MOD'};if(saunaState.goal==='cardio'){base.heat=base.heat.map(v=>v+2);base.load='HIGH';}if(saunaState.goal==='recovery'){base.rest=base.rest.map(v=>v+1);}if(saunaState.goal==='stress'){base.heat=base.heat.map(v=>Math.max(10,v-2));base.rest=base.rest.map(v=>v+2);base.load='LOW';}if(saunaState.goal==='longevity'){base.heat=base.heat.map(v=>v+1);}if(saunaState.temp>=92){base.heat=base.heat.map(v=>Math.max(8,v-2));}if(saunaState.temp<=70){base.heat=base.heat.map(v=>v+4);}return base;}
function buildSaunaProtocol(){const protocol=getSaunaProtocol();const total=protocol.heat.reduce((a,b)=>a+b,0)+protocol.rest.reduce((a,b)=>a+b,0);document.getElementById('saunaRounds').textContent=protocol.heat.length;document.getElementById('saunaMinutes').textContent=total;document.getElementById('saunaLoad').textContent=protocol.load;document.getElementById('saunaProtocolList').innerHTML=protocol.heat.map((heat,i)=>`<li><span><strong>Round ${i+1}</strong></span><span>${heat} min heat${protocol.rest[i]?` + ${protocol.rest[i]} min cool`:''}</span></li>`).join('')+'<li><span><strong>Finish</strong></span><span>5-10 min easy cooldown + breathing</span></li>';resetSaunaTimer();}
function buildSaunaHydration(){const litres=Math.max(0.6,Math.round((saunaState.weight*0.012)*10)/10);document.getElementById('saunaHydrationTotal').textContent=litres.toFixed(1)+'L';document.getElementById('saunaHydrationList').innerHTML=`<li><span><strong>Pre-sauna</strong></span><span>${Math.round(litres*350)} ml + pinch of salt</span></li><li><span><strong>During</strong></span><span>Sip between rounds as needed</span></li><li><span><strong>Post-sauna</strong></span><span>${Math.round(litres*650)} ml over 60 min</span></li>`;}
function buildSaunaWeek(){const target=getSaunaTargetCount();document.getElementById('saunaWeekTarget').textContent=target+' sessions';document.getElementById('saunaWeekNote').textContent=saunaState.goal==='recovery'?'Best after your hardest lower-body or full-body days.':'Spread sessions out and keep one easier day if fatigue rises.';document.getElementById('saunaWeekDays').innerHTML=renderSaunaScheduleEditor(getSaunaScheduleDays(target));initScheduleDnD('sauna');}
function buildSaunaBenefits(){document.getElementById('saunaSessionCount').textContent=saunaState.sessions;const items=[{min:1,text:'Acute relaxation effect starts showing up immediately.'},{min:4,text:'Habit formation starts to lock in with repeat weekly exposure.'},{min:8,text:'You now have enough volume to notice recovery patterns.'},{min:12,text:'Strong consistency streak. Sauna is part of the system now.'}];document.getElementById('saunaBenefitsList').innerHTML=items.map(item=>`<li><span><strong>${saunaState.sessions>=item.min?'Unlocked':'Pending'}</strong></span><span>${item.text}</span></li>`).join('');}
function getSaunaStages(){const protocol=getSaunaProtocol();const stages=[];protocol.heat.forEach((heat,i)=>{stages.push({label:`Round ${i+1} heat block`,seconds:heat*60});if(protocol.rest[i])stages.push({label:'Cooldown / rest',seconds:protocol.rest[i]*60});});return stages;}
function formatSaunaClock(seconds){const mins=String(Math.floor(seconds/60)).padStart(2,'0');const secs=String(seconds%60).padStart(2,'0');return `${mins}:${secs}`;}
function resetSaunaTimer(){clearInterval(saunaState.timerInterval);saunaState.timerRunning=false;saunaState.stageIndex=0;saunaState.timerSeconds=getSaunaStages()[0]?.seconds||0;document.getElementById('saunaTimerBtn').textContent='Start';document.getElementById('saunaTimerClock').textContent=formatSaunaClock(saunaState.timerSeconds);document.getElementById('saunaTimerLabel').textContent=getSaunaStages()[0]?.label||'Ready';}
function toggleSaunaTimer(){if(saunaState.timerRunning){clearInterval(saunaState.timerInterval);saunaState.timerRunning=false;document.getElementById('saunaTimerBtn').textContent='Resume';return;}if(!saunaState.timerSeconds)resetSaunaTimer();saunaState.timerRunning=true;document.getElementById('saunaTimerBtn').textContent='Pause';saunaState.timerInterval=setInterval(()=>{saunaState.timerSeconds--;document.getElementById('saunaTimerClock').textContent=formatSaunaClock(Math.max(0,saunaState.timerSeconds));if(saunaState.timerSeconds<=0){const stages=getSaunaStages();saunaState.stageIndex++;if(saunaState.stageIndex>=stages.length){clearInterval(saunaState.timerInterval);saunaState.timerRunning=false;document.getElementById('saunaTimerBtn').textContent='Start';document.getElementById('saunaTimerClock').textContent='00:00';document.getElementById('saunaTimerLabel').textContent='Session complete';showToast('Sauna complete','Nice work. Rehydrate slowly.');return;}saunaState.timerSeconds=stages[saunaState.stageIndex].seconds;document.getElementById('saunaTimerLabel').textContent=stages[saunaState.stageIndex].label;}},1000);}
function addSaunaSession(){saunaState.sessions=Math.min(saunaState.sessions+1,50);buildSaunaBenefits();}
function removeSaunaSession(){saunaState.sessions=Math.max(saunaState.sessions-1,0);buildSaunaBenefits();}
window.showSaunaPage=showSaunaPage;
window.setSaunaType=setSaunaType;
window.setSaunaGoal=setSaunaGoal;
window.updateSaunaWeight=updateSaunaWeight;
window.updateSaunaTemp=updateSaunaTemp;
window.toggleSaunaTimer=toggleSaunaTimer;
window.resetSaunaTimer=resetSaunaTimer;
window.addSaunaSession=addSaunaSession;
window.removeSaunaSession=removeSaunaSession;
buildSaunaProtocol();buildSaunaHydration();buildSaunaWeek();buildSaunaBenefits();

function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1).replace(/_/g,' '):'';};
