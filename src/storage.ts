import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type UserCredential,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
} from "firebase/firestore";

export type Score = 1 | 2 | 3 | 4 | 5;

export type Habit = {
  id: string;
  name: string;
  area: string;
  color: string;
  parentId?: string;
  archived?: boolean;
};

export type HabitEntry = {
  habitId: string;
  date: string;
  score: Score;
};

export type DayNotes = Record<string, string>;

export type UserProfile = {
  nickname?: string;
};

export type UserPreferences = {
  expandedProjectIds?: string[];
};

export type TrackerState = {
  habits: Habit[];
  entries: Record<string, HabitEntry>;
  dayNotes: DayNotes;
  profile?: UserProfile;
  preferences?: UserPreferences;
  updatedAt: string;
};

const STORAGE_KEY = "hobby-habit-tracker-state-v1";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDfpChhZ8_U_KDtMxZpjjIW51lNTSq8d14",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "hobby-habit-tracker-iveivs.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "hobby-habit-tracker-iveivs",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "hobby-habit-tracker-iveivs.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "47511057867",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:47511057867:web:ce698ea3632e4f1cef724e",
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureFirebase() {
  if (!hasFirebaseConfig) return null;
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  }
  return { auth: auth!, db: db! };
}

export function makeEntryKey(habitId: string, date: string) {
  return `${date}__${habitId}`;
}

export function createDefaultState(): TrackerState {
  const today = new Date().toISOString().slice(0, 10);
  const guitarId = crypto.randomUUID();
  const habits: Habit[] = [
    { id: guitarId, name: "Гитара", area: "творчество", color: "#2f80ed" },
    {
      id: crypto.randomUUID(),
      name: "Игра с метрономом",
      area: "упражнение",
      color: "#2f80ed",
      parentId: guitarId,
    },
    {
      id: crypto.randomUUID(),
      name: "Чтение с листа",
      area: "упражнение",
      color: "#2f80ed",
      parentId: guitarId,
    },
    {
      id: crypto.randomUUID(),
      name: "Снятие партий на слух",
      area: "упражнение",
      color: "#2f80ed",
      parentId: guitarId,
    },
    { id: crypto.randomUUID(), name: "Английский", area: "обучение", color: "#8f5bd3" },
    { id: crypto.randomUUID(), name: "Спорт", area: "здоровье", color: "#2f9e6d" },
    { id: crypto.randomUUID(), name: "Чтение", area: "восстановление", color: "#d46b32" },
  ];

  return {
    habits,
    entries: {
      [makeEntryKey(habits[0].id, today)]: {
        habitId: habits[0].id,
        date: today,
        score: 4,
      },
      [makeEntryKey(habits[2].id, today)]: {
        habitId: habits[2].id,
        date: today,
        score: 5,
      },
    },
    dayNotes: {},
    preferences: {
      expandedProjectIds: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(state: TrackerState): TrackerState {
  return {
    ...state,
    dayNotes: Object.fromEntries(
      Object.entries(state.dayNotes ?? {}).flatMap(([date, note]) => {
        if (typeof note !== "string") return [];
        const normalized = note.trim().slice(0, 500);
        return normalized ? [[date, normalized]] : [];
      }),
    ),
    profile: state.profile ?? {},
    preferences: {
      expandedProjectIds: (state.preferences?.expandedProjectIds ?? []).filter(
        (projectId): projectId is string => typeof projectId === "string",
      ),
    },
  };
}

export function loadLocalState(): TrackerState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultState();

  try {
    return normalizeState(JSON.parse(raw) as TrackerState);
  } catch {
    return createDefaultState();
  }
}

export function saveLocalState(state: TrackerState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function watchAuth(callback: (user: User | null) => void) {
  const firebase = ensureFirebase();
  if (!firebase) return () => undefined;
  return onAuthStateChanged(firebase.auth, callback);
}

export async function completeRedirectSignIn() {
  const firebase = ensureFirebase();
  if (!firebase) return null;
  return getRedirectResult(firebase.auth);
}

export async function signInWithGoogle() {
  const firebase = ensureFirebase();
  if (!firebase) return;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(firebase.auth, provider);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(firebase.auth, provider);
      return;
    }

    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const firebase = ensureFirebase();
  if (!firebase) return;
  await signInWithEmailAndPassword(firebase.auth, email, password);
}

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<UserCredential | undefined> {
  const firebase = ensureFirebase();
  if (!firebase) return;
  return createUserWithEmailAndPassword(firebase.auth, email, password);
}

export async function sendVerificationEmail(user: User) {
  const firebase = ensureFirebase();
  if (!firebase) return;

  firebase.auth.languageCode = "ru";
  await sendEmailVerification(user, {
    url: window.location.href,
    handleCodeInApp: false,
  });
}

export async function resetEmailPassword(email: string) {
  const firebase = ensureFirebase();
  if (!firebase) return;
  await sendPasswordResetEmail(firebase.auth, email);
}

export async function signOutOfGoogle() {
  const firebase = ensureFirebase();
  if (!firebase) return;
  await signOut(firebase.auth);
}

export function subscribeCloudState(
  userId: string,
  callback: (state: TrackerState | null) => void,
) {
  const firebase = ensureFirebase();
  if (!firebase) return () => undefined;
  return onSnapshot(doc(firebase.db, "users", userId, "tracker", "state"), (snapshot) => {
    callback(
      snapshot.exists()
        ? normalizeState(snapshot.data() as TrackerState)
        : null,
    );
  });
}

export async function loadCloudState(userId: string) {
  const firebase = ensureFirebase();
  if (!firebase) return null;
  const snapshot = await getDoc(doc(firebase.db, "users", userId, "tracker", "state"));
  return snapshot.exists()
    ? normalizeState(snapshot.data() as TrackerState)
    : null;
}

export async function saveCloudState(userId: string, state: TrackerState) {
  const firebase = ensureFirebase();
  if (!firebase) return;
  await setDoc(doc(firebase.db, "users", userId, "tracker", "state"), normalizeState(state));
}
